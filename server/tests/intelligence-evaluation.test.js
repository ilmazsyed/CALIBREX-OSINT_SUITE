import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSearchQuality } from '../intelligence-evaluation.js';

test('search quality evaluation reports precision, recall and publication age on a labelled fixture',()=>{
 const now=Date.parse('2026-11-18T12:00:00Z');
 const items=[
  {id:'a',title:'Taiwan port disruption delays semiconductor shipments',published:now-3600000},
  {id:'b',title:'Taiwan port disruption affects cargo schedules',published:now-7200000},
  {id:'c',title:'Football club announces new stadium',published:now-60000},
  {id:'d',title:'Taiwan port disruption update',published:now-20*86400000},
  {id:'e',title:'Taiwan port disruption future report',published:now+5*86400000}
 ];
 const m=evaluateSearchQuality({items,labels:{a:true,b:true,c:false,d:true,e:true},query:'Taiwan port disruption',window:'7d',now,k:5});
 assert.equal(m.totalReturned,2);
 assert.equal(m.precisionAtK,1);
 assert.equal(m.recall,0.5);
 assert.equal(m.staleOrFutureRate,0);
 assert.equal(m.labelledRelevant,4);\n assert.equal(m.truePositiveAtK,2);\n assert.equal(m.falsePositiveAtK,0);\n assert.equal(m.retrievedRelevant,2);\n assert.equal(m.falseNegative,2);
 assert.equal(m.medianPublicationAgeMs,5400000);
 assert.match(m.note,/do not measure truth/);
});

test('empty results and empty labels are handled without NaN',()=>{
 const m=evaluateSearchQuality({items:[],labels:{},query:'port',now:Date.now()});
 assert.equal(m.precisionAtK,0);
 assert.equal(m.recall,0);
 assert.equal(m.medianPublicationAgeMs,null);
});

import { validateAnalystReviewSample, evaluateSyndicationQuality, evaluateReviewedSearchBatch } from '../intelligence-evaluation.js';

test('analyst review samples preserve English, Bengali and Hindi language labels',()=>{
 for(const language of ['en','bn','hi']){
  const sample=validateAnalystReviewSample({language,query:'test query',reviewerId:'reviewer-01',
   reviewedAt:Date.parse('2026-11-18T10:00:00Z'),itemLabels:[{itemId:'item-1',relevant:true,reason:'Matches the query'}]});
  assert.equal(sample.language,language);
  assert.equal(sample.source,'ANALYST_REVIEWED');
 }
});

test('analyst review sample rejects missing provenance and duplicate item labels',()=>{
 assert.throws(()=>validateAnalystReviewSample({language:'bn',query:'খবর',itemLabels:[]}),/reviewerId/);
 assert.throws(()=>validateAnalystReviewSample({language:'hi',query:'समाचार',reviewerId:'r1',reviewedAt:1,
  itemLabels:[{itemId:'x',relevant:true},{itemId:'x',relevant:false}]}),/unique itemId/);
});

test('syndication evaluation reports false-positive and missed-pair rates without intent claims',()=>{
 const m=evaluateSyndicationQuality({candidatePairs:[{leftId:'a',rightId:'b'},{leftId:'c',rightId:'d'}],
  labels:{'a::b':true,'c::d':false,'e::f':true}});
 assert.equal(m.truePositive,1);
 assert.equal(m.falsePositive,1);
 assert.equal(m.falseNegative,1);
 assert.equal(m.precision,0.5);
 assert.equal(m.recall,0.5);
 assert.match(m.note,/do not establish copying/);
});


test('reviewed search batch reports separate language and domain metrics from supplied labels',()=>{
 const now=Date.parse('2026-11-18T12:00:00Z');
 const make=(language,domain,query,labels)=>({sample:validateAnalystReviewSample({language,domain,query,reviewerId:'reviewer-a',
  reviewedAt:now,itemLabels:labels.map(([itemId,relevant])=>({itemId,relevant}))}),
  items:labels.map(([id,relevant])=>({id,title:query+' relevant report',published:now-3600000}))});
 const r=evaluateReviewedSearchBatch([
  make('en','maritime','port closure',[['a',true],['b',false]]),
  make('bn','maritime','বন্দর বন্ধ',[['c',true]])
 ],{now,k:5});
 assert.equal(r.totalSamples,2);
 assert.equal(r.byLanguage.en.sampleCount,1);
 assert.equal(r.byLanguage.bn.sampleCount,1);
 assert.equal(r.byDomain.maritime.sampleCount,2);
 assert.equal(r.overall.labelledRelevant,2);
 assert.match(r.note,/No production accuracy claim/);
});

test('reviewed search batch rejects unprovenanced samples',()=>{
 assert.throws(()=>evaluateReviewedSearchBatch([{sample:{language:'en',query:'test'},items:[]}]),/reviewerId/);
});


test('reviewed evaluation exposes exact micro counts and withholds threshold status on small samples', () => {
 const now=Date.parse('2026-11-18T12:00:00Z');
 const sample={language:'en',query:'port closure',reviewerId:'reviewer-x',reviewedAt:now,
  itemLabels:[{itemId:'a',relevant:true},{itemId:'b',relevant:false}]};
 const report=evaluateReviewedSearchBatch([{sample,items:[
  {id:'a',title:'Port closure disrupts shipping',published:now-3600000},
  {id:'b',title:'Port closure update',published:now-7200000}
 ]}],{now,k:2,minimumSamples:30});
 assert.equal(report.overall.truePositiveAtK,1);
 assert.equal(report.overall.falsePositiveAtK,1);
 assert.equal(report.overall.falseNegative,0);
 assert.equal(report.overall.microPrecisionAtK,0.5);
 assert.equal(report.evaluationStatus,'INSUFFICIENT_REVIEWED_SAMPLES');
 assert.equal(report.byLanguage.en.evaluationStatus,'INSUFFICIENT_REVIEWED_SAMPLES');
});

test('reviewed evaluation marks threshold attainment without claiming representativeness', () => {
 const now=Date.parse('2026-11-18T12:00:00Z');
 const sample={language:'bn',query:'বন্দর বন্ধ',reviewerId:'reviewer-b',reviewedAt:now,
  itemLabels:[{itemId:'a',relevant:true}]};
 const report=evaluateReviewedSearchBatch([{sample,items:[{id:'a',title:'বন্দর বন্ধের খবর',published:now-1000}]}],{now,minimumSamples:1});
 assert.equal(report.evaluationStatus,'SAMPLE_THRESHOLD_MET');
 assert.match(report.note,/not a guarantee of statistical representativeness/);
});
