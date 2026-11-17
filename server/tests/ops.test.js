import test from 'node:test';
import assert from 'node:assert/strict';
import { requestTelemetry, opsSnapshot } from '../ops.js';

test('request telemetry assigns a request ID and records route completion', () => {
  const req={method:'GET',path:'/api/intel?secret=not-logged',route:{path:'/api/intel'}};
  const headers={},listeners={};
  const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,on:(k,fn)=>listeners[k]=fn};
  let next=false;
  requestTelemetry(req,res,()=>{next=true;});
  assert.equal(next,true);
  assert.ok(req.requestId);
  assert.equal(headers['X-Request-Id'],req.requestId);
  listeners.finish();
  const snap=opsSnapshot();
  assert.ok(snap.totals.requests>=1);
  assert.ok(snap.routes.some(r=>r.route==='GET /api/intel'));
});
