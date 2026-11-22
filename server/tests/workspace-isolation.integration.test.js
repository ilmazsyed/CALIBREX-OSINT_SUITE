import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { totpCode } from '../totp.js';

const disabled = {
  DISABLE_FEEDS:'true', DISABLE_MARKETS:'true', DISABLE_SIGNALS:'true',
  DISABLE_GEOINT:'true', DISABLE_CONFLICT:'true', DISABLE_MARITIME:'true',
  DISABLE_SANCTIONS:'true', DISABLE_ENTITYWATCH:'true'
};
let child, base, dataDir;
const clients = new Map();

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
async function request(client, method, route, body) {
  const response=await fetch(base+route,{method,headers:{...(client.cookie?{cookie:client.cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  return {status:response.status,data,headers:response.headers};
}
async function signup(label) {
  const client={cookie:''};
  const r=await request(client,'POST','/api/auth/signup',{email:label+'@example.test',password:'test-password-123',name:label,org:'Workspace security tests'});
  assert.equal(r.status,201,JSON.stringify(r.data));
  const setCookie=r.headers.get('set-cookie');
  assert.ok(setCookie,'signup should issue a session cookie');
  client.cookie=setCookie.split(';')[0];
  clients.set(label,client);
  return client;
}
async function waitForServer() {
  for(let i=0;i<100;i++){
    try{const r=await fetch(base+'/api/health');if(r.ok||r.status===404)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error('test server did not start');
}

test('HTTP workspace isolation, role enforcement, offboarding and scope conflicts', async t => {
  dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'calibrex-workspace-http-'));
  const port=await freePort();base='http://127.0.0.1:'+port;
  child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,...disabled,DATA_DIR:dataDir,PORT:String(port),NODE_ENV:'test',SESSION_SECRET:'workspace-integration-test-secret'} ,stdio:'ignore'});
  t.after(async()=>{if(child&&!child.killed){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}await fs.rm(dataDir,{recursive:true,force:true});});
  await waitForServer();

  const owner=await signup('owner'), outsider=await signup('outsider'), viewer=await signup('viewer');

  const crossOriginMutation=await fetch(base+'/api/workspaces',{
    method:'POST',
    headers:{cookie:owner.cookie,origin:'https://attacker.example','content-type':'application/json'},
    body:JSON.stringify({name:'Cross-origin workspace'})
  });
  assert.equal(crossOriginMutation.status,403);
  const crossOriginBody=await crossOriginMutation.json();
  assert.equal(crossOriginBody.code,'origin_mismatch');

  // An authenticated session alone must not be enough to replace an enabled
  // second factor. Only the verified disable flow may permit a new setup.
  const mfaSetup=await request(owner,'POST','/api/auth/2fa/setup');
  assert.equal(mfaSetup.status,200,JSON.stringify(mfaSetup.data));
  const mfaSecret=mfaSetup.data.secret;
  const firstMfaCode=totpCode(mfaSecret);
  const mfaEnable=await request(owner,'POST','/api/auth/2fa/enable',{code:firstMfaCode});
  assert.equal(mfaEnable.status,200,JSON.stringify(mfaEnable.data));
  const replayLogin=await request({cookie:''},'POST','/api/auth/login',{
    email:'owner@example.test',password:'test-password-123',totp:firstMfaCode
  });
  assert.equal(replayLogin.status,401);
  assert.equal(replayLogin.data.code,'totp_invalid');
  const mfaOverwrite=await request(owner,'POST','/api/auth/2fa/setup');
  assert.equal(mfaOverwrite.status,409);
  assert.equal(mfaOverwrite.data.code,'totp_already_enabled');
  const mfaDisable=await request(owner,'POST','/api/auth/2fa/disable',{code:totpCode(mfaSecret,Date.now()+30000)});
  assert.equal(mfaDisable.status,200,JSON.stringify(mfaDisable.data));
  const mfaReplacement=await request(owner,'POST','/api/auth/2fa/setup');
  assert.equal(mfaReplacement.status,200,JSON.stringify(mfaReplacement.data));
  const createdA=await request(owner,'POST','/api/workspaces',{name:'Tenant Alpha'});
  const createdB=await request(outsider,'POST','/api/workspaces',{name:'Tenant Bravo'});
  assert.equal(createdA.status,201);assert.equal(createdB.status,201);
  const a=createdA.data.workspace.id,b=createdB.data.workspace.id;

  const caseA=await request(owner,'POST','/api/investigations?workspaceId='+a,{title:'Alpha investigation',objective:'Tenant A private case'});
  const caseB=await request(outsider,'POST','/api/investigations?workspaceId='+b,{title:'Bravo investigation',objective:'Tenant B private case'});
  assert.equal(caseA.status,201);assert.equal(caseB.status,201);
  const caseAId=caseA.data.investigation.id,caseBId=caseB.data.investigation.id;

  const entityA=await request(owner,'POST','/api/entity-registry?workspaceId='+a,{name:'Alpha Holdings',type:'ORGANIZATION',resolution:'CANDIDATE'});
  const entityB=await request(outsider,'POST','/api/entity-registry?workspaceId='+b,{name:'Bravo Industries',type:'ORGANIZATION',resolution:'CANDIDATE'});
  assert.equal(entityA.status,201);assert.equal(entityB.status,201);
  const entityAId=entityA.data.entity.id,entityBId=entityB.data.entity.id;
  const alphaRegistry=await request(owner,'GET','/api/entity-registry?workspaceId='+a);
  assert.equal(alphaRegistry.status,200);
  assert.equal(alphaRegistry.data.entities.some(x=>x.id===entityBId),false);
  assert.equal((await request(owner,'GET','/api/entity-registry?workspaceId='+b)).status,404);
  assert.equal((await request(owner,'PUT','/api/entity-registry/'+entityBId+'?workspaceId='+a,{name:'Cross-tenant edit'})).status,404);
  assert.equal((await request(owner,'DELETE','/api/entity-registry/'+entityBId+'?workspaceId='+a)).status,404);

  assert.equal((await request(owner,'GET','/api/investigations?workspaceId='+b)).status,404);
  assert.equal((await request(owner,'GET','/api/investigations/'+caseBId+'?workspaceId='+a)).status,404);
  assert.equal((await request(owner,'PUT','/api/investigations/'+caseBId+'?workspaceId='+a,{title:'Attempted tenant breach'})).status,404);
  assert.equal((await request(owner,'DELETE','/api/investigations/'+caseBId+'?workspaceId='+a)).status,404);
  assert.equal((await request(outsider,'GET','/api/investigations?workspaceId='+a)).status,404);
  assert.equal((await request(outsider,'GET','/api/investigations/'+caseAId+'?workspaceId='+b)).status,404);
  assert.equal((await request(owner,'GET','/api/investigations/'+caseBId+'/evidence-ledger?workspaceId='+a)).status,404);
  assert.equal((await request(owner,'GET','/api/investigations/'+caseBId+'/stix?workspaceId='+a)).status,404);

  const personal=await request(owner,'POST','/api/investigations',{title:'Owner personal case'});
  assert.equal(personal.status,201);
  assert.equal((await request(owner,'GET','/api/investigations?workspaceId='+a)).data.investigations.some(x=>x.id===personal.data.investigation.id),false);
  assert.equal((await request(owner,'GET','/api/investigations')).data.investigations.some(x=>x.id===caseAId),false);

  const addViewer=await request(owner,'POST','/api/workspaces/'+a+'/members',{email:'viewer@example.test',role:'viewer'});
  assert.equal(addViewer.status,201,JSON.stringify(addViewer.data));
  assert.equal((await request(viewer,'GET','/api/investigations?workspaceId='+a)).status,200);
  assert.equal((await request(viewer,'GET','/api/investigations/'+caseAId+'/evidence-ledger?workspaceId='+a)).status,200);
  assert.equal((await request(viewer,'POST','/api/investigations?workspaceId='+a,{title:'Viewer must not create'})).status,403);
  assert.equal((await request(viewer,'PUT','/api/investigations/'+caseAId+'?workspaceId='+a,{title:'Viewer must not edit'})).status,403);
  assert.equal((await request(viewer,'DELETE','/api/investigations/'+caseAId+'?workspaceId='+a)).status,403);
  assert.equal((await request(viewer,'POST','/api/workspaces/'+a+'/members',{email:'outsider@example.test',role:'analyst'})).status,403);

  const conflicting=await request(owner,'GET','/api/investigations?workspaceId='+a);
  assert.equal(conflicting.status,200);
  const conflictResponse=await fetch(base+'/api/investigations?workspaceId='+a,{headers:{cookie:owner.cookie,'x-calibrex-workspace':b}});
  assert.equal(conflictResponse.status,400);

  assert.equal((await request(owner,'DELETE','/api/workspaces/'+a+'/members/'+addViewer.data.member.userId)).status,200);
  assert.equal((await request(viewer,'GET','/api/investigations?workspaceId='+a)).status,404);
  assert.equal((await request(viewer,'GET','/api/investigations/'+caseAId+'/evidence-ledger?workspaceId='+a)).status,404);
});
