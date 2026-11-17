const base = String(process.env.STAGING_BASE_URL || '').replace(/\/$/, '');
const accounts = [
  { email: process.env.STAGING_EMAIL_A || process.env.STAGING_EMAIL, password: process.env.STAGING_PASSWORD_A || process.env.STAGING_PASSWORD, totp: process.env.STAGING_TOTP_A || process.env.STAGING_TOTP || '' },
  { email: process.env.STAGING_EMAIL_B, password: process.env.STAGING_PASSWORD_B, totp: process.env.STAGING_TOTP_B || '' },
];
if (!base || accounts.some(a => !a.email || !a.password)) {
  throw new Error('Set STAGING_BASE_URL and two independent active test accounts: STAGING_EMAIL_A/STAGING_PASSWORD_A and STAGING_EMAIL_B/STAGING_PASSWORD_B (A may use STAGING_EMAIL/STAGING_PASSWORD).');
}
const origin = new URL(base);
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') throw new Error('Staging URL must use HTTPS.');
async function request(cookie, method, route, body) {
  const response = await fetch(new URL(route, base), {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type':'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text(); let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0,500) }; }
  return { status: response.status, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}
function check(ok, message, detail='') { if (!ok) throw new Error('FAIL '+message+' '+detail); console.log('PASS',message); }
async function login(account) {
  const r=await request('', 'POST','/api/auth/login',{email:account.email,password:account.password,...(account.totp?{totp:account.totp}:{})});
  check(r.status===200 && !!r.cookie && !!r.data?.user, 'test identity authenticates: '+account.email);
  return r.cookie;
}
const [cookieA,cookieB]=await Promise.all(accounts.map(login));
const [meA,meB]=await Promise.all([request(cookieA,'GET','/api/auth/me'),request(cookieB,'GET','/api/auth/me')]);
check(meA.status===200 && meB.status===200 && meA.data.user.id!==meB.data.user.id,'two distinct authenticated identities');
const suffix=crypto.randomUUID().slice(0,8);
const a=await request(cookieA,'POST','/api/workspaces',{name:'Staging Alpha '+suffix});
const b=await request(cookieB,'POST','/api/workspaces',{name:'Staging Bravo '+suffix});
check(a.status===201 && b.status===201,'two isolated workspaces created',JSON.stringify({a:a.data,b:b.data}));
const wa=a.data.workspace.id, wb=b.data.workspace.id;
const ca=await request(cookieA,'POST','/api/investigations?workspaceId='+encodeURIComponent(wa),{title:'Alpha isolation '+suffix,objective:'staging tenant isolation probe'});
const cb=await request(cookieB,'POST','/api/investigations?workspaceId='+encodeURIComponent(wb),{title:'Bravo isolation '+suffix,objective:'staging tenant isolation probe'});
check(ca.status===201 && cb.status===201,'each tenant creates its own investigation');
const caseA=ca.data.investigation.id, caseB=cb.data.investigation.id;
check((await request(cookieA,'GET','/api/investigations?workspaceId='+wb)).status===404,'tenant A cannot list tenant B workspace');
check((await request(cookieA,'GET','/api/investigations/'+caseB+'?workspaceId='+wa)).status===404,'tenant A cannot read tenant B investigation');
check((await request(cookieA,'PUT','/api/investigations/'+caseB+'?workspaceId='+wa,{title:'cross tenant edit'})).status===404,'tenant A cannot edit tenant B investigation');
check((await request(cookieA,'DELETE','/api/investigations/'+caseB+'?workspaceId='+wa)).status===404,'tenant A cannot delete tenant B investigation');
check((await request(cookieA,'GET','/api/investigations/'+caseB+'/evidence-ledger?workspaceId='+wa)).status===404,'tenant A cannot read tenant B evidence ledger');
check((await request(cookieA,'GET','/api/investigations/'+caseB+'/stix?workspaceId='+wa)).status===404,'tenant A cannot export tenant B STIX');
const ea=await request(cookieA,'POST','/api/entity-registry?workspaceId='+wa,{name:'Alpha entity '+suffix,type:'ORGANIZATION',resolution:'CANDIDATE'});
const eb=await request(cookieB,'POST','/api/entity-registry?workspaceId='+wb,{name:'Bravo entity '+suffix,type:'ORGANIZATION',resolution:'CANDIDATE'});
check(ea.status===201 && eb.status===201,'each tenant creates its own entity record');
check((await request(cookieA,'GET','/api/entity-registry?workspaceId='+wb)).status===404,'tenant A cannot read tenant B entity registry');
check((await request(cookieA,'PUT','/api/entity-registry/'+eb.data.entity.id+'?workspaceId='+wa,{name:'cross tenant entity edit'})).status===404,'tenant A cannot mutate tenant B entity');
const add=await request(cookieA,'POST','/api/workspaces/'+wa+'/members',{email:accounts[1].email,role:'viewer'});
check(add.status===201,'workspace owner adds second identity as viewer',JSON.stringify(add.data));
check((await request(cookieB,'GET','/api/investigations?workspaceId='+wa)).status===200,'viewer can read shared workspace');
check((await request(cookieB,'POST','/api/investigations?workspaceId='+wa,{title:'viewer write denial'})).status===403,'viewer cannot create shared investigation');
check((await request(cookieB,'PUT','/api/investigations/'+caseA+'?workspaceId='+wa,{title:'viewer edit denial'})).status===403,'viewer cannot edit shared investigation');
check((await request(cookieB,'POST','/api/workspaces/'+wa+'/members',{email:accounts[1].email,role:'analyst'})).status===403,'viewer cannot manage workspace members');
check((await request(cookieA,'DELETE','/api/workspaces/'+wa+'/members/'+add.data.member.userId)).status===200,'workspace owner removes viewer');
check((await request(cookieB,'GET','/api/investigations?workspaceId='+wa)).status===404,'removed member loses access on next request');
check((await request(cookieA,'GET','/api/investigations')).data.investigations?.every(x=>x.id!==caseA),'personal case listing excludes corporate investigations');
const personal=await request(cookieA,'POST','/api/investigations',{title:'Personal isolation '+suffix});
check(personal.status===201,'personal investigation can be created');
check((await request(cookieA,'GET','/api/investigations?workspaceId='+wa)).data.investigations?.every(x=>x.id!==personal.data.investigation.id),'corporate listing excludes personal investigations');
const conflict=await fetch(new URL('/api/investigations?workspaceId='+wa,base),{headers:{cookie:cookieA,'x-calibrex-workspace':wb},signal:AbortSignal.timeout(20000)});
check(conflict.status===400,'conflicting workspace selectors are rejected');
console.log(JSON.stringify({result:'PASS',base:origin.origin,checkedAt:new Date().toISOString(),workspaceA:wa,workspaceB:wb,identities:accounts.map(x=>x.email),checks:'deployed cross-tenant isolation, role enforcement, member offboarding, evidence/STIX boundaries, entity registry, personal/corporate separation'},null,2));
