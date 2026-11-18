import { rankQueryResults } from './query-relevance.js';

/**
 * Deterministic evaluation helper for labelled fixtures and analyst-reviewed
 * samples. Metrics describe retrieval behaviour, never truth or source quality.
 */
export function evaluateSearchQuality({items=[], labels={}, query, window='7d', now=Date.now(), k=5}={}) {
  const ranked=rankQueryResults(items,query,window,now);
  const relevantIds=new Set(Object.entries(labels).filter(([,v])=>v===true).map(([id])=>id));
  const top=ranked.slice(0,Math.max(1,Math.min(20,Number(k)||5)));
  const hits=top.filter(x=>relevantIds.has(String(x.id))).length;
  const retrievedRelevant=ranked.filter(x=>relevantIds.has(String(x.id))).length;
  const precisionAtK=top.length?hits/top.length:0;
  const recall=relevantIds.size?retrievedRelevant/relevantIds.size:0;
  const staleOrFutureRate=ranked.length?ranked.filter(x=>x.freshness==='OUT_OF_WINDOW'||x.freshness==='FUTURE_DATED').length/ranked.length:0;
  const dated=ranked.filter(x=>Number.isFinite(Number(x.published))&&Number(x.published)>0);
  const ages=dated.map(x=>Math.max(0,now-Number(x.published))).sort((a,b)=>a-b);
  const mid=Math.floor(ages.length/2);
  const freshnessLagMs=ages.length?(ages.length%2?ages[mid]:(ages[mid-1]+ages[mid])/2):null;
  const truePositiveAtK = hits;
  const falsePositiveAtK = top.length - truePositiveAtK;
  const falseNegative = Math.max(0, relevantIds.size - retrievedRelevant);
  return {
    query,window,k:top.length,totalInput:Array.isArray(items)?items.length:0,totalReturned:ranked.length,
    labelledRelevant:relevantIds.size,precisionAtK:Number(precisionAtK.toFixed(3)),
    recall:Number(recall.toFixed(3)),staleOrFutureRate:Number(staleOrFutureRate.toFixed(3)),
    truePositiveAtK,falsePositiveAtK,retrievedRelevant,falseNegative,
    medianPublicationAgeMs:freshnessLagMs,
    note:'Fixture/sample retrieval metrics only. They do not measure truth, credibility, completeness, or operational intelligence value.'
  };
}

const SUPPORTED_REVIEW_LANGUAGES = new Set(['en','bn','hi','other']);

/**
 * Normalise a human-reviewed retrieval sample. Reviewer identifiers should be
 * pseudonymous; do not put names, emails, or other personal data in fixtures.
 */
export function validateAnalystReviewSample(input={}) {
  const language=String(input.language||'').toLowerCase();
  if(!SUPPORTED_REVIEW_LANGUAGES.has(language)) throw new Error('language must be en, bn, hi, or other');
  const query=String(input.query||'').trim().slice(0,500);
  if(!query) throw new Error('query is required');
  const reviewerId=String(input.reviewerId||'').trim().slice(0,80);
  if(!reviewerId) throw new Error('pseudonymous reviewerId is required');
  const reviewedAt=Number(input.reviewedAt);
  if(!Number.isFinite(reviewedAt)||reviewedAt<=0) throw new Error('reviewedAt must be a valid timestamp');
  if(!Array.isArray(input.itemLabels)||!input.itemLabels.length) throw new Error('at least one item label is required');
  const seen=new Set();
  const itemLabels=input.itemLabels.slice(0,500).map(row=>{
    const itemId=String(row?.itemId||'').trim().slice(0,160);
    if(!itemId||seen.has(itemId)) throw new Error('item labels require unique itemId values');
    if(typeof row.relevant!=='boolean') throw new Error('each item label requires a boolean relevant value');
    seen.add(itemId);
    return {itemId,relevant:row.relevant,reason:String(row.reason||'').trim().slice(0,500)};
  });
  return {sampleId:String(input.sampleId||'').trim().slice(0,100)||null,language,query,
    domain:String(input.domain||'general').trim().slice(0,80),reviewerId,reviewedAt,
    searchWindow:['1d','3d','7d','30d'].includes(input.searchWindow)?input.searchWindow:'7d',
    itemLabels,source:'ANALYST_REVIEWED'};
}

const pairKey = (a,b) => [String(a),String(b)].sort().join('::');

/**
 * Compare proposed duplicate/syndication pairs with analyst labels.
 * A positive label means the pair is the same underlying report/story, not
 * proof of copying, coordination, common ownership, or source dependence.
 */
