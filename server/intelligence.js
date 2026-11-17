// Intelligence fusion primitives. These functions produce reviewable leads,
// not factual determinations or attribution. Keep raw observations and provenance.
import crypto from 'node:crypto';
const STOP = new Set('the and for with from that this have has was were are but not you your about after before into over under says said report reports news today latest'.split(' '));
const textOf = x => String(x?.title || x?.text || x?.summary || '').normalize('NFKC').toLowerCase();
const tokens = value => new Set((String(value || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(t => !STOP.has(t)));
const similarity = (a,b) => { const A=tokens(a),B=tokens(b); if(!A.size||!B.size)return 0; let n=0; for(const t of A)if(B.has(t))n++; return n/(A.size+B.size-n); };
const canonicalUrl = raw => { try { const u=new URL(raw); if(!['http:','https:'].includes(u.protocol))return ''; u.hash=''; for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k); return u.toString(); } catch { return ''; } };
const domainOf = raw => { try { return new URL(raw).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const unique = xs => [...new Set(xs)];
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

export function classifyObservation(item={}) {
  const kind=String(item.kind||'news').toLowerCase();
  const category=String(item.category||'OTHER').toUpperCase();
  const sourceType=kind==='social'?'SOCIAL':kind==='official'?'OFFICIAL':kind==='market'?'MARKET':kind==='sensor'?'SENSOR':'NEWS';
  return { sourceType, domain:domainOf(item.url), canonicalUrl:canonicalUrl(item.url), category,
    publishedAt:Number(item.published)||null, capturedAt:Number(item.capturedAt)||Date.now(),
    verification:kind==='social'?'UNVERIFIED':kind==='official'?'SOURCE_PRIMARY':'UNASSESSED' };
}

// Build conservative review clusters from public observations. Signals are
// deliberately independent and expose their evidence rather than infer intent.
export function detectIntelligencePatterns(items=[], opts={}) {
  const windowMs=clamp(Number(opts.windowMs)||30*60*1000,60_000,24*60*60*1000);
  const minAuthors=clamp(Number(opts.minAuthors)||3,2,20);
  const rows=(items||[]).filter(x=>x && (x.kind==='social'||x.authorId) && textOf(x).length>20)
    .map(x=>({...x,_t:Number(x.published)||Number(x.capturedAt)||Date.now(),_text:textOf(x)}))
    .sort((a,b)=>a._t-b._t);
  const clusters=[];
  const add=(type, members, detail, score)=> {
    const ids=unique(members.map(x=>String(x.id||x.url||x.authorId)));
    if(ids.length<minAuthors)return;
    const authors=unique(members.map(x=>x.authorId).filter(Boolean));
    if(authors.length<minAuthors)return;
    clusters.push({id:'pat_'+ids.slice().sort().join('_').slice(0,72),type,accountCount:authors.length,
      observationCount:members.length,firstSeen:Math.min(...members.map(x=>x._t)),
      lastSeen:Math.max(...members.map(x=>x._t)),score,detail,
      evidence:members.slice(0,30).map(x=>({id:x.id||null,url:x.url||null,authorId:x.authorId,published:x._t,text:String(x.title||x.summary||'').slice(0,280)})),
      assessment:'REVIEW_LEAD_ONLY',limitations:['Does not establish coordination, common control, automation, intent or truth.']});
  };
  // Near duplicate and paraphrase candidates: greedy bounded comparison.
  const used=new Set();
  for(const seed of rows){
    if(used.has(seed))continue;
    const group=[seed];
    for(const candidate of rows){
      if(candidate===seed||used.has(candidate)||Math.abs(candidate._t-seed._t)>windowMs)continue;
      if(group.some(g=>g.authorId&&g.authorId===candidate.authorId))continue;
      if(group.some(g=>similarity(g._text,candidate._text)>=0.68))group.push(candidate);
    }
    if(unique(group.map(x=>x.authorId).filter(Boolean)).length>=minAuthors){
      group.forEach(x=>used.add(x));
      add('SIMILAR_TEXT_BURST',group,{similarityThreshold:0.68,windowMinutes:Math.round(windowMs/60000)},Math.min(95,55+group.length*3));
    }
  }
  // Repeated URL sharing, including posts whose wording differs.
  const byUrl=new Map();
  for(const x of rows){const u=canonicalUrl(x.url);if(!u)continue;const a=byUrl.get(u)||[];a.push(x);byUrl.set(u,a);}
  for(const [url,members] of byUrl)if(unique(members.map(x=>x.authorId).filter(Boolean)).length>=minAuthors &&
    Math.max(...members.map(x=>x._t))-Math.min(...members.map(x=>x._t))<=windowMs)
    add('SHARED_URL_BURST',members,{url,windowMinutes:Math.round(windowMs/60000)},Math.min(95,60+members.length*2));
  // Hashtag co-occurrence bursts.
  const byTag=new Map();
  for(const x of rows){const tags=unique((String(x.title||'')+' '+String(x.summary||'')).match(/#[\p{L}\p{N}_]{2,}/gu)||[]);for(const tag of tags){const a=byTag.get(tag.toLowerCase())||[];a.push(x);byTag.set(tag.toLowerCase(),a);}}
  for(const [tag,members] of byTag)if(unique(members.map(x=>x.authorId).filter(Boolean)).length>=minAuthors &&
    Math.max(...members.map(x=>x._t))-Math.min(...members.map(x=>x._t))<=windowMs)
    add('HASHTAG_BURST',members,{hashtag:tag,windowMinutes:Math.round(windowMs/60000)},Math.min(90,50+members.length*2));
  const seen=new Set();
  return clusters.filter(c=>{const k=c.type+':'+c.evidence.map(e=>e.id||e.url).sort().join('|');if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>b.score-a.score||b.observationCount-a.observationCount);
}

export function scoreIntelligenceAlert(input={}) {
  const severity={LOW:15,MEDIUM:40,HIGH:70,CRITICAL:90}[String(input.severity||'LOW').toUpperCase()]||15;
  const confidence=clamp(Number(input.confidence)||0,0,100);
  const relevance=clamp(Number(input.relevance)||0,0,100);
  const urgency=clamp(Number(input.urgency)||0,0,100);
  const independentSources=clamp(Number(input.independentSources)||0,0,20);
  const sourceSupport=Math.min(100,independentSources*20);
  // Keep dimensions separate; priority is a queueing aid, not a truth score.
  const priority=Math.round(severity*.35+confidence*.25+relevance*.2+urgency*.2);
  return {severity:String(input.severity||'LOW').toUpperCase(),confidence,relevance,urgency,
    independentSources,sourceSupport,priority,
    confidenceLabel:confidence>=80?'HIGH':confidence>=55?'MODERATE':confidence>=30?'LOW':'UNASSESSED',
    explanation:'Priority combines impact, evidence confidence, user relevance and urgency. It is not a probability that the underlying claim is true.'};
}

export function buildEventCandidates(items=[], opts={}) {
  const threshold=clamp(Number(opts.similarity)||0.42,0.2,0.9);
  const ordered=(items||[]).filter(x=>textOf(x)).slice(0,500);
  const groups=[];
  for(const item of ordered){
    let group=groups.find(g=>g.some(x=>similarity(textOf(x),textOf(item))>=threshold));
    if(!group)groups.push(group=[]);
    group.push(item);
  }
  return groups.filter(g=>g.length>1).map((g,i)=>({
    id:'evt_candidate_'+(i+1),status:'CANDIDATE_REQUIRES_REVIEW',items:g,
    sourceCount:unique(g.map(x=>domainOf(x.url)||x.source).filter(Boolean)).length,
    firstSeen:Math.min(...g.map(x=>Number(x.published)||Number(x.capturedAt)||Date.now())),
    lastSeen:Math.max(...g.map(x=>Number(x.published)||Number(x.capturedAt)||Date.now())),
    note:'Similarity-based grouping only. Confirm event identity, chronology, location and independence before merging.'
  }));
}

export function validateInvestigation(input={}) {
  const title=String(input.title||'').trim().slice(0,160);
  if(title.length<3)throw new Error('Investigation title must contain at least 3 characters.');
  const status=['OPEN','IN_REVIEW','CLOSED','ARCHIVED'].includes(input.status)?input.status:'OPEN';
  const priority=['LOW','NORMAL','HIGH','URGENT'].includes(input.priority)?input.priority:'NORMAL';
  const list=(v,max)=>Array.isArray(v)?v.slice(0,max):[];
  return {title,objective:String(input.objective||'').trim().slice(0,3000),status,priority,
    tags:list(input.tags,20).map(x=>String(x).slice(0,50)),
    questions:list(input.questions,30).map(x=>String(x).slice(0,500)),
    hypotheses:list(input.hypotheses,30).map(h=>({text:String(h.text||'').slice(0,1000),status:['SUPPORTED','CONTRADICTED','UNRESOLVED'].includes(h.status)?h.status:'UNRESOLVED',evidenceIds:list(h.evidenceIds,100)})),
    evidence:list(input.evidence,300).map(e=>({id:String(e.id||'').slice(0,100),type:String(e.type||'observation').slice(0,40),title:String(e.title||'').slice(0,300),url:canonicalUrl(e.url),source:String(e.source||'').slice(0,120),published:Number(e.published)||null,capturedAt:Number(e.capturedAt)||Date.now(),sha256:/^[a-f0-9]{64}$/i.test(e.sha256||'')?e.sha256:null,assessment:['FACT','CLAIM','ASSESSMENT','HYPOTHESIS','UNKNOWN'].includes(e.assessment)?e.assessment:'CLAIM',notes:String(e.notes||'').slice(0,3000)})),
    notes:list(input.notes,200).map(n=>({id:String(n.id||'').slice(0,100),text:String(n.text||'').slice(0,3000),createdAt:Number(n.createdAt)||Date.now()})),
    entities:list(input.entities,300).map(e=>({id:String(e.id||'').slice(0,100),name:String(e.name||'').trim().slice(0,200),type:['PERSON','ORGANIZATION','LOCATION','ASSET','DOMAIN','ACCOUNT','VESSEL','AIRCRAFT','OTHER'].includes(e.type)?e.type:'OTHER',resolution:['UNRESOLVED','CANDIDATE','CONFIRMED'].includes(e.resolution)?e.resolution:'UNRESOLVED',confidence:clamp(Number(e.confidence)||0,0,100),sourceEvidenceIds:list(e.sourceEvidenceIds,100).map(String),notes:String(e.notes||'').slice(0,1000)})).filter(e=>e.name),
    relationships:list(input.relationships,500).map(r=>({id:String(r.id||'').slice(0,100),from:String(r.from||'').slice(0,100),to:String(r.to||'').slice(0,100),type:['CORROBORATES','CONTRADICTS','RELATED_TO','SAME_EVENT','POSSIBLE_DUPLICATE','ASSOCIATED_WITH'].includes(r.type)?r.type:'RELATED_TO',assessment:['OBSERVED','ASSESSED','HYPOTHESIS','UNKNOWN'].includes(r.assessment)?r.assessment:'UNKNOWN',rationale:String(r.rationale||'').slice(0,1500),sourceEvidenceIds:list(r.sourceEvidenceIds,100).map(String),createdAt:Number(r.createdAt)||Date.now()})).filter(r=>r.from&&r.to&&r.from!==r.to)};
}


const RULE_SEVERITY = ['LOW','MEDIUM','HIGH','CRITICAL'];
export function validateAlertRule(input={}) {
  const name=String(input.name||'').trim().slice(0,100);
  if(name.length<3)throw new Error('Alert rule name must contain at least 3 characters.');
  const categories=['STRATEGIC','LOGISTICS_SUPPLY_CHAIN','MARKETS','GEOPOLITICS','SECURITY','CYBER','POLITICS','GOVERNANCE','CRISIS','OTHER'];
  const list=(v,max)=>Array.isArray(v)?v.slice(0,max):[];
  const keywords=list(input.keywords,20).map(x=>String(x).trim().toLowerCase().slice(0,60)).filter(x=>x.length>=2);
  const severity=RULE_SEVERITY.includes(String(input.minSeverity||'LOW').toUpperCase())?String(input.minSeverity||'LOW').toUpperCase():'LOW';
  return {name,description:String(input.description||'').trim().slice(0,500),enabled:input.enabled!==false,
    categories:list(input.categories,10).filter(x=>categories.includes(x)),
    keywords,matchMode:input.matchMode==='ALL'?'ALL':'ANY',minSeverity:severity,
    includeSocial:input.includeSocial===true,createdAt:Number(input.createdAt)||Date.now()};
}
export function evaluateAlertRules(rules=[],items=[]) {
  const rank={LOW:0,MEDIUM:1,HIGH:2,CRITICAL:3};
  const out=[];
  for(const raw of (rules||[]).slice(0,100)){
    let rule;try{rule=validateAlertRule(raw);}catch{continue;}
    if(!rule.enabled)continue;
    const matches=(items||[]).filter(item=>{
      if(item.kind==='social'&&!rule.includeSocial)return false;
      if(rule.categories.length&&!rule.categories.includes(item.category||'OTHER'))return false;
      if((rank[item.severity]??0)<rank[rule.minSeverity])return false;
      if(!rule.keywords.length)return true;
      const hay=(String(item.title||'')+' '+String(item.summary||'')).toLowerCase();
      const hits=rule.keywords.filter(k=>hay.includes(k)).length;
      return rule.matchMode==='ALL'?hits===rule.keywords.length:hits>0;
    }).slice(0,100);
    if(matches.length)out.push({ruleId:raw.id||null,ruleName:rule.name,count:matches.length,
      matches:matches.slice(0,30).map(x=>({id:x.id,title:x.title,summary:x.summary,url:x.url,source:x.source,kind:x.kind,category:x.category,severity:x.severity,published:x.published}))});
  }
  return out;
}


// Extract only high-precision technical/public identifiers automatically.
// Names of people and organisations are intentionally left for analyst review.
export function extractEntityCandidates(investigation={}) {
  const evidence=Array.isArray(investigation.evidence)?investigation.evidence:[];
  const found=new Map();
  const add=(name,type,evidenceId)=>{const key=type+':'+name.toLowerCase();const item=found.get(key)||{name,type,resolution:'UNRESOLVED',confidence:0,sourceEvidenceIds:[]};if(evidenceId&&!item.sourceEvidenceIds.includes(evidenceId))item.sourceEvidenceIds.push(evidenceId);found.set(key,item);};
  for(const e of evidence){
    const text=[e.title,e.notes,e.url].filter(Boolean).join(' ');
    for(const m of text.matchAll(/https?:\/\/[^\s<>"')]+/giu)){try{const u=new URL(m[0]);add(u.hostname.toLowerCase().replace(/^www\./,''),'DOMAIN',e.id);}catch{}}
    for(const m of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu))add(m[0].toLowerCase(),'OTHER',e.id);
    for(const m of text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)){const parts=m[0].split('.').map(Number);if(parts.every(n=>n>=0&&n<=255))add(m[0],'OTHER',e.id);}
    for(const m of text.matchAll(/#[\p{L}\p{N}_]{2,}/gu))add(m[0],'OTHER',e.id);
    for(const m of text.matchAll(/@[A-Za-z0-9_]{2,}/g))add(m[0],'ACCOUNT',e.id);
  }
  return [...found.values()].slice(0,200);
}


// Export only observable cyber indicators from case evidence. This is a
// conservative STIX 2.1 bundle, not a complete case-to-STIX conversion.
export function buildStixBundle(investigation={}) {
  const now=new Date().toISOString();
  const objects=[];
  const candidates=extractEntityCandidates(investigation);
  for(const entity of candidates){
    let pattern=null;
    if(entity.type==='DOMAIN' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(entity.name))
      pattern=`[domain-name:value = '${entity.name.replace(/'/g,"\\'")}']`;
    else if(entity.type==='OTHER' && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(entity.name)){
      const octets=entity.name.split('.').map(Number);
      if(octets.every(n=>n>=0&&n<=255))pattern=`[ipv4-addr:value = '${entity.name}']`;
    }
    if(!pattern)continue;
    objects.push({type:'indicator',spec_version:'2.1',id:`indicator--${crypto.randomUUID()}`,
      created:now,modified:now,name:`Unresolved indicator: ${entity.name}`,description:'Extracted from investigation evidence; analyst review required. No attribution or maliciousness determination is implied.',
      indicator_types:['unknown'],pattern,pattern_type:'stix',valid_from:now,confidence:0,
      labels:['calibrex-unresolved','analyst-review-required']});
  }
  return {type:'bundle',id:`bundle--${crypto.randomUUID()}`,objects,
    x_calibrex_export_note:'Conservative STIX 2.1 export of domain/IP observables only. Unresolved indicators are not threat determinations.'};
}


// Evidence ledger: canonical fingerprints form an append-only hash chain.
// This detects accidental or partial tampering; it is not external/WORM storage.
export function canonicalJson(value) {
  const normalise = v => Array.isArray(v) ? v.map(normalise)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalise(v[k])]))
    : v;
  return JSON.stringify(normalise(value));
}
const evidenceSha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function createEvidenceLedgerEntry(event, previousHash = '0'.repeat(64), sequence = 1) {
  const payload = {
    sequence, investigationId: String(event.investigationId), evidenceId: String(event.evidenceId),
    action: ['UPDATED','REMOVED'].includes(event.action) ? event.action : 'ADDED',
    at: Number(event.at) || Date.now(), actor: String(event.actor || ''),
    evidenceDigest: evidenceSha256(canonicalJson(event.evidence)), previousHash
  };
  return { ...payload, hash: evidenceSha256(canonicalJson(payload)) };
}
export function verifyEvidenceLedger(entries = []) {
  let previousHash = '0'.repeat(64);
  const errors = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] || {};
    const { hash, ...payload } = entry;
    if (entry.sequence !== i + 1) errors.push({ sequence: i + 1, reason: 'SEQUENCE_GAP' });
    if (entry.previousHash !== previousHash) errors.push({ sequence: i + 1, reason: 'PREVIOUS_HASH_MISMATCH' });
    if (hash !== evidenceSha256(canonicalJson(payload))) errors.push({ sequence: i + 1, reason: 'ENTRY_HASH_MISMATCH' });
    previousHash = String(hash || '');
  }
  return { valid: errors.length === 0, entries: entries.length, headHash: previousHash, errors };
}


// Per-account cross-case entity register. Similar names remain separate until an analyst merges them.
export function validateRegistryEntity(input = {}, existing = null) {
  const name = String(input.name || '').trim().slice(0, 200);
  if (name.length < 2) throw new Error('Entity name must contain at least 2 characters.');
  const types = ['PERSON','ORGANIZATION','LOCATION','ASSET','DOMAIN','ACCOUNT','VESSEL','AIRCRAFT','OTHER'];
  const resolutions = ['UNRESOLVED','CANDIDATE','CONFIRMED'];
  const type = types.includes(input.type) ? input.type : 'OTHER';
  const resolution = resolutions.includes(input.resolution) ? input.resolution : 'UNRESOLVED';
  const aliases = [...new Set((Array.isArray(input.aliases) ? input.aliases : [])
    .map(x => String(x).trim().slice(0, 200)).filter(Boolean))].slice(0, 30);
  const sourceRefs = (Array.isArray(input.sourceRefs) ? input.sourceRefs : []).slice(0, 100)
    .map(x => ({ investigationId: String(x?.investigationId || '').slice(0, 100), evidenceId: String(x?.evidenceId || '').slice(0, 100) }))
    .filter(x => x.investigationId && x.evidenceId);
  const now = Date.now();
  return {
    id: existing?.id || String(input.id || crypto.randomUUID()),
    name, type, resolution,
    confidence: clamp(Number(input.confidence) || 0, 0, 100),
    aliases, sourceRefs,
    notes: String(input.notes || '').trim().slice(0, 3000),
    createdAt: existing?.createdAt || now, updatedAt: now
  };
}
