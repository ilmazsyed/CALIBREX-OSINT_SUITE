// Cross-language social repost/near-duplicate candidates. Review leads only;
// text similarity cannot establish coordination, copying, account ownership or intent.
const STOP=new Set(['the','and','for','with','from','that','this','have','has','was','were','are','will','said','says','में','का','की','के','और','पर','है','हैं','को','से','একটি','এবং','এই','সেই','করে','হয়','হবে']);
function normalise(value){
 return String(value||'').toLowerCase().replace(/https?:\/\/\S+/gu,' ').replace(/@[\p{L}\p{N}_]+/gu,' ')
  .replace(/[^\p{L}\p{N}# ]/gu,' ').replace(/\s+/g,' ').trim();
}
function tokens(value){return new Set((normalise(value).match(/[\p{L}\p{N}#]{2,}/gu)||[]).filter(t=>!STOP.has(t)));}
function dice(a,b){if(!a.size||!b.size)return 0;let overlap=0;for(const x of a)if(b.has(x))overlap++;return 2*overlap/(a.size+b.size);}
export function detectSocialDuplicateCandidates(items=[],{windowMs=60*60000,similarityThreshold=.8,maxItems=300,maxPairs=1000}={}){
 const rows=(Array.isArray(items)?items:[]).filter(x=>x?.kind==='social'&&Number(x.published)>0&&String(x.id||''))
  .slice(0,maxItems).map(item=>({item,terms:tokens([item.title,item.summary].filter(Boolean).join(' '))}))
  .filter(x=>x.terms.size>=4).sort((a,b)=>Number(b.item.published)-Number(a.item.published));
 const pairs=[];
 for(let i=0;i<rows.length&&pairs.length<maxPairs;i++){
  for(let j=i+1;j<rows.length&&pairs.length<maxPairs;j++){
   const a=rows[i],b=rows[j],delta=Math.abs(Number(a.item.published)-Number(b.item.published));
   if(delta>windowMs)continue;
   const score=dice(a.terms,b.terms);
   if(score<similarityThreshold)continue;
   const sameAccount=!!a.item.authorId&&String(a.item.authorId)===String(b.item.authorId);
   pairs.push({id:[String(a.item.id),String(b.item.id)].sort().join(':'),leftId:String(a.item.id),rightId:String(b.item.id),
    similarity:Number(score.toFixed(3)),timeDeltaMs:delta,accountRelation:sameAccount?'SAME_ACCOUNT':'DIFFERENT_OR_UNKNOWN_ACCOUNT',
    classification:sameAccount?'SAME_ACCOUNT_REPEAT':'CROSS_ACCOUNT_NEAR_DUPLICATE',
    independentCorroboration:false,reviewRequired:true,
    evidence:[{id:String(a.item.id),title:String(a.item.title||'').slice(0,300),url:String(a.item.url||''),source:String(a.item.source||''),authorId:String(a.item.authorId||'')},
     {id:String(b.item.id),title:String(b.item.title||'').slice(0,300),url:String(b.item.url||''),source:String(b.item.source||''),authorId:String(b.item.authorId||'')}]});
  }
 }
 return {generatedAt:Date.now(),windowMs,similarityThreshold,totalCandidates:pairs.length,pairs,
  note:'Text similarity is a review lead. Different accounts are not necessarily independent sources; repeated text does not establish coordination, copying, common control, or intent. These pairs must not be counted as independent corroboration.'};
}