export function evaluateSyndicationQuality({candidatePairs=[], labels={}}={}) {
  const positives=new Set(Object.entries(labels).filter(([,v])=>v===true).map(([k])=>k));
  const candidates=new Set(candidatePairs.filter(p=>p?.leftId!=null&&p?.rightId!=null)
    .map(p=>pairKey(p.leftId,p.rightId)));
  let truePositive=0;
  for(const key of candidates) if(positives.has(key)) truePositive++;
  const falsePositive=candidates.size-truePositive;
  let falseNegative=0;
  for(const key of positives) if(!candidates.has(key)) falseNegative++;
  const precision=truePositive+falsePositive?truePositive/(truePositive+falsePositive):0;
  const recall=truePositive+falseNegative?truePositive/(truePositive+falseNegative):0;
  return {labelledPairs:positives.size,candidatePairs:candidates.size,truePositive,falsePositive,falseNegative,
    precision:Number(precision.toFixed(3)),recall:Number(recall.toFixed(3)),
    falseIndependentCorroborationCandidates:falsePositive,
    note:'Pair-level review metric only. Labels indicate same underlying report/story; they do not establish copying, coordination, common ownership, or intent.'};
}

/**
 * Aggregate explicitly analyst-labelled samples by language and domain.
 * Each row must include a validated sample plus the retrieved item records
 * used for that sample. Empty groups are omitted; no synthetic labels added.
 */
export function evaluateReviewedSearchBatch(rows=[],{now=Date.now(),k=5,minimumSamples=30}={}) {
  const samples=(Array.isArray(rows)?rows:[]).map(row=>{
    const sample=validateAnalystReviewSample(row?.sample||row||{});
    const items=Array.isArray(row?.items)?row.items:[];
    const labels=Object.fromEntries(sample.itemLabels.map(x=>[x.itemId,x.relevant]));
    const metrics=evaluateSearchQuality({items,labels,query:sample.query,window:sample.searchWindow,now,k});
    return {sampleId:sample.sampleId,language:sample.language,domain:sample.domain,reviewedAt:sample.reviewedAt,
      reviewerId:sample.reviewerId,metrics};
  });
  const minSamples=Math.max(1,Math.min(1000,Number(minimumSamples)||30));
  const aggregate=group=>{
    const totalReturned=group.reduce((n,x)=>n+x.metrics.k,0);
    const truePositiveAtK=group.reduce((n,x)=>n+x.metrics.truePositiveAtK,0);
    const falsePositiveAtK=group.reduce((n,x)=>n+x.metrics.falsePositiveAtK,0);
    const labelledRelevant=group.reduce((n,x)=>n+x.metrics.labelledRelevant,0);
    const retrievedRelevant=group.reduce((n,x)=>n+x.metrics.retrievedRelevant,0);
    const falseNegative=group.reduce((n,x)=>n+x.metrics.falseNegative,0);
    const macroPrecision=group.length?group.reduce((n,x)=>n+x.metrics.precisionAtK,0)/group.length:0;
    const macroRecall=group.length?group.reduce((n,x)=>n+x.metrics.recall,0)/group.length:0;
    return {sampleCount:group.length,minimumSamplesRequired:minSamples,
      evaluationStatus:group.length>=minSamples?'SAMPLE_THRESHOLD_MET':'INSUFFICIENT_REVIEWED_SAMPLES',
      totalReturned,truePositiveAtK,falsePositiveAtK,labelledRelevant,retrievedRelevant,falseNegative,
      microPrecisionAtK:totalReturned?Number((truePositiveAtK/totalReturned).toFixed(3)):0,
      microRecall:labelledRelevant?Number((retrievedRelevant/labelledRelevant).toFixed(3)):0,
      macroPrecisionAtK:Number(macroPrecision.toFixed(3)),macroRecall:Number(macroRecall.toFixed(3)),
      note:'Metrics apply only to the supplied analyst-reviewed sample set; threshold attainment does not prove representativeness.'};
  };
  const groupBy=key=>Object.fromEntries([...new Set(samples.map(x=>x[key]))].sort().map(value=>[value,aggregate(samples.filter(x=>x[key]===value))]));
  return {generatedAt:now,totalSamples:samples.length,minimumSamplesRequired:minSamples,
    evaluationStatus:samples.length>=minSamples?'SAMPLE_THRESHOLD_MET':'INSUFFICIENT_REVIEWED_SAMPLES',
    overall:aggregate(samples),byLanguage:groupBy('language'),byDomain:groupBy('domain'),samples,
    note:'No production accuracy claim. Report sampling frame, reviewer protocol, language/domain coverage and time window. A sample threshold is a governance minimum, not a guarantee of statistical representativeness.'};
}
