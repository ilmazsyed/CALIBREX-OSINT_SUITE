// Sanctions screening: match a name or entity against public consolidated
// sanctions lists (US OFAC SDN + OFAC Consolidated). These are open government
// datasets published for exactly this purpose. A shared layer — used on its own
// screen and, later, by Maritime and entity investigation.
const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const TIMEOUT = 30000;
const REFRESH_MS = 24 * 60 * 60 * 1000; // daily

// OFAC publishes these as keyless CSV downloads.
const SOURCES = [
  { id: 'OFAC SDN', url: 'https://www.treasury.gov/ofac/downloads/sdn.csv' },
  { id: 'OFAC Consolidated', url: 'https://www.treasury.gov/ofac/downloads/consolidated/cons_prim.csv' },
];

async function getText(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

/** Parse CSV text into rows, honouring quoted fields and quoted newlines. */
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** Normalise a name for matching: fold diacritics, drop punctuation, lowercase. */
export const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const OFAC_EMPTY = v => (v == null || v === '-0-' ? '' : String(v).trim());

// OFAC SDN primary CSV column order (no header row):
// 0 ent_num, 1 SDN_Name, 2 SDN_Type, 3 Program, 4 Title, 5 Call_Sign,
// 6 Vess_type, 7 Tonnage, 8 GRT, 9 Vess_flag, 10 Vess_owner, 11 Remarks.
/** Build index entries from an OFAC primary CSV, enriching vessel rows with the
 *  vessel-specific columns (flag, type, tonnage, owner, call sign, IMO) so
 *  sanctioned-vessel results are precise rather than a bare name. */
export function buildEntries(rows, list) {
  const out = [];
  for (const r of rows) {
    const name = OFAC_EMPTY(r[1]);
    if (!name) continue;
    const n = norm(name);
    if (!n) continue;
    const type = OFAC_EMPTY(r[2]) || 'Entity';
    const entry = { name, norm: n, tokens: new Set(n.split(' ').filter(Boolean)), type, program: OFAC_EMPTY(r[3]), list };
    if (/vessel/i.test(type)) {
      const remarks = OFAC_EMPTY(r[11]);
      // OFAC records the IMO in the remarks text, e.g. "… IMO 9511557 …".
      const imo = (remarks.match(/\bIMO\s*(\d{7})\b/i) || [])[1] || '';
      entry.vessel = {
        callSign: OFAC_EMPTY(r[5]), vesselType: OFAC_EMPTY(r[6]), tonnage: OFAC_EMPTY(r[7]),
        grt: OFAC_EMPTY(r[8]), flag: OFAC_EMPTY(r[9]), owner: OFAC_EMPTY(r[10]), imo, remarks,
      };
    }
    out.push(entry);
  }
  return out;
}

/** Edit distance ≤ 1 test (cheap early-exit), for transliteration variants. */
function near(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la < 4 || lb < 4) return false; // only fuzz longer tokens
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } // delete / insert / substitute
  }
  return true;
}

/** Score a normalised query against one entry (0–1), with fuzzy token matching. */
function scoreEntry(qNorm, qTokens, e) {
  if (!qNorm) return 0;
  if (e.norm === qNorm) return 1;
  if (e.norm.includes(qNorm) || qNorm.includes(e.norm)) return 0.9;
  let inter = 0;
  for (const t of qTokens) {
    if (e.tokens.has(t)) { inter++; continue; }
    for (const et of e.tokens) if (near(t, et)) { inter += 0.85; break; } // near-match, discounted
  }
  if (!inter) return 0;
  const union = qTokens.size + e.tokens.size - inter;
  return inter / union; // Jaccard
}

/** Rank entries against a query. */
export function screenEntries(entries, query, { limit = 25, min = 0.45 } = {}) {
  const qNorm = norm(query);
  const qTokens = new Set(qNorm.split(' ').filter(Boolean));
  if (!qTokens.size) return [];
  const scored = [];
  for (const e of entries) {
    const s = scoreEntry(qNorm, qTokens, e);
    if (s >= min) scored.push({ name: e.name, type: e.type, program: e.program, list: e.list, score: Math.round(s * 100) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

let state = { updatedAt: 0, entries: [], counts: {}, sources: {}, names: new Set() };

/** Fast exact-normalized membership test — used to flag e.g. sanctioned vessels. */
export function sanctionedName(name) {
  const n = norm(name);
  return !!n && n.length >= 3 && state.names.has(n);
}

/** Vessel-type entries from the loaded sanctions lists, with full details. */
export function sanctionedVessels() {
  return state.entries.filter(e => e.vessel || /vessel|ship/i.test(e.type)).map(e => ({
    name: e.name, program: e.program, list: e.list,
    imo: e.vessel?.imo || '', flag: e.vessel?.flag || '', vesselType: e.vessel?.vesselType || '',
    tonnage: e.vessel?.tonnage || '', grt: e.vessel?.grt || '', owner: e.vessel?.owner || '', callSign: e.vessel?.callSign || '',
  }));
}

/** Precise sanctioned-vessel search: exact IMO, then exact/prefix/substring name,
 *  owner or call sign — no loose fuzzy matching, so results are never vague. */
export function searchVessels(query, limit = 100) {
  const all = sanctionedVessels();
  const raw = String(query || '').trim();
  if (!raw) return all.slice(0, limit);
  const q = norm(raw);
  const imoQ = (raw.match(/\b\d{7}\b/) || [])[0];
  const scored = [];
  for (const v of all) {
    const nn = norm(v.name);
    let score = 0;
    if (imoQ && v.imo === imoQ) score = 100;
    else if (nn === q) score = 98;
    else if (nn.startsWith(q)) score = 90;
    else if (q.length >= 3 && nn.includes(q)) score = 78;
    else if (v.callSign && norm(v.callSign) === q) score = 85;
    else if (q.length >= 3 && norm(v.owner).includes(q)) score = 60;
    else if (q.length >= 2 && norm(v.flag).includes(q)) score = 40;
    if (score) scored.push({ ...v, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

export async function refreshSanctions() {
  const entries = [];
  const counts = {}; const sources = {};
  for (const src of SOURCES) {
    try {
      const rows = parseCsv(await getText(src.url));
      const e = buildEntries(rows, src.id);
      entries.push(...e); counts[src.id] = e.length; sources[src.id] = { ok: true };
    } catch (err) {
      sources[src.id] = { ok: false, error: err.message };
      console.error('[sanctions] load failed', src.id, err.message);
    }
  }
  if (entries.length) state = { updatedAt: Date.now(), entries, counts, sources, names: new Set(entries.map(e => e.norm)) };
  else state = { ...state, sources }; // keep prior data if every source failed
  return state;
}

export function startSanctionsLoop() {
  refreshSanctions();
  setInterval(refreshSanctions, REFRESH_MS);
}

export function sanctionsSnapshot() {
  return { updatedAt: state.updatedAt, counts: state.counts, total: state.entries.length, sources: state.sources };
}

export function screen(query) {
  return { query, updatedAt: state.updatedAt, total: state.entries.length, matches: screenEntries(state.entries, query) };
}
