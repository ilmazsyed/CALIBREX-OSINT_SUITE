import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIALIST_COLLECTION_PLANS,collectSpecialistData,runSpecialistAssessment,mergeSpecialistWorkspace,filterSpecialistFeedItems,ingestSpecialistFeedSnapshot,scoreSpecialistRelevance} from '../specialist-operations.js';

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

test('opt-in monitor ingests only matching existing feed items',()=>{
 const r=ingestSpecialistFeedSnapshot({role:'DEFENCE_IW',feedItems:[{id:'1',title:'Military exercise announced',url:'https://example.com/a',source:'Example',published:1000},{id:'2',title:'Quarterly earnings beat',url:'https://example.com/b',source:'Example',published:1000}]});
 assert.equal(r.observations.length,1);
 assert.equal(r.collection.sourceMode,'AUTOMATIC_EXISTING_FEED_CAPTURE');
});
test('focused collection appends subject terms to each search query',async()=>{
 const seen=[];
 await collectSpecialistData({role:'CORPORATE_RISK',focus:'Acme Industries CIN U12345',searchNews:async q=>{seen.push(q);return [];}});
 assert.ok(seen.every(q=>q.includes('Acme Industries CIN U12345')));
});

test('official government publisher evidence retains its evidence class',async()=>{
 const r=await collectSpecialistData({role:'DEFENCE_IW',searchNews:async()=>[{title:'Defence ministry announces exercise',source:'Ministry',url:'https://pib.gov.in/story',published:Date.now()}]});
 assert.equal(r.observations[0].evidenceType,'OFFICIAL_STATEMENT');
});
test('defence assessment includes the six-lane defence brief',()=>{
 const r=runSpecialistAssessment('DEFENCE_IW',{observations:[{id:'d1',title:'Exercise announced',source:'Defence',sourceDomain:'pib.gov.in',url:'https://pib.gov.in/a',publishedAt:Date.now(),eventType:'EXERCISE',kind:'NEWS',evidenceType:'OFFICIAL_STATEMENT'}]});
 assert.equal(r.defenceBrief.scope,'OPEN_SOURCE_STRATEGIC_LEVEL');
 assert.equal(r.defenceBrief.domains.EXERCISE.observedSignals,1);
});
test('strategic assessment carries World Bank macro indicators into the assessment',()=>{
 const r=runSpecialistAssessment('STRATEGIC',{observations:[],macroIndicators:[{id:'gdp',name:'GDP growth',value:6,period:'2025',source:'World Bank'}]});
 assert.equal(r.macroIndicators[0].value,6);
});

test('South China Sea focus excludes unrelated defence headlines and ranks direct matches',()=>{
 const focus='Whats happening in the South China Sea';
 const direct=scoreSpecialistRelevance({title:'Chinese coast guard activity reported near Spratly Islands in South China Sea'},{focus,identifier:'China, India, Bangladesh'});
 const adjacent=scoreSpecialistRelevance({title:'Taiwan Strait military exercise announced'},{focus,identifier:'China, India, Bangladesh'});
 const unrelated=scoreSpecialistRelevance({title:'US strikes Iranian missile site near Strait of Hormuz'},{focus,identifier:'China, India, Bangladesh'});
 assert.equal(direct.band,'RELEVANT');
 assert.notEqual(unrelated.band,'RELEVANT');
 assert.equal(unrelated.band,'UNRELATED');
 assert.ok(direct.score>adjacent.score);
});
test('focused collection filters unrelated shared-feed stories and exposes relevance metadata',async()=>{
 const feedItems=[
  {title:'South China Sea coast guard encounter reported',source:'Example A',url:'https://example.com/scs',published:3000},
  {title:'US strikes Iranian missile site near Strait of Hormuz',source:'Example B',url:'https://example.com/hormuz',published:4000},
  {title:'NATO exercise in Norway',source:'Example C',url:'https://example.com/nato',published:5000}
 ];
 const r=await collectSpecialistData({role:'DEFENCE_IW',focus:'What is happening in the South China Sea',identifier:'China, India, Bangladesh',searchNews:async()=>[],feedItems});
 assert.equal(r.observations.length,1);
 assert.equal(r.observations[0].relevanceBand,'RELEVANT');
 assert.equal(r.collection.excludedUnrelated,2);
});
test('article body capture status is explicit for headline-only evidence',async()=>{
 const r=await collectSpecialistData({role:'DEFENCE_IW',focus:'South China Sea',searchNews:async()=>[{title:'South China Sea patrol reported',source:'Example',url:'https://example.com/scs',published:3000}],readArticle:async()=>null});
 assert.equal(r.observations[0].articleBodyCaptured,false);
 assert.equal(r.collection.articleBodies,0);
});

test('country-only focus is geographic context, not an automatic direct intelligence match',()=>{
 const r=scoreSpecialistRelevance({title:'Bangladesh connects its first nuclear power plant to national grid'},{focus:'Whats happening in Bangladesh',identifier:'Bangladesh'});
 assert.equal(r.band,'PARTIAL');
 assert.match(r.reasons[0],/Geographic match only/);
});
test('collection tags evidence to a stable investigation scope and reports article-read failures',async()=>{
 const args={role:'DEFENCE_IW',focus:'Bangladesh',identifier:'Bangladesh',country:'BGD',searchNews:async()=>[{title:'Bangladesh defence policy update',source:'Example',url:'https://example.com/bd',published:1000}],readArticle:async()=>{throw new Error('Publisher blocks automated reading.')}};
 const a=await collectSpecialistData(args),b=await collectSpecialistData(args);
 assert.equal(a.observations[0].investigationKey,b.observations[0].investigationKey);
 assert.equal(a.observations[0].relevanceBand,'PARTIAL');
 assert.equal(a.observations[0].articleReadStatus,'FAILED');
 assert.match(a.observations[0].articleReadError,/blocks automated reading/);
 assert.equal(a.collection.articleReadFailures,1);
});
test('workspace merge activates the new investigation without deleting historical evidence',()=>{
 const old={observations:[{id:'old',investigationKey:'old-scope'}],collectionHistory:[],assessments:[]};
 const next={observations:[{id:'new',investigationKey:'new-scope'}],collection:{startedAt:2,investigationKey:'new-scope'}};
 const merged=mergeSpecialistWorkspace(old,next);
 assert.equal(merged.observations.length,2);
 assert.equal(merged.activeInvestigationKey,'new-scope');
 assert.deepEqual(merged.observations.filter(x=>x.investigationKey===merged.activeInvestigationKey).map(x=>x.id),['new']);
});

test('article extraction cap is disclosed rather than implying a publisher failure',async()=>{
 const hits=Array.from({length:21},(_,i)=>({title:'Defence development '+i,source:'Example '+i,url:'https://example.com/story-'+i,published:1000+i}));
 const r=await collectSpecialistData({role:'DEFENCE_IW',searchNews:async()=>hits,readArticle:async url=>({url,title:'Readable article',siteName:'Example',text:'A'.repeat(100),published:1000})});
 assert.equal(r.collection.articleReadAttempts,20);
 assert.equal(r.collection.articleReadNotAttempted,1);
 assert.equal(r.observations.find(x=>x.url==='https://example.com/story-0').articleReadStatus,'NOT_ATTEMPTED');
});
