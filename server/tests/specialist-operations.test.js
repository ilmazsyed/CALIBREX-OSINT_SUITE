import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALIST_COLLECTION_PLANS,collectSpecialistData,runSpecialistAssessment,mergeSpecialistWorkspace,filterSpecialistFeedItems} from '../specialist-operations.js';

test('all five specialist roles have bounded public-source collection plans',()=>{
 for(const role of ['DEFENCE_IW','CORPORATE_RISK','SUPPLY_CHAIN','GEOPOLITICAL','STRATEGIC']){
  assert.ok(SPECIALIST_COLLECTION_PLANS[role].length>=2);
 }
});
test('collection preserves publisher provenance and captures article bodies when readable',async()=>{
 const r=await collectSpecialistData({role:'DEFENCE_IW',searchNews:async q=>[{title:'Defence exercise announced',source:'Example News',url:'https://example.com/story',published:1000}],feedItems:[],readArticle:async()=>({url:'https://example.com/story',title:'Defence exercise announced',siteName:'Example News',text:'A'.repeat(100),published:1000})});
 assert.equal(r.observations.length,1);
 assert.equal(r.observations[0].source,'Example News');
 assert.equal(r.observations[0].url,'https://example.com/story');
 assert.ok(r.observations[0].provenance.contentHash);
 assert.equal(r.collection.articleBodies,1);
});
test('collection tolerates partial provider failure without fabricating results',async()=>{
 const r=await collectSpecialistData({role:'CORPORATE_RISK',searchNews:async(q)=>{if(q.includes('filings'))throw new Error('offline');return [];}});
 assert.equal(r.observations.length,0);
 assert.ok(r.collection.failedQueries>=1);
});
test('role assessment consumes collected evidence and returns role-specific assessment',()=>{
 const obs=[{id:'1',title:'Joint military exercise',text:'',url:'https://example.org/a',source:'Example',sourceDomain:'example.org',publishedAt:Date.now(),eventType:'EXERCISE',kind:'NEWS',assessment:'CLAIM',evidenceType:'MEDIA_REPORT'}];
 const r=runSpecialistAssessment('DEFENCE_IW',{observations:obs});
 assert.equal(r.role,'DEFENCE_IW');
 assert.equal(r.laneCoverage.EXERCISE,1);
 assert.equal(r.claims[0].status,'UNASSESSED');
});
test('workspace merge deduplicates evidence by stable observation id and caps history',()=>{
 const old={observations:[{id:'a',capturedAt:1}],collectionHistory:[],assessments:[]};
 const next={observations:[{id:'a',capturedAt:2},{id:'b',capturedAt:3}],collection:{startedAt:4}};
 const merged=mergeSpecialistWorkspace(old,next);
 assert.equal(merged.observations.length,2);
 assert.equal(merged.observations.find(x=>x.id==='a').capturedAt,2);
 assert.equal(merged.collectionHistory.length,1);
});
test('feed filtering is role-specific and bounded',()=>{
 const items=[{title:'Port closure disrupts shipping'},{title:'Election results announced'},{title:'Company faces regulator probe'}];
 assert.equal(filterSpecialistFeedItems('SUPPLY_CHAIN',items).length,1);
 assert.equal(filterSpecialistFeedItems('CORPORATE_RISK',items).length,1);
});
