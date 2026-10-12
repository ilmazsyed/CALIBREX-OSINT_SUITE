// Live AIS vessel positions via AISStream (free WebSocket). Maintains an
// in-memory map of recent vessel positions for the Maritime monitor and the
// Global Situation map. A persistent socket with exponential-backoff reconnect;
// positions expire after a TTL so stale ships drop off. Env: AISSTREAM_KEY.
// Global AIS is a firehose, so we subscribe to AOI bounding boxes matching
// Calibrex's focus (Indian Ocean, Gulf/Hormuz, Red Sea, Malacca/South China
// Sea, Mediterranean) — overridable via AIS_BOXES (JSON).
const WS_URL = 'wss://stream.aisstream.io/v0/stream';
const KEY = () => process.env.AISSTREAM_KEY || '';
const TTL_MS = 2 * 60 * 60 * 1000;
const MAX = 8000;

function boxes() {
  try { const b = JSON.parse(process.env.AIS_BOXES || ''); if (Array.isArray(b) && b.length) return b; } catch { /* default */ }
  return [
    [[-40, 20], [30, 120]],     // Indian Ocean + Arabian Sea + Gulf + Red Sea + Bay of Bengal + SE Asia
    [[30, -6], [47, 42]],       // Mediterranean + Black Sea
    [[0, 100], [26, 135]],      // South China Sea + Taiwan Strait + East China Sea
  ];
}

const vessels = new Map();      // mmsi -> { mmsi, name, lat, lng, sog, cog, type, at }
let ws = null, retry = 0, started = false, lastMsgAt = 0;

function evict() { const cutoff = Date.now() - TTL_MS; for (const [k, v] of vessels) if (v.at < cutoff) vessels.delete(k); }

function connect() {
  const key = KEY();
  if (!key) return;
  try { ws = new WebSocket(WS_URL); } catch { return scheduleReconnect(); }
  ws.onopen = () => {
    retry = 0;
    try { ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: boxes(), FilterMessageTypes: ['PositionReport'] })); } catch { /* ignore */ }
  };
  ws.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
    if (d.MessageType !== 'PositionReport') return;
    const md = d.MetaData || {}; const pr = (d.Message && d.Message.PositionReport) || {};
    const lat = Number(md.latitude ?? pr.Latitude), lng = Number(md.longitude ?? pr.Longitude);
    const mmsi = String(md.MMSI ?? pr.UserID ?? '').trim();
    if (!mmsi || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    lastMsgAt = Date.now();
    vessels.set(mmsi, { mmsi, name: String(md.ShipName || '').trim() || mmsi, lat, lng, sog: Number(pr.Sog) || 0, cog: Number(pr.Cog) || 0, at: lastMsgAt });
    if (vessels.size > MAX) evict();
  };
  ws.onclose = () => scheduleReconnect();
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}
function scheduleReconnect() { ws = null; retry = Math.min(retry + 1, 6); setTimeout(connect, 1000 * Math.pow(2, retry)); }

export function startAisLoop() {
  if (started || !KEY()) return;
  started = true;
  connect();
  setInterval(evict, 10 * 60000).unref();
}

export function aisSnapshot() {
  evict();
  const list = [...vessels.values()].sort((a, b) => b.at - a.at).slice(0, 4000);
  return { enabled: !!KEY(), connected: !!ws, updatedAt: lastMsgAt, count: list.length, vessels: list };
}
