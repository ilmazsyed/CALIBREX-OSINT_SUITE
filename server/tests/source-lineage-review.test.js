import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceLineageReview } from '../source-lineage-review.js';

const candidate={evidenceIds:['ev-b','ev-a'],signals:[{reason:'NEAR_DUPLICATE_BODY',strength:'REVIEW_CANDIDATE',score:0.9}]};
test('records explicit analyst acceptance without turning it into corroboration',()=>{
 const review=createSourceLineageReview({candidate,decision:'ACCEPTED',rationale:'Same wire copy after direct source comparison.',actor:'analyst-1',now:100});
 assert.deepEqual(review.evidenceIds,['ev-a','ev-b']);
 assert.equal(review.decision,'ACCEPTED');
 assert.equal(review.independentCorroboration,false);
 assert.equal(review.candidateReviewOnly,true);
});
test('rejects incomplete or unauthenticated adjudication',()=>{
 assert.throws(()=>createSourceLineageReview({candidate,decision:'ACCEPTED',rationale:'too short',actor:'a'}),/12 characters/);
 assert.throws(()=>createSourceLineageReview({candidate,decision:'ACCEPTED',rationale:'Sufficient review rationale.',actor:''}),/authenticated analyst/);
 assert.throws(()=>createSourceLineageReview({candidate:{evidenceIds:['a','a']},decision:'ACCEPTED',rationale:'Sufficient review rationale.',actor:'a'}),/two-item/);
});
