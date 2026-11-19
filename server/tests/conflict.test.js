import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterConflictReports, eventHeadlineSimilarity } from '../conflict.js';

const place = { name:'Kulgam', lat:33.64, lng:75.02 };

test('similar reporting about one named event can form a candidate cluster', () => {
  const now=Date.now();
  const rows=[
    {id:'a',title:'Security forces conduct search operation after encounter in Kulgam',url:'https://a.example/story',source:'A',published:now-1000,severity:'HIGH',place,wire:'INDIA'},
    {id:'b',title:'Search operation follows encounter reported in Kulgam',url:'https://b.example/story',source:'B',published:now,severity:'MEDIUM',place,wire:'INDIA'}
  ];
  const [cluster]=clusterConflictReports(rows,now);
  assert.equal(cluster.reportCount,2);
  assert.equal(cluster.publisherDomainCount,2);
  assert.equal(cluster.eventClusterStatus,'CANDIDATE_NOT_VERIFIED');
  assert.equal(cluster.locationPrecision,'GAZETTEER_PLACE_CENTROID');
  assert.equal(cluster.severity,'HIGH');
  assert.equal(cluster.severityBasis,'HIGHEST_SOURCE_HEADLINE_CLASSIFICATION');
});

test('different events at the same place do not become one incident merely due to shared geography', () => {
  const now=Date.now();
  const rows=[
    {id:'a',title:'Encounter reported after militant attack in Kulgam',url:'https://a.example/story',published:now-1000,severity:'HIGH',place},
    {id:'b',title:'Political leaders criticise internet restrictions in Kulgam',url:'https://b.example/story',published:now,severity:'LOW',place}
  ];
  assert.equal(clusterConflictReports(rows,now).length,2);
});

test('different headlines in same place remain distinct; volume never inflates severity', () => {
  const now=Date.now();
  const rows=Array.from({length:8},(_,i)=>({id:String(i),title:'Unrest and protest reporting in Kulgam item '+i,url:'https://publisher'+i+'.example/story',published:now-i*1000,severity:'LOW',place}));
  const clusters=clusterConflictReports(rows,now);
  assert.equal(clusters.length,1);
  assert.equal(clusters[0].severity,'LOW');
  assert.equal(clusters[0].reportCount,8);
});

test('headline similarity is bounded and does not infer common event from geography', () => {
  assert.ok(eventHeadlineSimilarity('Encounter reported in Kulgam','Encounter reported in Kulgam') > 0.9);
  assert.equal(eventHeadlineSimilarity('Flood warning in Kulgam','Court hearing in Kulgam'),0);
});
