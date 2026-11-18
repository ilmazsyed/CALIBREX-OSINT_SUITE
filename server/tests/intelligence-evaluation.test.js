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
 assert.equal(m.labelledRelevant,4);
 assert.equal(m.medianPublicationAgeMs,7200000);
 assert.match(m.note,/do not measure truth/);
});

test('empty results and empty labels are handled without NaN',()=>{
 const m=evaluateSearchQuality({items:[],labels:{},query:'port',now:Date.now()});
 assert.equal(m.precisionAtK,0);
 assert.equal(m.recall,0);
 assert.equal(m.medianPublicationAgeMs,null);
});
