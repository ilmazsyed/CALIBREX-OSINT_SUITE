import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMcp } from '../mcp.js';

function fakeApp() {
  const routes=[];
  return { routes, get:(path,...handlers)=>routes.push(['GET',path,handlers.length]), post:(path,...handlers)=>routes.push(['POST',path,handlers.length]) };
}

test('MCP gateway stays disabled unless explicitly enabled', () => {
  const prior=process.env.MCP_ENABLED;
  const priorUrl=process.env.PUBLIC_URL;
  process.env.MCP_ENABLED='false';
  process.env.PUBLIC_URL='https://app.calibrex.org';
  const app=fakeApp();
  mountMcp(app,{store:{},authenticate:()=>{},snapshot:()=>({items:[]}),listCases:async()=>[],getCase:async()=>null,createCase:async()=>null,updateCase:async()=>null,listWorkspaces:async()=>[]});
  assert.equal(app.routes.length,0);
  if(prior===undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED=prior;
  if(priorUrl===undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL=priorUrl;
});

test('enabled MCP gateway registers OAuth metadata and protected tool transport', () => {
  const prior=process.env.MCP_ENABLED;
  const priorUrl=process.env.PUBLIC_URL;
  process.env.MCP_ENABLED='true';
  process.env.PUBLIC_URL='https://app.calibrex.org';
  const app=fakeApp();
  mountMcp(app,{store:{},authenticate:()=>{},snapshot:()=>({items:[]}),listCases:async()=>[],getCase:async()=>null,createCase:async()=>null,updateCase:async()=>null,listWorkspaces:async()=>[]});
  const paths=app.routes.map(x=>x[1]);
  assert.ok(paths.includes('/.well-known/oauth-protected-resource/mcp'));
  assert.ok(paths.includes('/.well-known/oauth-authorization-server'));
  assert.ok(paths.includes('/api/mcp/oauth/register'));
  assert.ok(paths.includes('/api/mcp/oauth/authorize'));
  assert.ok(paths.includes('/api/mcp/oauth/token'));
  assert.ok(paths.includes('/api/mcp/oauth/revoke'));
  assert.ok(paths.includes('/mcp'));
  if(prior===undefined) delete process.env.MCP_ENABLED; else process.env.MCP_ENABLED=prior;
  if(priorUrl===undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL=priorUrl;
});
