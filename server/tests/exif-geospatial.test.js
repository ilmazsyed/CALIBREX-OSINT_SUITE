import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJpegExif, extractImageExif, exifToGeospatialEvidence } from '../exif-geospatial.js';
import { validateInvestigation } from '../intelligence.js';

function syntheticJpeg() {
  const tiff = Buffer.alloc(8 + 2 + 2 * 12 + 4 + 2 + 4 * 12 + 4 + 48);
  tiff.write('II', 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  // IFD0: GPS IFD pointer (offset 38), and DateTimeOriginal IFD pointer absent.
  tiff.writeUInt16LE(0x8825, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(38, 18);
  tiff.writeUInt16LE(0x0132, 22); tiff.writeUInt16LE(2, 24); tiff.writeUInt32LE(20, 26); tiff.writeUInt32LE(100, 30);
  tiff.writeUInt32LE(0, 34);
  // GPS IFD: N, latitude 22°34'12", E, longitude 88°21'36".
  tiff.writeUInt16LE(4, 38);
  const tags = [
    [1, 2, 2, 86], [2, 5, 3, 92], [3, 2, 2, 88], [4, 5, 3, 116]
  ];
  for (let i=0;i<tags.length;i++) {
    const p=40+i*12,[tag,type,count,value]=tags[i];
    tiff.writeUInt16LE(tag,p);tiff.writeUInt16LE(type,p+2);tiff.writeUInt32LE(count,p+4);tiff.writeUInt32LE(value,p+8);
  }
  tiff.writeUInt32LE(0, 88);
  tiff.write('N\0',48,'ascii'); tiff.write('E\0',72,'ascii');
  const rational=(p,n,d)=>{tiff.writeUInt32LE(n,p);tiff.writeUInt32LE(d,p+4);};
  rational(92,22,1);rational(100,34,1);rational(108,12,1);
  rational(116,88,1);rational(124,21,1);rational(132,36,1);
  const exif=tiff.length>=138?tiff:Buffer.concat([tiff,Buffer.alloc(138-tiff.length)]);
  const payload=Buffer.concat([Buffer.from('Exif\0\0','binary'),exif]);
  const segment=Buffer.alloc(4);segment[0]=0xff;segment[1]=0xe1;segment.writeUInt16BE(payload.length+2,2);
  return Buffer.concat([Buffer.from([0xff,0xd8]),segment,payload,Buffer.from([0xff,0xd9])]);
}

test('rejects non-JPEG input without throwing', () => {
  assert.equal(extractJpegExif(Buffer.from('not image')).error, 'NOT_A_JPEG');
});

test('reports missing EXIF cleanly', () => {
  assert.equal(extractJpegExif(Buffer.from([0xff,0xd8,0xff,0xd9])).error, 'EXIF_NOT_FOUND');
});

test('extracts GPS DMS and hemisphere refs from a JPEG EXIF segment', () => {
  const parsed=extractJpegExif(syntheticJpeg());
  assert.equal(parsed.metadataFound,true);
  assert.deepEqual(parsed.metadata.gpsLatitude,[22,34,12]);
  assert.equal(parsed.metadata.gpsLatitudeRef,'N');
  assert.deepEqual(parsed.metadata.gpsLongitude,[88,21,36]);
  assert.equal(parsed.metadata.gpsLongitudeRef,'E');
});

test('normalises extracted metadata into provenance-bearing evidence', () => {
  const parsed={metadataFound:true,metadata:{gpsLatitude:[22,34,12],gpsLatitudeRef:'N',gpsLongitude:[88,21,36],gpsLongitudeRef:'E',dateTimeOriginal:'2026:11:19 12:00:00',gpsHPositioningError:8}};
  const evidence=exifToGeospatialEvidence(parsed,'https://example.test/image.jpg','a'.repeat(64));
  assert.equal(evidence.metadataOrigin,'SOURCE_EXIF');
  assert.equal(evidence.coordinates.latitude[0],22);
  assert.ok(Math.abs(evidence.decimalCoordinates.lat-22.57)<0.001);
  assert.equal(evidence.accuracyMeters,8);
  assert.equal(evidence.timestampTimezone,'UNKNOWN');
  assert.equal(evidence.imageSha256,'a'.repeat(64));
});

test('enforces image byte limit', () => {
  assert.throws(()=>extractJpegExif(Buffer.alloc(12*1024*1024+1)),/12 MB/);
});

test('investigation validation preserves EXIF source metadata and coordinate provenance', () => {
  const investigation=validateInvestigation({
    id:'case-exif',title:'EXIF location review',
    evidence:[{id:'photo-1',title:'Source image',url:'https://example.test/image.jpg',
      lat:22.57,lon:88.36,accuracyMeters:8,metadataOrigin:'SOURCE_EXIF',
      metadataSource:'https://example.test/image.jpg',imageSha256:'a'.repeat(64),
      locationMethod:'EXIF_GPS',
      exif:{GPSLatitude:[22,34,12],GPSLatitudeRef:'N',GPSLongitude:[88,21,36],GPSLongitudeRef:'E',DateTimeOriginal:'2026:11:19 12:00:00',GPSHPositioningError:8}
    }]
  });
  const e=investigation.evidence[0];
  assert.equal(e.metadataOrigin,'SOURCE_EXIF');
  assert.equal(e.exif.GPSLatitudeRef,'N');
  assert.equal(e.imageSha256,'a'.repeat(64));
  assert.match(e.recordSha256,/^[a-f0-9]{64}$/);
});

function syntheticTiff() {
  const jpeg=syntheticJpeg();
  return jpeg.subarray(12,jpeg.length-2);
}
function syntheticPng() {
  const tiff=syntheticTiff(),chunk=Buffer.alloc(12+tiff.length);
  chunk.writeUInt32BE(tiff.length,0);chunk.write('eXIf',4);tiff.copy(chunk,8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk]);
}
function syntheticWebp() {
  const tiff=syntheticTiff(),padding=tiff.length%2,chunk=Buffer.alloc(8+tiff.length+padding);
  chunk.write('EXIF',0);chunk.writeUInt32LE(tiff.length,4);tiff.copy(chunk,8);
  const body=Buffer.concat([Buffer.from('WEBP'),chunk]);
  const header=Buffer.alloc(8);header.write('RIFF',0);header.writeUInt32LE(body.length,4);
  return Buffer.concat([header,body]);
}

test('extracts EXIF GPS metadata from PNG eXIf chunk', () => {
  const parsed=extractImageExif(syntheticPng(),'image/png');
  assert.equal(parsed.format,'PNG');
  assert.equal(parsed.metadataFound,true);
  assert.deepEqual(parsed.metadata.gpsLatitude,[22,34,12]);
  assert.equal(parsed.metadata.gpsLongitudeRef,'E');
});

test('extracts EXIF GPS metadata from WebP EXIF chunk', () => {
  const parsed=extractImageExif(syntheticWebp(),'image/webp');
  assert.equal(parsed.format,'WEBP');
  assert.equal(parsed.metadataFound,true);
  assert.deepEqual(parsed.metadata.gpsLongitude,[88,21,36]);
  assert.equal(parsed.metadata.gpsLatitudeRef,'N');
});

test('rejects unsupported image formats without parsing arbitrary content', () => {
  assert.equal(extractImageExif(Buffer.from('hello'),'image/gif').error,'UNSUPPORTED_IMAGE_FORMAT');
});
