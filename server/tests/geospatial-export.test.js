import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestigationGeoJson, buildInvestigationKml } from '../geospatial-export.js';

test('exports decimal and EXIF DMS evidence as GeoJSON points in lon-lat order',()=>{
  const result=buildInvestigationGeoJson({id:'case-1',title:'Kolkata review',revision:3,evidence:[
    {id:'e1',title:'GPS observation',lat:22.57,lon:88.36,assessment:'CLAIM',source:'Witness'},
    {id:'e2',title:'EXIF photo',exif:{GPSLatitude:[22,34,12],GPSLatitudeRef:'N',GPSLongitude:[88,21,36],GPSLongitudeRef:'E'},metadataOrigin:'SOURCE_EXIF'}
  ]},'2026-11-19T00:00:00Z');
  assert.equal(result.features.length,2);
  assert.deepEqual(result.features[0].geometry.coordinates,[88.36,22.57]);
  assert.ok(Math.abs(result.features[1].geometry.coordinates[0]-88.36)<0.001);
  assert.equal(result.metadata.caseRevision,3);
  assert.equal(result.metadata.featureCount,2);
});

test('omits evidence without usable coordinates and keeps source hashes',()=>{
  const result=buildInvestigationGeoJson({id:'c',evidence:[
    {id:'bad',lat:100,lon:1},
    {id:'good',lat:1,lon:2,recordSha256:'a'.repeat(64),imageSha256:'b'.repeat(64)}
  ]});
  assert.equal(result.features.length,1);
  assert.equal(result.features[0].properties.recordSha256,'a'.repeat(64));
  assert.equal(result.features[0].properties.imageSha256,'b'.repeat(64));
});

test('exports KML with escaped XML and evidence ExtendedData',()=>{
  const geo=buildInvestigationGeoJson({title:'A & B',evidence:[{id:'e1',title:'Photo <one>',lat:22.57,lon:88.36,source:'News & Co',url:'https://example.test/a?x=1&y=2'}]});
  const kml=buildInvestigationKml(geo);
  assert.match(kml,/<name>A &amp; B<\/name>/);
  assert.match(kml,/<name>Photo &lt;one&gt;<\/name>/);
  assert.match(kml,/News &amp; Co/);
  assert.match(kml,/88\.36,22\.57,0/);
  assert.match(kml,/<Data name="evidenceId">/);
});
