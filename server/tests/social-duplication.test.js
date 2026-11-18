import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSocialDuplicateCandidates } from '../social-duplication.js';

test('detects near-identical Bengali and Hindi social text across accounts as review leads',()=>{
 const items=[
  {id:'bn1',kind:'social',authorId:'account-1',source:'Public channel A',published:100000,title:'বাংলার সীমান্তে নতুন নিরাপত্তা ব্যবস্থা ঘোষণা করেছে প্রশাসন আজ'},
  {id:'bn2',kind:'social',authorId:'account-2',source:'Public channel B',published:101000,title:'বাংলার সীমান্তে নতুন নিরাপত্তা ব্যবস্থা ঘোষণা করেছে প্রশাসন আজ'},
  {id:'hi1',kind:'social',authorId:'account-3',source:'Public channel C',published:102000,title:'सीमा पर नई सुरक्षा व्यवस्था प्रशासन ने आज घोषित की है'}
 ];
 const r=detectSocialDuplicateCandidates(items,{windowMs:60000,similarityThreshold:.75});
 assert.equal(r.totalCandidates,1);
 assert.equal(r.pairs[0].classification,'CROSS_ACCOUNT_NEAR_DUPLICATE');
 assert.equal(r.pairs[0].independentCorroboration,false);
 assert.equal(r.pairs[0].reviewRequired,true);
});

test('same-account repeats are distinguished from cross-account matches',()=>{
 const text='Port authorities announce temporary closure after severe weather warning today';
 const r=detectSocialDuplicateCandidates([
  {id:'a',kind:'social',authorId:'same',published:1000,title:text},
  {id:'b',kind:'social',authorId:'same',published:2000,title:text}
 ],{windowMs:5000});
 assert.equal(r.pairs[0].classification,'SAME_ACCOUNT_REPEAT');
});

test('unrelated text and non-social records do not become candidates',()=>{
 const r=detectSocialDuplicateCandidates([
  {id:'a',kind:'social',authorId:'x',published:1000,title:'Port authorities announce temporary closure after severe weather warning'},
  {id:'b',kind:'social',authorId:'y',published:2000,title:'Football club signs new goalkeeper after league season ends'},
  {id:'c',kind:'news',authorId:'z',published:2000,title:'Port authorities announce temporary closure after severe weather warning'}
 ]);
 assert.equal(r.totalCandidates,0);
});
