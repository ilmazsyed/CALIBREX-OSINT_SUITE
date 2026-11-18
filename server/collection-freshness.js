/**
 * Collection freshness separates source publication age from collection delay.
 * When per-item collectedAt is absent, snapshotAt is used as an explicitly
 * labelled proxy; it is not an exact per-item ingestion timestamp.
 */
export function assessCollectionFreshness(items=[], {snapshotAt=null,now=Date.now(),staleAfterMs=6*60*60*1000}={}) {
  const rows=(Array.isArray(items)?items:[]).map(item=>{
    const published=Number(item?.published);
    const collected=Number(item?.collectedAt)||Number(snapshotAt)||null;
    const publicationAgeMs=Number.isFinite(published)&&published>0?Math.max(0,now-published):null;
    const collectionDelayMs=collected&&Number.isFinite(published)&&published>0?Math.max(0,collected-published):null;
    return {id:String(item?.id||''),source:String(item?.source||''),publishedAt:published>0?published:null,
      collectedAt:collected,collectionTimestampType:Number(item?.collectedAt)>0?'ITEM_CAPTURE':'FEED_SNAPSHOT_PROXY',
      publicationAgeMs,collectionDelayMs,publicationDateUnverified:publicationAgeMs===null,
      stale:publicationAgeMs!==null&&publicationAgeMs>staleAfterMs};
  });
  const values=key=>rows.map(x=>x[key]).filter(Number.isFinite).sort((a,b)=>a-b);
  const median=a=>a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):null;
  const publicationAges=values('publicationAgeMs'),delays=values('collectionDelayMs');
  return {generatedAt:now,total:rows.length,dated:publicationAges.length,unverified:rows.length-publicationAges.length,
    stale:rows.filter(x=>x.stale).length,medianPublicationAgeMs:median(publicationAges),
    medianCollectionDelayMs:median(delays),items:rows,
    note:'Publication age measures time since publisher timestamp. Collection delay measures capture minus publication time; when item-level capture time is absent, feed snapshot time is only a proxy. Neither metric establishes source reliability or completeness.'};
}
