import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSourceReliability, assessSourceIndependence } from '../source-reliability.js';

test('live specialist source categories map to reliability taxonomy', () => {
  const official=assessSourceReliability({url:'https://pib.gov.in/release',sourceType:'OFFICIAL_PUBLIC_SOURCE',provenanceStatus:'SOURCE_CAPTURED',contentSnapshot:'captured',published:'2026-11-20',capturedAt:Date.parse('2026-11-20T01:00:00Z')});
  const media=assessSourceReliability({url:'https://news.example/story',sourceType:'MEDIA_REPORT',provenanceStatus:'SOURCE_LINK_ONLY',published:'2026-11-20',capturedAt:Date.parse('2026-11-20T01:00:00Z')});
  const social=assessSourceReliability({url:'https://bsky.app/profile/x/post/1',sourceType:'SOCIAL_POST',provenanceStatus:'SOURCE_LINK_ONLY'});
  const sourceNature=value=>value.factors.find(x=>x.name==='sourceNature').score;
  assert.equal(sourceNature(official),90); assert.equal(sourceNature(media),70); assert.equal(sourceNature(social),35);
});

test('subdomains and common country-code publisher domains are not double-counted', () => {
  const result=assessSourceIndependence([{id:'a',url:'https://www.example.co.uk/a'},{id:'b',url:'https://regional.example.co.uk/b'},{id:'c',url:'https://other.example.com/c'}]);
  assert.equal(result.distinctPublisherGroupCount,2); assert.equal(result.independentGroupCount,0); assert.equal(result.independenceStatus,'NOT_ESTABLISHED');
});
