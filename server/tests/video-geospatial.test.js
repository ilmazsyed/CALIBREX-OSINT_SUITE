import test from 'node:test';
import assert from 'node:assert/strict';
import { extractQuickTimeMetadata, quickTimeToGeospatialEvidence } from '../video-geospatial.js';
import { validateInvestigation } from '../intelligence.js';

function box(type,payload) {
  const b=Buffer.alloc(8+payload.length);b.writeUInt32BE(b.length,0);b.write(type,4,'latin1');payload.copy(b,8);return b;
}
function syntheticMp4() {
  const mvhd=Buffer.alloc(100);mvhd[0]=0;mvhd.writeUInt32BE(3850000000,4);
  const xyz=Buffer.concat([Buffer.from([0,0,0,0]),Buffer.from('+22.5726+088.3639+000.0/')]);
  const moov=box('moov',Buffer.concat([box('mvhd',mvhd),box('udta',box('©xyz',xyz))]));
  const ftyp=box('ftyp',Buffer.from('isom0000isomiso2'));
  return Buffer.concat([ftyp,moov]);
}

test('extracts movie-header creation time and ISO 6709 coordinates',()=>{
  const parsed=extractQuickTimeMetadata(syntheticMp4());
  assert.equal(parsed.metadataFound,true);
  assert.equal(parsed.locationStandard,'ISO 6709');
  assert.ok(Math.abs(parsed.location.lat-22.5726)<0.00001);
  assert.ok(Math.abs(parsed.location.lon-88.3639)<0.00001);
  assert.ok(parsed.creationTime);
});

test('normalises video metadata with source provenance and hash',()=>{
  const parsed=extractQuickTimeMetadata(syntheticMp4());
  const evidence=quickTimeToGeospatialEvidence(parsed,'https://example.test/clip.mp4','b'.repeat(64));
  assert.equal(evidence.metadataOrigin,'SOURCE_VIDEO_CONTAINER');
  assert.equal(evidence.coordinates.lat,22.5726);
  assert.equal(evidence.videoSha256,'b'.repeat(64));
});

test('rejects non-ISO-BMFF content and oversized files',()=>{
  assert.equal(extractQuickTimeMetadata(Buffer.from('not video')).error,'NOT_ISOBMFF');
  assert.throws(()=>extractQuickTimeMetadata(Buffer.alloc(50*1024*1024+1)),/50 MB/);
});

test('does not invent location when container has no location atom',()=>{
  const ftyp=box('ftyp',Buffer.from('isom0000isomiso2'));
  const parsed=extractQuickTimeMetadata(ftyp);
  assert.equal(parsed.location,null);
  assert.equal(parsed.error,'NO_SUPPORTED_METADATA');
});

test('investigation validation preserves video metadata and includes it in the evidence record hash',()=>{
  const parsed=extractQuickTimeMetadata(syntheticMp4());
  const evidence=quickTimeToGeospatialEvidence(parsed,'https://example.test/clip.mp4','c'.repeat(64));
  const investigation=validateInvestigation({id:'video-case',title:'Video metadata review',evidence:[{
    id:'clip-1',title:'Source video',url:'https://example.test/clip.mp4',lat:evidence.coordinates.lat,lon:evidence.coordinates.lon,
    metadataOrigin:evidence.metadataOrigin,metadataSource:evidence.metadataSource,videoSha256:evidence.videoSha256,
    sourceTimestamp:evidence.containerCreationTime,locationMethod:'VIDEO_ISO6709',
    videoMetadata:{containerCreationTime:parsed.creationTime,locationRaw:parsed.locationRaw,locationStandard:parsed.locationStandard}
  }]});
  const item=investigation.evidence[0];
  assert.equal(item.videoSha256,'c'.repeat(64));
  assert.equal(item.videoMetadata.locationStandard,'ISO 6709');
  assert.match(item.recordSha256,/^[a-f0-9]{64}$/);
});
