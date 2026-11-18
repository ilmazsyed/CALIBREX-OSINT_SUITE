import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { parseFeedXml } from './feeds.js';
/**
 * Curated source-candidate registry.
 * Candidates are separate from active collection until endpoint, provenance,
 * access and licence review has passed. Never store API secrets in this registry.
 */
export const CANDIDATE_STATES = ['discovered','pending_validation','validated','active','rejected','suspended'];
export const SOURCE_LAYER_IDS = ['official','news','social','geospatial','mobility','economic'];
const LICENCE_STATES = ['review-required','public-domain','open','permission-required','restricted'];
const clean = (value, max=500) => String(value ?? '').trim().slice(0,max);
const validCountry = value => value == null || /^[A-Z]{2}$/.test(String(value));
const safeHttpUrl = value => {
  let url;
  try { url = new URL(String(value)); } catch { return null; }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
  if (net.isIP(host) === 4) { const octets=host.split('.').map(Number); const [a,b]=octets; if (a===0 || a===10 || a===127 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || a>=224) return null; }
  if (net.isIP(host) === 6 && (host === '::' || host === '::1' || /^(fc|fd|fe[89ab])/i.test(host))) return null;
  if (url.port && !['80','443'].includes(url.port)) return null;
  if (/(^|[?&])(api[_-]?key|token|access[_-]?token|secret|password|auth)=/i.test(url.search)) return null;
  return url;
};

export function normaliseSourceCandidate(input={}, id='') {
  const endpoint = clean(input.endpoint, 2000);
  const url = safeHttpUrl(endpoint);
  const row = {
    id: clean(id || input.id, 80),
    name: clean(input.name, 160),
    layer: clean(input.layer, 40),
    category: clean(input.category, 100),
    region: clean(input.region, 100),
    country: input.country ? (/^[A-Za-z]{2}$/.test(String(input.country).trim()) ? String(input.country).trim().toUpperCase() : clean(input.country,20)) : null,
    subdivision: clean(input.subdivision,100) || null,
    endpoint: url ? url.toString() : endpoint,
    accessMethod: clean(input.accessMethod,50),
    accessModel: clean(input.accessModel,80),
    language: clean(input.language,80),
    cadenceMinutes: Number(input.cadenceMinutes || 15),
    licence: clean(input.licence || 'review-required',40),
    licenceEvidence: clean(input.licenceEvidence,1000),
    provenance: clean(input.provenance,1000),
    authRequired: Boolean(input.authRequired),
    authNotes: clean(input.authNotes,500),
    independenceGroup: clean(input.independenceGroup,120) || null,
    status: clean(input.status || 'pending_validation',40),
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Date.now(),
    validation: input.validation && typeof input.validation === 'object' ? input.validation : null,
    rejectionReason: clean(input.rejectionReason,500) || null,
  };
  return row;
}

export function validateCandidateMetadata(row) {
  const errors=[];
  if (!row.id) errors.push('A stable candidate ID is required.');
  if (!row.name) errors.push('Source name is required.');
  if (!SOURCE_LAYER_IDS.includes(row.layer)) errors.push('Choose one of the six supported intelligence layers.');
  if (!row.category) errors.push('Source category is required.');
  if (!row.region) errors.push('Geographic region or Global / multilateral is required.');
  if (!validCountry(row.country)) errors.push('Country must be an ISO alpha-2 code.');
  if (!safeHttpUrl(row.endpoint)) errors.push('Endpoint must be a public HTTP(S) URL without embedded credentials, unsafe ports or secret query parameters.');
  if (!row.accessMethod) errors.push('Access method is required.');
  if (!row.accessModel) errors.push('Access model is required.');
  if (!row.language) errors.push('Language is required.');
  if (!Number.isFinite(row.cadenceMinutes) || row.cadenceMinutes < 1 || row.cadenceMinutes > 10080) errors.push('Cadence must be between 1 minute and 7 days.');
  if (!LICENCE_STATES.includes(row.licence)) errors.push('Licence/access status must be explicitly classified.');
  if (!row.licenceEvidence) errors.push('Licence or terms evidence is required; use a review note when terms are unclear.');
  if (!row.provenance) errors.push('Discovery provenance is required.');
  if (!CANDIDATE_STATES.includes(row.status)) errors.push('Candidate status is invalid.');
  if (row.authRequired && !row.authNotes) errors.push('Describe the authentication requirement without including credentials.');
  return errors;
}

