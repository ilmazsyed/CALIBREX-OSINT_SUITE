import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSourceLineage } from '../source-lineage.js';

test('detects same canonical URL after tracking parameters are removed', () => {
  const result = analyzeSourceLineage([
    { id: 'a', url: 'https://www.example.com/story?utm_source=x', title: 'Story' },
    { id: 'b', url: 'https://example.com/story#top', title: 'Story repost' }
  ]);
  assert.equal(result.candidateRelationshipCount, 1);
  assert.ok(result.candidateRelationships[0].signals.some(x => x.reason === 'SAME_CANONICAL_URL'));
  assert.equal(result.candidateRelationships[0].independentCorroboration, false);
});

test('detects exact captured-content fingerprints without claiming independent origin', () => {
  const content = 'A sufficiently long captured article body used as a deterministic fingerprint. '.repeat(4);
  const result = analyzeSourceLineage([
    { id: 'wire', url: 'https://wire.example/a', contentSnapshot: content },
    { id: 'publisher', url: 'https://publisher.example/b', contentSnapshot: content }
  ]);
  assert.ok(result.candidateRelationships[0].signals.some(x => x.reason === 'EXACT_CONTENT_FINGERPRINT'));
  assert.equal(result.unknownOriginCount, 2);
  assert.equal(result.candidateRelationships[0].independentCorroboration, false);
});

test('groups explicit upstream attribution but leaves unknown origin unresolved', () => {
  const result = analyzeSourceLineage([
    { id: 'a', url: 'https://a.example/1', syndicatedFrom: 'Reuters' },
    { id: 'b', url: 'https://b.example/2', syndicatedFrom: 'Reuters' },
    { id: 'c', url: 'https://c.example/3' }
  ]);
  assert.equal(result.knownDeclaredOriginCount, 1);
  assert.equal(result.unknownOriginCount, 1);
  assert.ok(result.candidateRelationships.some(x => x.signals.some(s => s.reason === 'SHARED_DECLARED_UPSTREAM_ORIGIN')));
});

test('detects near duplicate articles as review candidates, not corroboration', () => {
  const body = ('The port authority announced a temporary restriction after a cargo vessel reported a mechanical issue near the eastern approach. Officials said inspections would continue through the evening and shipping operators were advised to check updated notices. ').repeat(3);
  const altered = body.replace('temporary restriction', 'short-term restriction').replace('eastern approach', 'approach to the east');
  const result = analyzeSourceLineage([
    { id: 'one', url: 'https://one.example/a', title: 'Port authority announces temporary restriction', contentSnapshot: body },
    { id: 'two', url: 'https://two.example/b', title: 'Port authority announces short-term restriction', contentSnapshot: altered }
  ]);
  assert.ok(result.candidateRelationships.some(x => x.signals.some(s => ['NEAR_DUPLICATE_BODY', 'SIMILAR_HEADLINE_AND_BODY'].includes(s.reason))));
  assert.ok(result.candidateRelationships.every(x => x.reviewRequired && x.independentCorroboration === false));
});

test('caps pairwise workload and reports truncation', () => {
  const records = Array.from({ length: 6 }, (_, i) => ({ id: String(i), url: 'https://example.com/' + i }));
  const result = analyzeSourceLineage(records, { maxRecords: 3 });
  assert.equal(result.recordCount, 3);
  assert.equal(result.truncated, true);
});
