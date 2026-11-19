import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowTasks, recordWorkflowTaskChanges } from '../investigation-workflow.js';

test('validates task due dates, ownership, descriptions and dependency references',()=>{
 const r=validateWorkflowTasks([
  {id:'a',title:'Collect imagery',description:'Acquire official satellite reference',ownerId:'analyst-1',status:'IN_PROGRESS',priority:'HIGH',dueAt:'2026-11-22T12:00:00Z'},
  {id:'b',title:'Review imagery',dependsOn:['a'],dueAt:null}
 ]);
 assert.equal(r.valid,true);
 assert.equal(r.tasks[0].dueAt,Date.parse('2026-11-22T12:00:00Z'));
 assert.deepEqual(r.tasks[1].dependsOn,['a']);
 assert.equal(r.summary.total,2);
});

test('rejects missing titles, unknown dependencies, self-dependencies and cycles',()=>{
 const r=validateWorkflowTasks([
  {id:'a',title:'',dependsOn:['b']},
  {id:'b',title:'Task B',dependsOn:['a']},
  {id:'c',title:'Task C',dependsOn:['c','missing']}
 ]);
 assert.equal(r.valid,false);
 assert.ok(r.errors.some(e=>e.code==='TASK_TITLE_REQUIRED'));
 assert.ok(r.errors.some(e=>e.code==='DEPENDENCY_CYCLE'));
 assert.ok(r.errors.some(e=>e.code==='SELF_DEPENDENCY'));
 assert.ok(r.errors.some(e=>e.code==='UNKNOWN_DEPENDENCY'));
});

test('records bounded added, updated and removed task audit events',()=>{
 const before=[{id:'a',title:'Collect evidence',status:'OPEN',priority:'NORMAL'}];
 const after=[{id:'a',title:'Collect evidence',status:'DONE',priority:'HIGH'},{id:'b',title:'Review evidence',status:'OPEN'}];
 const history=recordWorkflowTaskChanges(before,after,{id:'analyst-1',role:'analyst'},[]);
 assert.equal(history.length,2);
 assert.ok(history.some(e=>e.action==='UPDATED'&&e.taskId==='a'&&e.changedFields.includes('status')));
 assert.ok(history.some(e=>e.action==='ADDED'&&e.taskId==='b'));
 const removed=recordWorkflowTaskChanges(after,before,{id:'analyst-1',role:'analyst'},history);
 assert.ok(removed.some(e=>e.action==='REMOVED'&&e.taskId==='b'));
});

test('task audit history is capped at 200 entries',()=>{
 const history=Array.from({length:200},(_,i)=>({id:'old-'+i}));
 const result=recordWorkflowTaskChanges([], [{id:'new',title:'New task'}], {id:'u'}, history);
 assert.equal(result.length,200);
 assert.equal(result.at(-1).action,'ADDED');
});
