// Bounded ISO Base Media File Format / QuickTime metadata reader.
// Reads container metadata only; it does not decode video frames.
const MAX_BYTES = 50 * 1024 * 1024;
const QT_EPOCH_MS = Date.UTC(1904,0,1);

function boxAt(buffer, offset, end) {
  if (offset + 8 > end) return null;
  let size = buffer.readUInt32BE(offset), header = 8;
  const type = buffer.toString('latin1', offset + 4, offset + 8);
  if (size === 1) {
    if (offset + 16 > end) return null;
    const wide = buffer.readBigUInt64BE(offset + 8);
    if (wide > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(wide); header = 16;
  } else if (size === 0) size = end - offset;
  if (size < header || offset + size > end) return null;
  return { type, start: offset, payloadStart: offset + header, end: offset + size, size };
}

function parseIso6709(value) {
  const text = String(value || '').replace(/\0/g,'').trim();
  const match = text.match(/([+-]\d{2}(?:\.\d+)?)([+-]\d{3}(?:\.\d+)?)(?:([+-]\d+(?:\.\d+)?))?\/?/);
  if (!match) return null;
  const lat = Number(match[1]), lon = Number(match[2]), altitude = match[3] == null ? null : Number(match[3]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  return { lat, lon, altitudeMeters: Number.isFinite(altitude) ? altitude : null, raw: text.slice(0,200) };
}

function parseMvhd(buffer, box) {
  const p = box.payloadStart;
  if (p + 20 > box.end) return null;
  const version = buffer[p];
  let seconds;
  if (version === 0) seconds = buffer.readUInt32BE(p + 4);
  else if (version === 1 && p + 28 <= box.end) {
    const value = buffer.readBigUInt64BE(p + 4);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    seconds = Number(value);
  } else return null;
  if (!seconds) return null;
  const ms = QT_EPOCH_MS + seconds * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function extractQuickTimeMetadata(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (buffer.length > MAX_BYTES) throw new Error('Video exceeds the 50 MB metadata extraction limit.');
  if (buffer.length < 12 || buffer.toString('ascii',0,4) !== 'ftyp' && buffer.toString('ascii',4,8) !== 'ftyp') {
    return { format:'MP4/QuickTime', metadataFound:false, error:'NOT_ISOBMFF' };
  }
  let creationTime = null, location = null, locationRaw = null;
  const containers = new Set(['moov','trak','mdia','minf','stbl','udta','meta','ilst']);
  function walk(start,end,depth=0) {
    if(depth>12)return;
    let offset=start, count=0;
    while(offset+8<=end&&count++<20000){
      const box=boxAt(buffer,offset,end);if(!box)break;
      if(box.type==='mvhd'&&!creationTime)creationTime=parseMvhd(buffer,box);
      if(box.type==='©xyz'||box.type==='loci'){
        const raw=buffer.toString('utf8',box.payloadStart,box.end);
        const candidates=[raw,raw.slice(2),raw.slice(4)];
        for(const candidate of candidates){const parsed=parseIso6709(candidate);if(parsed){location=parsed;locationRaw=candidate;break;}}
      }
      if(containers.has(box.type)){
        let childStart=box.payloadStart;
        if(box.type==='meta')childStart+=4; // FullBox version and flags
        if(childStart<box.end)walk(childStart,box.end,depth+1);
      }
      offset=box.end;
    }
  }
  walk(0,buffer.length);
  return {
    format:'MP4/QuickTime',metadataFound:!!(creationTime||location),
    creationTime,location,locationRaw:locationRaw?String(locationRaw).slice(0,200):null,
    locationStandard:location?'ISO 6709':null,
    caveats:[
      'Container creation time may describe file or movie-header creation, not camera capture time.',
      'Embedded location tags can be edited, copied or stripped and do not prove where the scene was recorded.',
      'No video frames were decoded or visually geolocated.'
    ],
    error:creationTime||location?null:'NO_SUPPORTED_METADATA'
  };
}

export function quickTimeToGeospatialEvidence(parsed, sourceUrl, sha256, fetchedAt = new Date().toISOString()) {
  return {
    metadataOrigin:'SOURCE_VIDEO_CONTAINER',
    metadataSource:String(sourceUrl||'').slice(0,1000),
    videoSha256:String(sha256||''),
    fetchedAt,
    coordinates:parsed?.location?{lat:parsed.location.lat,lon:parsed.location.lon}:null,
    containerCreationTime:parsed?.creationTime||null,
    locationStandard:parsed?.locationStandard||null,
    caveats:parsed?.caveats||[]
  };
}
