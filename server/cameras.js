// Live Cameras: public, openly broadcast video feeds for visual confirmation.
//   - youtube: 24/7 live news channels, embedded by CHANNEL (survives video-id
//     churn — YouTube serves the channel's current live stream, or an "offline"
//     card when it isn't live). Rendered client-side in a privacy iframe.
//   - mjpeg:   public MotionJPEG webcams. These are plain-http on their own
//     hosts, so a browser on an https page would refuse them as mixed content;
//     we proxy them same-origin through /api/camera/:id, behind the same SSRF
//     guard the article reader uses. Best-effort: third-party cams go offline.
//
// This is OPEN, publicly broadcast video — not the interception of any private
// or protected stream. RTSP feeds are deliberately excluded: they cannot play
// in a browser without server-side transcoding.
import { Readable } from 'stream';
import { assertPublicUrl } from './article.js';

const UA = 'Mozilla/5.0 (compatible; CalibrexOSINT/1.0)';
const CONNECT_TIMEOUT = 15000;

// Curated catalogue. `src` (mjpeg) is server-side only and never sent to the client.
const CAMERAS = [
  // --- 24/7 live news channels (embedded by channel id) ------------------
  { id: 'aje', name: 'Al Jazeera English', place: 'Doha (global desk)', region: 'Global', kind: 'youtube', channel: 'UCNye-wNBqNL5ZzHSJj3l8Bg', note: '24/7 international news' },
  { id: 'dw', name: 'DW News', place: 'Berlin (global desk)', region: 'Europe', kind: 'youtube', channel: 'UCknLrEdhRCp1aegoMqRaCZg', note: '24/7 English news from Europe' },
  { id: 'sky', name: 'Sky News', place: 'London (global desk)', region: 'Europe', kind: 'youtube', channel: 'UCoMdktPbSTixAyNGwb-UYkQ', note: '24/7 UK & world news' },
  { id: 'bloomberg', name: 'Bloomberg TV', place: 'New York (markets desk)', region: 'Global', kind: 'youtube', channel: 'UCIALMKvObZNtJ6AmdCLP7Lg', note: '24/7 markets & finance' },

  // --- public MotionJPEG webcams (proxied, best-effort) ------------------
  // Port 80 only — the SSRF guard refuses odd ports, which is the point.
  { id: 'buffalotrace', name: 'Buffalo Trace Distillery', place: 'Frankfort, Kentucky, USA', region: 'Americas', kind: 'mjpeg', src: 'http://camera.buffalotrace.com/mjpg/video.mjpg' },
  { id: 'heidelberg', name: 'Kirchhoff Institute pendulum', place: 'Heidelberg, Germany', region: 'Europe', kind: 'mjpeg', src: 'http://pendelcam.kip.uni-heidelberg.de/mjpg/video.mjpg' },
  { id: 'pajala', name: 'Soltorget square', place: 'Pajala, Sweden', region: 'Europe', kind: 'mjpeg', src: 'http://195.196.36.242/mjpg/video.mjpg' },
  { id: 'purdue', name: 'Engineering Mall', place: 'Purdue University, Indiana, USA', region: 'Americas', kind: 'mjpeg', src: 'http://webcam01.ecn.purdue.edu/mjpg/video.mjpg' },
];

/** Client-safe catalogue: MJPEG sources are replaced by our same-origin proxy path. */
export function camerasCatalogue() {
  return CAMERAS.map(c => c.kind === 'youtube'
    ? { id: c.id, name: c.name, place: c.place, region: c.region, kind: 'youtube', channel: c.channel, note: c.note || '' }
    : { id: c.id, name: c.name, place: c.place, region: c.region, kind: 'mjpeg', stream: `/api/camera/${c.id}`, note: c.note || 'Public webcam — best effort' });
}

/**
 * Stream one MJPEG camera through the server (fixes mixed-content + CORS).
 * The upstream is a fixed, curated URL — still re-checked by assertPublicUrl.
 */
export async function streamCamera(id, req, res) {
  const cam = CAMERAS.find(c => c.id === id && c.kind === 'mjpeg');
  if (!cam) { res.status(404).json({ error: 'Unknown camera.' }); return; }
  await assertPublicUrl(cam.src); // refuses private IPs and non-80/443 ports

  const ctl = new AbortController();
  const connectTimer = setTimeout(() => ctl.abort(), CONNECT_TIMEOUT);
  req.on('close', () => ctl.abort()); // client navigated away → drop the upstream

  let upstream;
  try {
    upstream = await fetch(cam.src, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'multipart/x-mixed-replace, image/jpeg, */*' } });
  } catch (e) {
    clearTimeout(connectTimer);
    if (!res.headersSent) res.status(502).json({ error: 'Camera is offline or unreachable.' });
    return;
  }
  clearTimeout(connectTimer); // header phase done; the body stream may run indefinitely

  if (!upstream.ok || !upstream.body) {
    if (!res.headersSent) res.status(502).json({ error: `Camera returned HTTP ${upstream.status}.` });
    return;
  }
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'multipart/x-mixed-replace');
  res.setHeader('Cache-Control', 'no-store');
  try {
    await new Promise((resolve, reject) => {
      const node = Readable.fromWeb(upstream.body);
      node.on('error', reject);
      res.on('close', () => node.destroy());
      node.pipe(res).on('finish', resolve).on('error', reject);
    });
  } catch { /* client disconnect or upstream drop — nothing to report */ }
}
