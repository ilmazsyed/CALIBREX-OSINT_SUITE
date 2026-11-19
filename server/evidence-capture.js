import crypto from 'node:crypto';

const text=(value,max=200000)=>String(value??'').trim().slice(0,max);
const allowedSourceTypes=new Set(['OFFICIAL','PRIMARY','GOVERNMENT','REGULATORY','COURT','SENSOR_PRIMARY','NEWS','MEDIA','RESEARCH','NGO','ACADEMIC','SOCIAL','UNKNOWN']);
const allowedAssessments=new Set(['FACT','CLAIM','ASSESSMENT','HYPOTHESIS','UNKNOWN']);

export function buildArticleEvidenceRecord({url,article=null,sourceType='UNKNOWN',assessment='CLAIM',analystId='',capturedAt=Date.now(),captureError=''}={}) {
  const safeUrl=text(url,2000);
  let canonicalUrl='';
  try { const parsed=new URL(safeUrl); if(!['http:','https:'].includes(parsed.protocol)) throw new Error('unsupported'); parsed.hash=''; canonicalUrl=parsed.toString(); }
  catch { throw new Error('A valid public HTTP or HTTPS article URL is required.'); }
  const captured=!!article&&!!text(article.text);
  const body=captured?text(article.text):'';
  const title=text(article?.title,300)||'Untitled source';
  const digest=captured?crypto.createHash('sha256').update(body,'utf8').digest('hex'):null;
  const provenance=captured?article.provenance||{}:{};
  const validHash=/^[a-f0-9]{64}$/i.test(String(provenance.sha256||''))?String(provenance.sha256).toLowerCase():null;
  const kind=String(sourceType||'UNKNOWN').toUpperCase();
  const classification=allowedSourceTypes.has(kind)?kind:'UNKNOWN';
  const assessmentValue=String(assessment||'CLAIM').toUpperCase();
  return {
    id:'ev_'+crypto.randomUUID(),type:'observation',sourceType:classification,
    title, url:canonicalUrl,source:text(article?.siteName||article?.byline||new URL(canonicalUrl).hostname,120),
    published:article?.publishedAt?Date.parse(article.publishedAt)||null:null,
    capturedAt:Number(capturedAt)||Date.now(),contentSnapshot:body||null,
    sha256:digest,hashScope:captured?'SOURCE_CONTENT_SNAPSHOT':'NO_SOURCE_CONTENT',
    sourceCaptureSha256:validHash,sourceCaptureAlgorithm:'SHA-256',
    sourceCaptureUrl:text(provenance.url||canonicalUrl,2000),
    sourceCaptureBytes:Number(provenance.bytes)||Buffer.byteLength(body,'utf8'),
    sourceCaptureAt:Number(provenance.capturedAt)||Number(capturedAt)||Date.now(),
    sourceCaptureAtIso:text(provenance.capturedAtIso||new Date(Number(capturedAt)||Date.now()).toISOString(),40),
    provenanceStatus:captured?'SOURCE_CAPTURED':'SOURCE_UNAVAILABLE',
    captureStatus:captured?'CAPTURED':'UNAVAILABLE',
    captureError:captured?'':text(captureError,500),
    origin:'EXTERNAL_SOURCE',assessment:allowedAssessments.has(assessmentValue)?assessmentValue:'CLAIM',
    triage:'NEW',sourceIndependence:'UNKNOWN',notes:analystId?'Captured by analyst '+text(analystId,100):'Captured from public URL; source content is preserved with a SHA-256 fingerprint.'
  };
}
