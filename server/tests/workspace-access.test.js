import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceRole, canWorkspace, normaliseWorkspaceMemberRole } from '../workspace-access.js';

test('workspace roles enforce view, edit and member administration boundaries',()=>{
  for(const role of ['owner','admin','analyst','viewer']) assert.equal(canWorkspace(role,'view'),true);
  for(const role of ['owner','admin','analyst']) assert.equal(canWorkspace(role,'edit'),true);
  assert.equal(canWorkspace('viewer','edit'),false);
  for(const role of ['owner','admin']) assert.equal(canWorkspace(role,'manage'),true);
  assert.equal(canWorkspace('analyst','manage'),false);
  assert.equal(canWorkspace('viewer','manage'),false);
  assert.equal(canWorkspace(null,'view'),false);
});
test('workspace role lookup fails closed for non-members',()=>{
 const w={members:[{userId:'u1',role:'owner'},{userId:'u2',role:'viewer'}]};
 assert.equal(workspaceRole(w,'u1'),'owner');assert.equal(workspaceRole(w,'u2'),'viewer');assert.equal(workspaceRole(w,'outsider'),null);assert.equal(workspaceRole(null,'u1'),null);
});
test('unknown invite roles default to analyst',()=>{assert.equal(normaliseWorkspaceMemberRole('viewer'),'viewer');assert.equal(normaliseWorkspaceMemberRole('owner'),'analyst');});
