import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geospatialSourceNetwork } from '../geospatial-source-network.js';

test('network distinguishes active, cached, credential-gated and reference sources',()=>{
 const now=Date.now();
 const result=geospatialSourceNetwork({
  now,env:{NASA_FIRMS_KEY:'x',ACLED_EMAIL:'a',ACLED_PASSWORD:'b',AISSTREAM_KEY:'c'},
  geoint:{updatedAt:now,sources:{eonet:{ok:true,count:4,at:now},usgs:{ok:false,state:'cached',count:2,at:now},conflict:{ok:true,count:8,at:now},acled:{ok:true,count:3,at:now},fire:{ok:true,count:9,at:now},outage:{ok:false,state:'error',count:0,at:now,error:'HTTP 503'}}},
  signals:{updatedAt:now,aircraft:{aircraft:[{id:'a'}],at:now},sources:{aircraft:{ok:true,at:now}}},
  ais:{connected:true,count:2,updatedAt:now}
 });
 const byId=Object.fromEntries(result.sources.map(s=>[s.id,s]));
 assert.equal(byId['nasa-eonet'].status,'active');
 assert.equal(byId['usgs-earthquakes'].status,'cached');
 assert.equal(byId['acled'].status,'active');
 assert.equal(byId['nasa-firms'].status,'active');
 assert.equal(byId['adsb-lol'].status,'active');
 assert.equal(byId['aisstream'].status,'active');
 assert.equal(byId['openstreetmap'].status,'reference');
 assert.equal(byId['ioda-outages'].status,'degraded');
 assert.equal(result.counts.total,result.sources.length);
});

test('missing credentials are explicit and never represented as active',()=>{
 const result=geospatialSourceNetwork({env:{},geoint:{},signals:{},ais:{}});
 const byId=Object.fromEntries(result.sources.map(s=>[s.id,s]));
 for(const id of ['acled','nasa-firms','aisstream']) assert.equal(byId[id].status,'configuration_required');
 assert.equal(byId['nasa-eonet'].status,'not_confirmed');
});

test('stale timestamps are flagged without discarding source state',()=>{
 const old=Date.now()-60*60*1000;
 const result=geospatialSourceNetwork({now:Date.now(),geoint:{updatedAt:old,sources:{eonet:{ok:true,count:1,at:old}}}});
 const source=result.sources.find(s=>s.id==='nasa-eonet');
 assert.equal(source.status,'active');
 assert.equal(source.stale,true);
});
