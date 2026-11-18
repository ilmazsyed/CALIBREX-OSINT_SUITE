import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCollectionFreshness, stampCollectedItems } from '../collection-freshness.js';

test('freshness keeps publication age separate from item collection delay',()=>{
 const now=Date.parse('2026-11-18T12:00:00Z');
 const r=assessCollectionFreshness([
  {id:'a',source:'A',published:now-3600000,collectedAt:now-1800000},
  {id:'b',source:'B',published:now-7200000}
 ],{snapshotAt:now-60000,now,staleAfterMs:6*3600000});
 assert.equal(r.items[0].publicationAgeMs,3600000);
 assert.equal(r.items[0].collectionDelayMs,1800000);
 assert.equal(r.items[1].collectionTimestampType,'FEED_SNAPSHOT_PROXY');
 assert.equal(r.items[1].collectionDelayMs,7140000);
 assert.equal(r.medianPublicationAgeMs,5400000);
 assert.equal(r.unverified,0);
});

test('missing and future publication dates are explicitly unverified and do not create negative delay',()=>{
 const now=1000000;
 const r=assessCollectionFreshness([{id:'missing'},{id:'future',published:now+5000}],{snapshotAt:now,now});
 assert.equal(r.unverified,2);
 assert.equal(r.items[1].publicationDateUnverified,true);
 assert.equal(r.items[1].collectionDelayMs,0);
 assert.equal(r.medianPublicationAgeMs,null);
});

test('feed ingestion stamps collection time without overwriting existing item capture metadata',()=>{
 const source=[{id:'a',published:100},{id:'b',published:200,collectedAt:250}];
 const stamped=stampCollectedItems(source,300);
 assert.equal(stamped[0].collectedAt,300);
 assert.equal(stamped[1].collectedAt,250);
 assert.equal(source[0].collectedAt,undefined);
 assert.equal(stamped[0].collectionTimestampType,undefined);
});
