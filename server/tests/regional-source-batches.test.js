import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseSourceCandidate, validateCandidateMetadata, candidateDuplicate } from '../source-candidates.js';

const ids = [
  'india-central-official-2026-11',
  'west-bengal-official-2026-11',
  'south-asia-official-2026-11',
  'global-multilateral-2026-11',
];
const batches = ids.map(id => JSON.parse(readFileSync(new URL(`../../data/source-candidate-batches/${id}.json`, import.meta.url), 'utf8')));

test('India, West Bengal, South Asia and global candidate batches have valid metadata and safe public endpoints',()=>{
 const endpoints=[];
 for(const batch of batches){
  assert.ok(batch.candidates.length>0,batch.batch);
  assert.equal(batch.candidateCount,batch.candidates.length,batch.batch);
  for(const [index,input] of batch.candidates.entries()){
   const row=normaliseSourceCandidate(input,`batch-${batch.region.replace(/\\W/g,'-')}-${index+1}`);
   assert.deepEqual(validateCandidateMetadata(row),[],row.name);
   assert.equal(row.status,'pending_validation');
   assert.equal(row.licence,'review-required');
   assert.ok(row.endpoint.startsWith('https://') || row.endpoint.startsWith('http://'),row.name);
   assert.ok(!/[?&](api[_-]?key|token|secret)=/i.test(row.endpoint),row.name);
   assert.ok(!row.endpoint.includes('@'),row.name);
   assert.equal(candidateDuplicate(endpoints,row),undefined,row.name);
   endpoints.push(row);
  }
 }
});

test('West Bengal records carry explicit subdivision attribution and global batch does not invent countries',()=>{
 const west=batches.find(batch=>batch.batch.startsWith('West Bengal'));
 assert.ok(west.candidates.every(row=>row.country==='IN'&&row.subdivision==='West Bengal'));
 const global=batches.find(batch=>batch.batch.startsWith('Global'));
 assert.ok(global.candidates.some(row=>row.country==null));
 assert.ok(global.candidates.some(row=>row.country==='IN'));
});
