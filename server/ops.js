import crypto from 'node:crypto';

const counts = new Map();
let inFlight = 0;
let lastRequestAt = null;

export function requestTelemetry(req, res, next) {
  const requestId = crypto.randomUUID();
  const started = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  inFlight++;
  lastRequestAt = Date.now();
  res.on('finish', () => {
    inFlight = Math.max(0, inFlight - 1);
    const route = req.route?.path || req.path;
    const key = `${req.method} ${route}`;
    const entry = counts.get(key) || { requests:0, errors:0, lastStatus:0, lastAt:0, durationMs:0 };
    entry.requests++;
    if (res.statusCode >= 500) entry.errors++;
    entry.lastStatus = res.statusCode;
    entry.lastAt = Date.now();
    entry.durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    counts.set(key, entry);
    if (counts.size > 300) counts.delete(counts.keys().next().value);
    // Do not log query strings, request bodies, emails, tokens or analyst searches.
    console.log(JSON.stringify({
      level:res.statusCode>=500?'error':'info', event:'http_request', requestId,
      method:req.method, path:route, status:res.statusCode,
      durationMs:Math.round(entry.durationMs)
    }));
  });
  next();
}

export function opsSnapshot() {
  const routes = [...counts.entries()].map(([route,value])=>({route,...value}));
  const totals = routes.reduce((a,r)=>({
    requests:a.requests+r.requests, errors:a.errors+r.errors
  }),{requests:0,errors:0});
  return { sampledAt:Date.now(), inFlight, lastRequestAt, totals, routes };
}
