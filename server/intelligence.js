// Intelligence fusion primitives. These functions produce reviewable leads,
// not factual determinations or attribution. Keep raw observations and provenance.
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
    notes:list(input.notes,200).map(n=>({id:String(n.id||'').slice(0,100),text:String(n.text||'').slice(0,3000),createdAt:Number(n.createdAt)||Date.now()}))};
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
