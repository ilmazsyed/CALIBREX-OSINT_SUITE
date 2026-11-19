import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInvestigationGraphMl } from '../intelligence-graph-export.js';

test('GraphML export retains provenance and safely encodes graph labels and edge metadata',()=>{
 const xml=renderInvestigationGraphMl({
  nodes:[{id:'entity:a',type:'ENTITY',label:'Port <Authority>',sourceEvidenceIds:['e1']} ,{id:'evidence:e1',type:'EVIDENCE',label:'Notice'}],
  edges:[{id:'r1',source:'entity:a',target:'evidence:e1',type:'SUPPORTED_BY',status:'ANALYST_RECORDED',sourceEvidenceIds:['e1'],confidence:88,direction:'DIRECTED',reviewRequired:true}]
 });
 assert.match(xml,/Port &lt;Authority&gt;/);
 assert.match(xml,/sourceEvidenceIds/);
 assert.match(xml,/88/);
 assert.match(xml,/validFrom/); // key declaration remains schema-stable even when no date is populated
});
test('GraphML exporter omits dangling edges',()=>{
 const xml=renderInvestigationGraphMl({nodes:[{id:'n1',label:'Only node'}],edges:[{id:'bad',source:'n1',target:'missing'}]});
 assert.doesNotMatch(xml,/<edge /);
});
