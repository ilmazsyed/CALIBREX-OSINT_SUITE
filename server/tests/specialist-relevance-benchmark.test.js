import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSpecialistRelevance } from '../specialist-operations.js';

const cases=[
 {role:'DEFENCE_IW',focus:'PLA military exercise Taiwan',title:'PLA conducts military exercises near Taiwan',expected:'RELEVANT'},
 {role:'DEFENCE_IW',focus:'PLA military exercise Taiwan',title:'Russian military plane crashes in Siberia',expected:'UNRELATED'},
 {role:'CORPORATE_RISK',focus:'Acme Industries regulatory investigation',title:'Acme Industries faces regulatory investigation',expected:'RELEVANT'},
 {role:'CORPORATE_RISK',focus:'Acme Industries regulatory investigation',title:'Acme Industries launches new product',expected:'PARTIAL'},
 {role:'SUPPLY_CHAIN',focus:'semiconductor shipments Taiwan port disruption',title:'Taiwan port disruption delays semiconductor shipments',expected:'RELEVANT'},
 {role:'SUPPLY_CHAIN',focus:'semiconductor shipments Taiwan port disruption',title:'Football club announces new stadium',expected:'UNRELATED'},
 {role:'GEOPOLITICAL',focus:'China Bangladesh port influence',title:'China-backed port project expands in Bangladesh',expected:'PARTIAL'},
 {role:'GEOPOLITICAL',focus:'China Bangladesh port influence',title:'European football championship final',expected:'UNRELATED'},
 {role:'STRATEGIC',focus:'India inflation energy policy',title:'India inflation outlook shaped by energy policy',expected:'RELEVANT'},
 {role:'STRATEGIC',focus:'India inflation energy policy',title:'Celebrity announces new film',expected:'UNRELATED'}
];

test('labelled relevance benchmark covers all five specialist domains',()=>{
 const outcomes=cases.map(c=>({...c,actual:scoreSpecialistRelevance({title:c.title},{focus:c.focus}).band}));
 const relevant=outcomes.filter(x=>x.expected==='RELEVANT');
 const predicted=outcomes.filter(x=>x.actual==='RELEVANT');
 const tp=outcomes.filter(x=>x.expected==='RELEVANT'&&x.actual==='RELEVANT').length;
 const precision=predicted.length?tp/predicted.length:0;
 const recall=relevant.length?tp/relevant.length:0;
 assert.ok(outcomes.some(x=>x.role==='DEFENCE_IW'));
 assert.ok(outcomes.some(x=>x.role==='CORPORATE_RISK'));
 assert.ok(outcomes.some(x=>x.role==='SUPPLY_CHAIN'));
 assert.ok(outcomes.some(x=>x.role==='GEOPOLITICAL'));
 assert.ok(outcomes.some(x=>x.role==='STRATEGIC'));
 assert.ok(precision>=0.8,JSON.stringify({precision,recall,outcomes}));
 assert.ok(recall>=0.8,JSON.stringify({precision,recall,outcomes}));
 assert.ok(outcomes.filter(x=>x.expected==='UNRELATED').every(x=>x.actual==='UNRELATED'),JSON.stringify(outcomes));
});

test('geography-only overlap is partial, never a direct relevance claim',()=>{
 const r=scoreSpecialistRelevance({title:'Bangladesh nuclear power plant enters a new phase'},{focus:'Bangladesh Hasina Awami League'});
 assert.equal(r.band,'PARTIAL');
 assert.ok(r.reasons.some(x=>/Geographic context match/.test(x)));
});
