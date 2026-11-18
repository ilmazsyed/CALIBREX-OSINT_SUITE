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
  const freshnessLagMs=dated.length?dated.map(x=>Math.max(0,now-Number(x.published))).sort((a,b)=>a-b)[Math.floor((dated.length-1)/2)]:null;
  return {
    query,window,k:top.length,totalInput:Array.isArray(items)?items.length:0,totalReturned:ranked.length,
    labelledRelevant:relevantIds.size,precisionAtK:Number(precisionAtK.toFixed(3)),
    recall:Number(recall.toFixed(3)),staleOrFutureRate:Number(staleOrFutureRate.toFixed(3)),
    medianPublicationAgeMs:freshnessLagMs,
    note:'Fixture/sample retrieval metrics only. They do not measure truth, credibility, completeness, or operational intelligence value.'
  };
}