export function candidateDuplicate(existing, candidate) {
  const canonical = value => {
    const u = safeHttpUrl(value);
    if (!u) return String(value || '').toLowerCase();
    const params = [...u.searchParams.entries()]
      .filter(([key]) => !/^utm_/i.test(key) && !['fbclid','gclid'].includes(key.toLowerCase()))
      .sort(([ak,av],[bk,bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
    const query = new URLSearchParams(params).toString();
    const pathname = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
    return `${u.origin}${pathname}${query ? `?${query}` : ''}`.toLowerCase();
  };
  return (existing||[]).find(x => x.id !== candidate.id && canonical(x.endpoint) === canonical(candidate.endpoint));
}

export function prepareCandidateBatch(existing=[], inputs=[], makeId=()=>randomUUID()) {
  const accepted = [];
  const rejected = [];
  const duplicates = [];
  for (let index=0; index<inputs.length; index++) {
    const candidate = normaliseSourceCandidate({ ...inputs[index], status: 'pending_validation' }, makeId());
    const errors = validateCandidateMetadata(candidate);
    if (errors.length) { rejected.push({ index, name: candidate.name || null, errors }); continue; }
    const duplicate = candidateDuplicate([...existing, ...accepted], candidate);
    if (duplicate) { duplicates.push({ index, name: candidate.name, duplicateId: duplicate.id }); continue; }
    accepted.push(candidate);
  }
  return { accepted, rejected, duplicates };
}

export function assessCandidateResponse(candidate, response={}) {
  const status = Number(response.status || 0);
  const contentType = String(response.contentType || '').toLowerCase();
  const body = String(response.body || '');
  const checkedAt = Number(response.checkedAt) || Date.now();
  const base = { checkedAt, httpStatus: status || null, contentType: contentType || 'unknown', finalUrl: response.finalUrl || candidate?.endpoint || null, responseBytes: Buffer.byteLength(body) };
  if (status < 200 || status >= 300) return { ...base, passed: false, validationType: 'http', message: `Endpoint returned HTTP ${status || 'unknown'}.` };
  if (!body.trim()) return { ...base, passed: false, validationType: 'content', message: 'Endpoint returned an empty response.' };

  const method = String(candidate?.accessMethod || '').toLowerCase();
  if (/rss|atom/.test(method)) {
    const entries = parseFeedXml(body);
    if (!entries.length) return { ...base, passed: false, validationType: 'feed-content', format: 'rss-atom', itemsFound: 0, message: 'Endpoint is reachable but did not contain any parseable RSS/Atom entries.' };
    return { ...base, passed: true, validationType: 'feed-content', format: 'rss-atom', itemsFound: entries.length, message: `RSS/Atom content parsed successfully (${entries.length} entries). Editorial credibility, source independence and licence remain separate review decisions.` };
  }

  if (/json|geojson|rest api/.test(method) || /application\/(?:geo\+json|json)/.test(contentType)) {
    let payload;
    try { payload = JSON.parse(body); }
    catch { return { ...base, passed: false, validationType: 'structured-content', format: 'json', itemsFound: 0, message: 'Endpoint is reachable but returned invalid JSON.' }; }
    const collection = Array.isArray(payload) ? payload
      : ['features','results','items','records','data'].map(key => payload?.[key]).find(Array.isArray);
    const itemsFound = Array.isArray(collection) ? collection.length : Object.keys(payload || {}).length;
    if (!itemsFound) return { ...base, passed: false, validationType: 'structured-content', format: 'json', itemsFound: 0, message: 'Endpoint returned valid JSON but no usable records were found.' };
    return { ...base, passed: true, validationType: 'structured-content', format: 'json', itemsFound, message: `Structured JSON content parsed successfully (${itemsFound} records/fields). Licence and data-quality review remain separate.` };
  }

  if (/html|xhtml/.test(contentType) || /html listing|web page/i.test(method)) {
    const isHtml = /<(!doctype html|html|head|body)\b/i.test(body);
    if (!isHtml) return { ...base, passed: false, validationType: 'html-content', format: 'html', itemsFound: 0, message: 'Endpoint was expected to return an HTML listing but the response did not look like HTML.' };
    return { ...base, passed: true, validationType: 'reachability-only', format: 'html', itemsFound: null, message: 'HTML listing is reachable. Content extraction adapter and licence review are still required before activation.' };
  }

  return { ...base, passed: true, validationType: 'reachability-only', format: 'unknown', itemsFound: null, message: 'Public endpoint is reachable. A format-specific adapter and licence review are still required before activation.' };
}

export function sourceActivationEligibility(candidate) {
  const errors = [];
  if (candidate?.status !== 'validated') errors.push('Candidate must pass validation first.');
  if (!candidate?.validation?.passed) errors.push('A successful endpoint check is required.');
  if (candidate?.validation?.format !== 'rss-atom' || Number(candidate?.validation?.itemsFound || 0) < 1) errors.push('A parseable RSS/Atom payload with at least one item is required for this feed adapter.');
  if (!['official','news'].includes(candidate?.layer)) errors.push('Only official/news RSS sources are currently supported by the live feed adapter.');
  if (!/rss|atom/i.test(candidate?.accessMethod || '')) errors.push('The live feed adapter currently requires RSS or Atom access.');
  if (!['open','public-domain'].includes(candidate?.licence)) errors.push('An open or public-domain licence must be confirmed before activation.');
  if (!safeHttpUrl(candidate?.endpoint)) errors.push('A safe public HTTP(S) endpoint is required.');
  return errors;
}

export function transitionCandidate(candidate, next, details={}) {
  if (!CANDIDATE_STATES.includes(next)) throw new Error('Unsupported candidate state.');
  const allowed = {
    discovered:['pending_validation','rejected'],
    pending_validation:['validated','rejected','suspended'],
    validated:['active','rejected','suspended','pending_validation'],
    active:['suspended','rejected'],
    suspended:['pending_validation','rejected'],
    rejected:[],
  };
  if (!allowed[candidate.status]?.includes(next)) throw new Error(`Cannot move a ${candidate.status} source to ${next}.`);
  if (next === 'active' && (!candidate.validation?.passed || validateCandidateMetadata(candidate).length)) {
    throw new Error('Only a metadata-complete candidate with a successful endpoint validation can be activated.');
  }
  return {...candidate,...details,status:next,updatedAt:Date.now()};
}
