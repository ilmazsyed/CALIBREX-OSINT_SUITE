// Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30s) for optional
// two-factor auth. No external dependency — Node crypto only.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const c of clean) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; } }
  return Buffer.from(out);
}

export const generateSecret = (bytes = 20) => base32Encode(crypto.randomBytes(bytes));

export function totpCode(secretB32, forTime = Date.now(), step = 30, digits = 6) {
  const key = base32Decode(secretB32);
  let counter = Math.floor(forTime / 1000 / step);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) { buf[i] = counter & 0xff; counter = Math.floor(counter / 256); }
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return String(bin % (10 ** digits)).padStart(digits, '0');
}

/** Verify a code within ±window steps (default ±1 = 30s tolerance). */
export function verifyTotp(secretB32, code, window = 1, forTime = Date.now()) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length < 6) return false;
  for (let w = -window; w <= window; w++) if (totpCode(secretB32, forTime + w * 30000) === c) return true;
  return false;
}

export const otpauthUri = (secretB32, label, issuer = 'Calibrex') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
