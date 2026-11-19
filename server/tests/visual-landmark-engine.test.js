import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisualScene, createLandmarkSearch } from '../visual-landmark-engine.js';

test('visual scene parser preserves visible facts while bounding untrusted model output',()=>{
 const result=parseVisualScene(JSON.stringify({
  sceneDescription:'A steel bridge crosses a wide river.',sceneType:'urban',
  visibleFeatures:Array.from({length:9},(_,i)=>({feature:'Feature '+i,description:'Visible geometry '+i,distinctiveness:'high'})),
  textObserved:[{text:'HOWRAH',locationInImage:'sign',legibility:'clear'}],
  landmarkCandidates:[{name:'Howrah Bridge',disambiguationQuery:'Howrah Bridge, Kolkata, India',visualRationale:'Steel truss profile and river bend may match.'}],
  geolocationLimitations:['Low resolution'],nextChecks:['Compare independent dated imagery']
 }));
 assert.equal(result.visibleFeatures.length,6);
 assert.equal(result.landmarkCandidates[0].name,'Howrah Bridge');
 assert.equal(result.textObserved[0].text,'HOWRAH');
 assert.deepEqual(result.nextChecks,['Compare independent dated imagery']);
});

test('visual scene parser rejects non-JSON model output instead of guessing',()=>{
 assert.throws(()=>parseVisualScene('This image is probably in Kolkata.'),/did not return structured JSON/);
});

test('landmark search uses attributed gazetteer candidates and validates returned coordinates',async()=>{
 const calls=[];
 const search=createLandmarkSearch({minIntervalMs:0,sleep:async()=>{},fetchImpl:async url=>{
  calls.push(String(url));
  return {ok:true,json:async()=>[
   {place_id:123,osm_type:'way',osm_id:456,name:'Howrah Bridge',display_name:'Howrah Bridge, Kolkata, India',lat:'22.585',lon:'88.346',category:'man_made',type:'bridge',importance:0.8,address:{city:'Kolkata',country:'India'}},
   {place_id:124,name:'Bad coordinate',display_name:'Bad',lat:'999',lon:'88',category:'place',type:'city'}
  ]};
 }});
 const out=await search.search([{name:'Howrah Bridge',disambiguationQuery:'Howrah Bridge Kolkata India',visualRationale:'Steel truss geometry'}]);
 assert.equal(calls.length,1);
 assert.equal(out[0].searchStatus,'CANDIDATES_FOUND');
 assert.equal(out[0].locations.length,1);
 assert.equal(out[0].locations[0].lat,22.585);
 assert.match(calls[0],/format=jsonv2/);
});

test('landmark search reports provider errors as unresolved leads',async()=>{
 const search=createLandmarkSearch({minIntervalMs:0,sleep:async()=>{},fetchImpl:async()=>({ok:false,status:429})});
 const out=await search.search([{name:'Unknown landmark',disambiguationQuery:'Unknown landmark'}]);
 assert.equal(out[0].searchStatus,'PROVIDER_ERROR');
 assert.equal(out[0].locations.length,0);
});
