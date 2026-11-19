import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvestigationGraph } from '../intelligence-graph.js';

test('graph preserves explicit entity-to-evidence provenance links', () => {
  const graph = buildInvestigationGraph({
    entities: [{ id: 'e1', name: 'Example Port Authority', type: 'ORGANIZATION', resolution: 'CANDIDATE', sourceEvidenceIds: ['s1'] }],
    evidence: [{ id: 's1', title: 'Port authority notice', url: 'https://example.org/notice?utm_source=test', source: 'Example', published: 1000, capturedAt: 2000 }],
    relationships: []
  });
  assert.equal(graph.summary.entityCount, 1);
  assert.equal(graph.summary.evidenceCount, 1);
  assert.equal(graph.edges[0].type, 'SUPPORTED_BY');
  assert.equal(graph.nodes.find(x => x.id === 'evidence:s1').url, 'https://example.org/notice');
});

test('analyst relationships remain distinct from machine-suggested candidate links', () => {
  const graph = buildInvestigationGraph({
    entities: [{ id: 'a', name: 'Entity A' }, { id: 'b', name: 'Entity B' }],
    evidence: [{ id: 's1', title: 'A very similar report about a port closure', url: 'https://a.example/story' },
      { id: 's2', title: 'A very similar report about a port closure', url: 'https://b.example/story' }],
    relationships: [{ id: 'r1', from: 'a', to: 'b', type: 'ASSOCIATED_WITH', rationale: 'Analyst recorded link', sourceEvidenceIds: ['s1'], confidence: 76, validFrom: '2026-01-01T00:00:00Z', directed: false }]
  });
  assert.ok(graph.edges.some(x => x.status === 'ANALYST_RECORDED'));
  const candidate = graph.edges.find(x => x.status === 'MACHINE_SUGGESTED');
  assert.ok(candidate);
  assert.equal(candidate.independentCorroboration, false);
  assert.equal(candidate.reviewRequired, true);
});

test('hypothesis references are constrained to evidence in the same case', () => {
  const graph = buildInvestigationGraph({
    evidence: [{ id: 'valid', title: 'Evidence' }],
    hypotheses: [{ id: 'h1', text: 'Hypothesis', evidenceIds: ['valid', 'foreign'] }]
  });
  const refs = graph.edges.filter(x => x.source === 'hypothesis:h1');
  assert.deepEqual(refs.map(x => x.target), ['evidence:valid']);
});

test('graph rejects unsafe URLs and bounds node and edge counts', () => {
  const evidence = Array.from({ length: 100 }, (_, i) => ({ id: 's' + i, title: 'Repeated port closure report ' + i, url: 'javascript:alert(1)' }));
  const graph = buildInvestigationGraph({ evidence }, { maxNodes: 50, maxEdges: 100 });
  assert.ok(graph.nodes.length <= 50);
  assert.ok(graph.edges.length <= 100);
  assert.ok(graph.nodes.every(x => x.url === null));
  assert.ok(graph.summary.truncated);
});

test('candidate grouping never labels repeated reporting as corroboration', () => {
  const graph = buildInvestigationGraph({ evidence: [
    { id: 'a', title: 'Border exercise announced by officials', url: 'https://one.example/a' },
    { id: 'b', title: 'Border exercise announced by officials', url: 'https://two.example/b' }
  ] });
  assert.equal(graph.summary.candidateEdges, 1);
  assert.equal(graph.edges[0].independentCorroboration, false);
});

test('graph exposes candidate entity identity links separately from evidence correlations',()=>{
 const graph=buildInvestigationGraph({
  entities:[
   {id:'person-a',name:'Jonathan Smith',aliases:['Jon Smith'],type:'PERSON',sourceEvidenceIds:['s1']},
   {id:'person-b',name:'Jonathon Smith',type:'PERSON',sourceEvidenceIds:['s2']}
  ],
  evidence:[
   {id:'s1',title:'Port fire reported',url:'https://one.example/a',published:1000000,lat:22.57,lon:88.36},
   {id:'s2',title:'Port incident update',url:'https://two.example/b',published:4600000,lat:22.571,lon:88.361}
  ]
 });
 assert.ok(graph.edges.some(e=>e.type==='ENTITY_IDENTITY_CANDIDATE'&&e.reviewRequired&&e.autoMerged===false));
 assert.ok(graph.edges.some(e=>e.type==='EVIDENCE_CORRELATION_CANDIDATE'&&e.independentCorroboration===false));
 assert.equal(graph.summary.entityIdentityCandidates,1);
 assert.equal(graph.summary.evidenceCorrelationCandidates,1);
});

test('analyst graph edges require case-local evidence provenance and retain temporal confidence',()=>{
 const graph=buildInvestigationGraph({
  entities:[{id:'a',name:'Entity A'},{id:'b',name:'Entity B'}],
  evidence:[{id:'s1',title:'Supporting record'}],
  relationships:[
   {id:'unproven',from:'a',to:'b',type:'ASSOCIATED_WITH'},
   {id:'proven',from:'a',to:'b',type:'ASSOCIATED_WITH',sourceEvidenceIds:['s1'],confidence:120,validFrom:'2026-01-01T00:00:00Z',directed:false}
  ]
 });
 const edges=graph.edges.filter(e=>e.status==='ANALYST_RECORDED');
 assert.equal(edges.length,1);
 assert.deepEqual(edges[0].sourceEvidenceIds,['s1']);
 assert.equal(edges[0].provenanceComplete,true);
 assert.equal(edges[0].confidence,100);
 assert.equal(edges[0].direction,'UNDIRECTED');
 assert.equal(edges[0].validFrom,'2026-01-01T00:00:00.000Z');
});
