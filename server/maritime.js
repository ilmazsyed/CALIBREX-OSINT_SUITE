// Maritime intelligence: live vessel positions from AISStream (wss, free key).
// Maintains a rolling picture of ships in India's maritime theatre, flags
// vessels whose name matches a sanctions list, and detects "dark" vessels that
// stopped broadcasting (a common sanctions-evasion signal). AIS is a public,
// legally broadcast safety signal; we only read it.
import { sanctionedName } from './sanctions.js';

const WS_URL = 'wss://stream.aisstream.io/v0/stream';
const DARK_MS = 25 * 60 * 1000;   // no update in 25 min → flagged "signal lost"
const PRUNE_MS = 3 * 60 * 60 * 1000; // drop vessels unseen for 3h
const MAX_VESSELS = 4000;

// India's maritime theatre: Arabian Sea/Gulf/Hormuz and Bay of Bengal/Malacca.
const BOXES = [[[5, 45], [30, 78]], [[0, 78], [25, 100]]];

// A compact MMSI MID → flag map (first 3 digits of MMSI). Falls back to the MID.
const MID = { 419: 'India', 405: 'Bangladesh', 437: 'Sri Lanka', 463: 'Pakistan', 422: 'Iran', 423: 'Iran',
  273: 'Russia', 412: 'China', 413: 'China', 414: 'China', 338: 'USA', 366: 'USA', 367: 'USA', 368: 'USA', 369: 'USA',
  470: 'UAE', 471: 'UAE', 403: 'Saudi Arabia', 636: 'Liberia', 637: 'Liberia', 538: 'Marshall Is.', 563: 'Singapore',
  564: 'Singapore', 565: 'Singapore', 477: 'Hong Kong', 351: 'Panama', 352: 'Panama', 353: 'Panama', 354: 'Panama',
  355: 'Panama', 356: 'Panama', 357: 'Panama', 370: 'Panama', 371: 'Panama', 372: 'Panama', 373: 'Panama',
  205: 'Belgium', 209: 'Cyprus', 210: 'Cyprus', 215: 'Malta', 229: 'Malta', 247: 'Italy', 248: 'Malta', 249: 'Malta' };
const flagOf = mmsi => MID[Math.floor(Number(mmsi) / 1000000)] || `MID ${String(mmsi).slice(0, 3)}`;

const SHIP_TYPE = t => {
  const n = Number(t) || 0;
  if (n >= 80 && n <= 89) return 'Tanker';
  if (n >= 70 && n <= 79) return 'Cargo';
  if (n >= 60 && n <= 69) return 'Passenger';
  if (n >= 30 && n <= 39) return n === 30 ? 'Fishing' : 'Special';
  if (n >= 50 && n <= 59) return 'Service';
  return n ? `Type ${n}` : 'Vessel';
};

const vessels = new Map();
let state = { updatedAt: 0, connected: false, configured: false };
let ws = null, backoff = 3000, pruneTimer = null, lastError = null, msgCount = 0;

function upsert(mmsi, patch) {
  if (!mmsi) return;
  const v = vessels.get(mmsi) || { mmsi, name: '', lat: null, lng: null, sog: null, cog: null, type: '', dest: '' };
  Object.assign(v, patch, { lastSeen: Date.now(), flag: v.flag || flagOf(mmsi) });
  if (patch.name) v.sanctioned = sanctionedName(patch.name);
  vessels.set(mmsi, v);
  if (vessels.size > MAX_VESSELS) { // drop the oldest
    const oldest = [...vessels.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0];
    if (oldest) vessels.delete(oldest.mmsi);
  }
}

export function handle(msg) {
  const meta = msg.MetaData || {};
  const mmsi = meta.MMSI || meta.mmsi;
  if (!mmsi) return;
  if (msg.MessageType === 'PositionReport') {
    const pr = msg.Message?.PositionReport || {};
    const lat = Number(meta.latitude ?? pr.Latitude), lng = Number(meta.longitude ?? pr.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    upsert(mmsi, { lat, lng, sog: Number(pr.Sog) || 0, cog: Number(pr.Cog) || null, name: (meta.ShipName || '').trim() });
  } else if (msg.MessageType === 'ShipStaticData') {
    const sd = msg.Message?.ShipStaticData || {};
    upsert(mmsi, { name: (sd.Name || meta.ShipName || '').trim(), type: SHIP_TYPE(sd.Type), dest: (sd.Destination || '').trim() });
  }
}

function connect() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) { state = { ...state, configured: false, connected: false }; return; }
  state.configured = true;
  try { ws = new WebSocket(WS_URL); } catch { scheduleReconnect(); return; }
  ws.onopen = () => {
    backoff = 3000; state.connected = true;
    ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: BOXES, FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }));
    console.log('[maritime] AISStream connected');
  };
  ws.onmessage = ev => {
    try {
      const data = typeof ev.data === 'string' ? ev.data : ev.data?.toString?.();
      if (!data) return;
      const msg = JSON.parse(data);
      // AISStream reports subscription/auth problems as an error frame on the open socket.
      if (msg.error || msg.Error || msg.message) { lastError = String(msg.error || msg.Error || msg.message).slice(0, 200); console.error('[maritime] AISStream:', lastError); return; }
      msgCount++;
      handle(msg);
      state.updatedAt = Date.now();
    } catch { /* ignore bad frame */ }
  };
  ws.onclose = ev => { state.connected = false; if (ev?.reason) lastError = `closed: ${String(ev.reason).slice(0, 160)}`; scheduleReconnect(); };
  ws.onerror = e => { lastError = e?.message || 'connection error'; try { ws.close(); } catch { /* */ } };
}

function scheduleReconnect() {
  if (!process.env.AISSTREAM_API_KEY) return;
  setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 60000);
}

export function startMaritimeLoop() {
  connect();
  pruneTimer = setInterval(() => {
    const cut = Date.now() - PRUNE_MS;
    for (const [mmsi, v] of vessels) if (v.lastSeen < cut) vessels.delete(mmsi);
  }, 5 * 60 * 1000);
}

export function maritimeSnapshot() {
  const now = Date.now();
  const all = [...vessels.values()].filter(v => v.lat != null);
  const list = all.map(v => ({ ...v, dark: now - v.lastSeen > DARK_MS }));
  const sanctioned = list.filter(v => v.sanctioned);
  const dark = list.filter(v => v.dark);
  const india = list.filter(v => v.flag === 'India');
  // Prioritise interesting vessels in the returned slice.
  const ranked = [...list].sort((a, b) => (b.sanctioned ? 1 : 0) - (a.sanctioned ? 1 : 0) || (b.dark ? 1 : 0) - (a.dark ? 1 : 0) || b.lastSeen - a.lastSeen);
  return {
    updatedAt: state.updatedAt, connected: state.connected, configured: state.configured, lastError, messages: msgCount,
    counts: { total: list.length, sanctioned: sanctioned.length, dark: dark.length, india: india.length },
    vessels: ranked.slice(0, 600),
  };
}
