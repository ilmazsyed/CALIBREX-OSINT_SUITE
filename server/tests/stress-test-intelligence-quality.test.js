import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVisualGeolocation } from '../visual-geolocation.js';
import { assessInvestigationQuality } from '../investigation-quality.js';
import { discoverGeospatialSources } from '../geospatial-discovery.js';
import { validateInvestigation } from '../intelligence.js';
import { buildInvestigationReport } from '../investigation-report-builder.js';

const review=()=>({candidate:{name:'Howrah Bridge',lat:22.585,lon:88.346,accuracyMeters:150},imageCapturedAt:'2026-11-19',temporalToleranceDays:30,matches:[
 {id:'m1',landmark:'Bridge truss and river bend',matchType:'DISTINCTIVE_LANDMARK',referenceUrl:'https://earth.example/scene/1',provider:'Earth archive',imageryDate:'2026-11-18',sensor:'Optical satellite',resolutionMeters:1,visualRationale:'The truss geometry and river bend align with the candidate scene; the approach road orientation also matches.',reviewedBy:'analyst-1',reviewedAt:'2026-11-20T00:00:00Z'},
 {id:'m2',landmark:'Road and river alignment',matchType:'ROAD_NETWORK',referenceUrl:'https://maps.example/reference/2',provider:'Independent map archive',imageryDate:'2026-11-17',sensor:'Aerial orthophoto',resolutionMeters:0.5,visualRationale:'Road alignment and river edge geometry provide a second distinct visual reference to the same candidate area.',reviewedBy:'analyst-1',reviewedAt:'2026-11-20T00:00:00Z'}
]});

test('visual geolocation only reaches complete review when all provenance, temporal, uncertainty and independent-domain gates are present',()=>{
 const result=assessVisualGeolocation(review(),{analystId:'analyst-1'});
 assert.equal(result.status,'MULTI_REFERENCE_VISUAL_REVIEW_RECORDED');
 assert.equal(result.gateCount.passed,7);
 assert.equal(result.referenceHosts.length,2);
 assert.match(result.caveats[0],/does not automate landmark recognition/);
});

test('visual geolocation remains partial when reference domains or uncertainty are missing',()=>{
 const r=review();r.candidate.accuracyMeters=null;r.matches[1].referenceUrl='https://earth.example/second';
 const result=assessVisualGeolocation(r);
 assert.notEqual(result.status,'MULTI_REFERENCE_VISUAL_REVIEW_RECORDED');
 assert.equal(result.gates.multipleReferenceDomains,false);
 assert.equal(result.gates.uncertaintyRadiusRecorded,false);
});

test('corroboration requires explicit analyst relationship and distinguishes shared publisher hosts',()=>{
 const quality=assessInvestigationQuality({evidence:[
  {id:'a',title:'First report',url:'https://news.example/a'},
  {id:'b',title:'Republished report',url:'https://www.news.example/b'},
  {id:'c',title:'Other outlet',url:'https://other.example/c'}
 ],relationships:[
  {id:'r1',from:'a',to:'b',type:'CORROBORATES',rationale:'Two articles repeat the same wire copy.'},
  {id:'r2',from:'a',to:'c',type:'CORROBORATES',rationale:'Different reporter and separately attributed source document reviewed.'}
 ]});
 assert.equal(quality.corroboration.analystRecordedCount,2);
 assert.equal(quality.corroboration.candidateRelationships[0].independence,'SAME_PUBLISHER_HOST');
 assert.equal(quality.corroboration.candidateRelationships[1].countsAsIndependentCorroboration,false);
});

test('contradictions are explicit analyst relationships and timeline keeps source time types distinct',()=>{
 const quality=assessInvestigationQuality({evidence:[
  {id:'a',title:'Official notice',published:1763500000000,sourceTimestamp:'2026-11-19T08:00:00',capturedAt:1763500100000,visualGeolocationReview:review()},
  {id:'b',title:'Field report',eventTimestamp:'2026-11-19T09:00:00Z',videoMetadata:{keyframes:[{id:'f1',timestampSeconds:12,visualNote:'Sign visible'}]}}
 ],relationships:[{id:'r',from:'a',to:'b',type:'CONTRADICTS',rationale:'The reported closure times differ.'}]});
 assert.equal(quality.contradictions.count,1);
 assert.equal(quality.timeline.coverage,'MULTI_EVENT_CHRONOLOGY');
 assert.ok(quality.timeline.events.some(e=>e.kind==='VIDEO_OFFSET'&&e.at===null));
 assert.ok(quality.timeline.events.some(e=>e.timezoneCertainty==='UNKNOWN'));
 assert.ok(quality.timeline.events.some(e=>e.kind==='IMAGERY_ACQUISITION'));
 assert.ok(quality.timeline.events.some(e=>e.kind==='ANALYST_REVIEW'));
});

test('geospatial discovery returns nearby events only, ordered by distance and bounded by radius',()=>{
 const result=discoverGeospatialSources({origin:{lat:22.57,lon:88.36},radiusKm:20,maxAgeDays:365,events:[
  {id:'near',title:'Near event',lat:22.58,lng:88.37,date:Date.now(),source:'USGS'},
  {id:'far',title:'Far event',lat:28.61,lng:77.2,date:Date.now(),source:'NASA'}
 ]});
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].id,'near');
 assert.ok(result.results[0].distanceMeters<2000);
});

test('case validation persists visual review and report exposes all stress-test sections',()=>{
 const input=validateInvestigation({id:'quality-case',title:'Geolocation review',objective:'Assess scene location',evidence:[
  {id:'image-1',title:'Source image',url:'https://source.example/image.jpg',assessment:'CLAIM',visualGeolocationReview:review()},
  {id:'image-2',title:'Conflicting image report',url:'https://other.example/image.jpg',assessment:'CLAIM'}
 ],relationships:[{id:'contradiction-1',from:'image-1',to:'image-2',type:'CONTRADICTS',rationale:'The depicted bridge structure differs from the claimed landmark.'}]});
 assert.equal(input.evidence[0].visualGeolocationReview.matches.length,2);
 const report=buildInvestigationReport(input);
 assert.match(report.markdown,/Corroboration and source independence/);
 assert.match(report.markdown,/Contradictions and competing evidence/);
 assert.match(report.markdown,/Visual geolocation review/);
 assert.match(report.markdown,/MULTI_REFERENCE_VISUAL_REVIEW_RECORDED/);
});
