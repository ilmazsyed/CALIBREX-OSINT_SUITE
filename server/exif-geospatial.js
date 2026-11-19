// Minimal, bounded JPEG/EXIF reader for GEOINT triage. It extracts metadata
// only; EXIF is editable and must never be treated as proof of capture location.
const MAX_BYTES = 12 * 1024 * 1024;
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function tiffReader(tiff) {
  if (!Buffer.isBuffer(tiff) || tiff.length < 8) return null;
  const order = tiff.toString('ascii', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  const u16 = o => o >= 0 && o + 2 <= tiff.length ? (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o)) : null;
  const u32 = o => o >= 0 && o + 4 <= tiff.length ? (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o)) : null;
  const i32 = o => o >= 0 && o + 4 <= tiff.length ? (le ? tiff.readInt32LE(o) : tiff.readInt32BE(o)) : null;
  if (u16(2) !== 42) return null;
  const readIfd = offset => {
    const count = u16(offset);
    if (count === null || count > 512 || offset + 2 + count * 12 + 4 > tiff.length) return null;
    const tags = new Map();
    for (let i = 0; i < count; i++) {
      const p = offset + 2 + i * 12, tag = u16(p), type = u16(p + 2), n = u32(p + 4);
      const unit = TYPE_SIZE[type];
      if (!unit || !n || n > 10000) continue;
      const size = unit * n, dataOffset = size <= 4 ? p + 8 : u32(p + 8);
      if (dataOffset === null || dataOffset < 0 || dataOffset + size > tiff.length) continue;
      tags.set(tag, { type, count: n, offset: dataOffset });
    }
    return tags;
  };
  const values = tag => {
    const e = tag;
    if (!e) return null;
    if (e.type === 2) return tiff.toString('ascii', e.offset, e.offset + e.count).replace(/\0+$/, '');
    if (e.type === 1 || e.type === 7) return [...tiff.subarray(e.offset, e.offset + e.count)];
    if (e.type === 3) return Array.from({ length: e.count }, (_, i) => u16(e.offset + i * 2));
    if (e.type === 4) return Array.from({ length: e.count }, (_, i) => u32(e.offset + i * 4));
    if (e.type === 5 || e.type === 10) return Array.from({ length: e.count }, (_, i) => {
      const p = e.offset + i * 8;
      const numerator = e.type === 10 ? i32(p) : u32(p);
      const denominator = e.type === 10 ? i32(p + 4) : u32(p + 4);
      return denominator ? numerator / denominator : null;
    });
    return null;
  };
  const first = readIfd(u32(4));
  if (!first) return null;
  const get = (map, id) => values(map.get(id));
  const exifPtr = get(first, 0x8769)?.[0];
  const gpsPtr = get(first, 0x8825)?.[0];
  const exif = Number.isFinite(exifPtr) ? readIfd(exifPtr) : null;
  const gps = Number.isFinite(gpsPtr) ? readIfd(gpsPtr) : null;
  return {
    dateTime: get(first, 0x0132) || null,
    dateTimeOriginal: get(exif, 0x9003) || null,
    offsetTimeOriginal: get(exif, 0x9011) || null,
    gpsLatitudeRef: get(gps, 1) || null,
    gpsLatitude: get(gps, 2) || null,
    gpsLongitudeRef: get(gps, 3) || null,
    gpsLongitude: get(gps, 4) || null,
    gpsTimeStamp: get(gps, 7) || null,
    gpsDateStamp: get(gps, 0x001d) || null,
    gpsHPositioningError: get(gps, 0x001f)?.[0] ?? null
  };
}

/** Parse the first valid EXIF APP1 segment in a bounded JPEG byte buffer. */
export function extractJpegExif(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (buffer.length > MAX_BYTES) throw new Error('Image exceeds the 12 MB metadata extraction limit.');
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { format: 'JPEG', metadataFound: false, error: 'NOT_A_JPEG' };
  }
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const start = offset + 2, end = offset + length;
    if (marker === 0xe1 && end - start >= 14 && buffer.toString('ascii', start, start + 6) === 'Exif\0\0') {
      const metadata = tiffReader(buffer.subarray(start + 6, end));
      if (metadata) return { format: 'JPEG', metadataFound: true, metadata };
    }
    offset = end;
  }
  return { format: 'JPEG', metadataFound: false, error: 'EXIF_NOT_FOUND' };
}

export function exifToGeospatialEvidence(parsed, sourceUrl, sha256, capturedAt = new Date().toISOString()) {
  const metadata = parsed?.metadata || {};
  const hasGps = Array.isArray(metadata.gpsLatitude) && Array.isArray(metadata.gpsLongitude);
  const gpsDateTime = metadata.gpsDateStamp && Array.isArray(metadata.gpsTimeStamp)
    ? `${metadata.gpsDateStamp}T${metadata.gpsTimeStamp.map(n => String(Math.floor(n)).padStart(2, '0')).join(':')}Z`
    : null;
  return {
    metadataOrigin: 'SOURCE_EXIF',
    metadataSource: String(sourceUrl || '').slice(0, 1000),
    imageSha256: String(sha256 || ''),
    fetchedAt: capturedAt,
    coordinates: hasGps ? {
      latitude: metadata.gpsLatitude,
      latitudeRef: metadata.gpsLatitudeRef?.[0] || null,
      longitude: metadata.gpsLongitude,
      longitudeRef: metadata.gpsLongitudeRef?.[0] || null
    } : null,
    capturedAt: metadata.dateTimeOriginal || gpsDateTime || null,
    timestampTimezone: metadata.offsetTimeOriginal?.[0] || (gpsDateTime ? 'UTC' : 'UNKNOWN'),
    accuracyMeters: Number.isFinite(metadata.gpsHPositioningError) ? metadata.gpsHPositioningError : null,
    caveats: [
      'EXIF fields are editable and may be stripped, copied, or misattributed.',
      'DateTimeOriginal may not include a timezone; GPS time is UTC when present.',
      'Extracted metadata is a lead for analyst review, not proof of capture location or time.'
    ]
  };
}
