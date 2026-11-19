import { assessSourceReliability } from './source-reliability.js';
import { validateEvidenceCoordinates, assessGeospatialCorroboration } from './geospatial-validation.js';
import { normalizeGeospatialEvidence } from './geospatial-evidence.js';
import { assessVisualGeolocation } from './visual-geolocation.js';
import { assessInvestigationQuality } from './investigation-quality.js';

const esc=v=>String(v??'').replace(/\r/g,'').trim();
const date=v=>{const n=Number(v);if(Number.isFinite(n)&&n>0)return new Date(n).toISOString();const d=Date.parse(v);return Number.isFinite(d)?new Date(d).toISOString():'Not recorded';};
const md=v=>esc(v).replace(/\|/g,'\\|').replace(/\n/g,' ');
const list=v=>Array.isArray(v)?v:[];
const evidenceRef=e=>`[E-${String(e.id||'').slice(0,12)}]`;

export function buildInvestigationReport(caseRecord={}, options={}) {
 const evidence=list(caseRecord.evidence).slice(0,300);
 const notes=list(caseRecord.notes).slice(0,200);
 const judgements=list(caseRecord.assessment?.keyJudgements).filter(x=>x.status!=='WITHDRAWN');
 const hypotheses=list(caseRecord.hypotheses);
 const timeline=evidence.slice().sort((a,b)=>(Number(a.published||a.capturedAt)||0)-(Number(b.published||b.capturedAt)||0));
 const sourceAssessments=evidence.map(e=>({id:e.id,title:e.title||'Untitled evidence',source:e.source||'Unspecified',url:e.url||'',...assessSourceReliability(e,[])}));
 const geo=evidence.filter(e=>e.lat!==undefined||e.lon!==undefined||e.lng!==undefined||e.exif||e.geospatialMetadata||e.metadata?.GPSLatitude).map(e=>{
  const normalized=normalizeGeospatialEvidence(e);
  const coords=normalized.coordinates||{};
  const validation=validateEvidenceCoordinates({...e,lat:coords.lat,lon:coords.lon,accuracyMeters:normalized.accuracyMeters,sourceTimestamp:normalized.observedAt});
  return {id:e.id,title:e.title,source:e.source,...validation,metadata:normalized.metadata,
    metadataErrors:normalized.errors,metadataCaveats:normalized.caveats,observedAt:normalized.observedAt,observedAtTimezone:normalized.observedAtTimezone,savedPlaceContext:e.geospatialContext||null};
 });
 const geoCorroboration=assessGeospatialCorroboration(geo.filter(g=>g.valid).map(g=>({id:g.id,lat:g.lat,lon:g.lon,accuracyMeters:g.accuracyMeters})));
 const facts=evidence.filter(e=>e.assessment==='FACT'),claims=evidence.filter(e=>e.assessment==='CLAIM');
 const assessments=evidence.filter(e=>e.assessment==='ASSESSMENT'),unknown=evidence.filter(e=>e.assessment==='UNKNOWN');
 const gaps=[];
 if(!evidence.length)gaps.push('No evidence items have been added to this investigation.');
 if(!facts.length)gaps.push('No evidence is currently classified as FACT; claims have not been independently established in this record.');
 if(evidence.some(e=>!e.url))gaps.push('One or more evidence items have no external source URL.');
 if(evidence.some(e=>e.provenanceStatus!=='SOURCE_CAPTURED'))gaps.push('Some evidence is link-only or analyst-supplied rather than captured source content.');
 if(!judgements.length)gaps.push('No structured key judgements have been recorded.');
 if(geo.some(x=>!x.valid||x.warnings?.length))gaps.push('Some geospatial records require validation or analyst review.');
 const title=esc(options.title||caseRecord.title||'Investigation Report');
 const sections=[];
 sections.push('# CALIBREX | INVESTIGATION INTELLIGENCE REPORT');
 sections.push(`## ${title}`);
 sections.push(`**Report generated:** ${new Date(options.generatedAt||Date.now()).toISOString()}  `);
 sections.push(`**Investigation ID:** ${md(caseRecord.id||'Not recorded')}  `);
 sections.push(`**Case status:** ${md(caseRecord.status||'OPEN')} | **Priority:** ${md(caseRecord.priority||'NORMAL')}  `);
 sections.push(`**Evidence items:** ${evidence.length} | **Notes:** ${notes.length} | **Key judgements:** ${judgements.length}`);
 sections.push('---');
 sections.push('## 1. Executive overview');
 sections.push(esc(caseRecord.objective)||'No investigation objective has been recorded.');
 sections.push(`This report is generated from the investigation record as it exists at generation time. It contains ${evidence.length} evidence item(s), ${claims.length} claim(s), ${facts.length} fact-classified item(s), and ${judgements.length} structured key judgement(s). Classification reflects the case record and is not an independent determination of truth.`);
 sections.push('## 2. Key judgements');
 if(judgements.length)for(const j of judgements)sections.push(`### ${esc(j.title)}\n${esc(j.statement)}\n\n**Analyst confidence:** ${Number(j.confidence)||0}/100 (${esc(j.confidenceLevel||'UNASSESSED')})\n\n**Evidence for:** ${list(j.evidenceForIds).map(id=>`[E-${String(id).slice(0,12)}]`).join(', ')||'Not linked'}\n\n**Evidence against:** ${list(j.evidenceAgainstIds).map(id=>`[E-${String(id).slice(0,12)}]`).join(', ')||'Not linked'}\n\n**Assumptions:** ${list(j.assumptions).map(esc).join('; ')||'Not recorded'}`);
 else sections.push('No structured key judgements recorded.');
 sections.push('## 3. Scope and methodology');
 sections.push(`**Objective:** ${esc(caseRecord.objective)||'Not specified'}\n\n**Research questions:**\n${list(caseRecord.questions).map(x=>'- '+esc(x)).join('\n')||'- None recorded'}\n\nThis report preserves the distinction between FACT, CLAIM, ASSESSMENT, HYPOTHESIS and UNKNOWN. Source reliability scores describe source-record context, not the truth probability of individual claims. Geospatial checks validate coordinate structure and detect discrepancies; they do not independently prove event location.`);
 sections.push('## 4. Evidence register');
 if(evidence.length)sections.push('| Ref | Classification | Title | Source | Published | Provenance | URL |\n|---|---|---|---|---|---|---|\n'+evidence.map(e=>`|${evidenceRef(e)}|${md(e.assessment)}|${md(e.title)}|${md(e.source)}|${md(date(e.published))}|${md(e.provenanceStatus)}|${e.url?md(e.url):'Not recorded'}|`).join('\n'));
 else sections.push('No evidence recorded.');
 sections.push('## 5. Source reliability assessment');
 sections.push('Scores are explainable source-level indicators. They are not claim-confidence or truth scores. Historical performance is neutral where adjudicated history is absent.');
 sections.push(sourceAssessments.map(s=>`### ${s.title} (${evidenceRef({id:s.id})})\n**Source:** ${s.source} | **Reliability context:** ${s.score}/100 (${s.band}) | **History:** ${s.historyConfidence}\n\n${s.factors.map(f=>`- ${f.name}: ${f.score}/100 — ${f.reason}`).join('\n')}\n\n${s.caveats.map(x=>'- '+x).join('\n')}`).join('\n\n')||'No sources available for assessment.');
 sections.push('## 6. Geospatial validation');
 sections.push(geo.length?geo.map(g=>{const saved=g.savedPlaceContext;return `- ${evidenceRef({id:g.id})} ${esc(g.title)}: ${g.validationLevel}; coordinates ${g.valid?`${g.lat}, ${g.lon}`:'invalid'}; saved place context: ${saved?esc(saved.displayName||[saved.place?.name,saved.place?.state,saved.place?.country].filter(Boolean).join(', '))+' ('+esc(saved.provider)+', '+esc(saved.licence)+', recorded '+esc(saved.recordedAt)+')':'not recorded'}; observed at: ${g.observedAt||'not recorded'} (${g.observedAtTimezone||'timezone unknown'}); warnings: ${g.warnings.join(', ')||'none'}; errors: ${g.errors.join(', ')||'none'}`;}).join('\n'):'No coordinates were recorded in evidence items.');
 if(geoCorroboration.comparisons.length)sections.push(`Cross-observation comparison: ${geoCorroboration.status}; ${geoCorroboration.summary.consistent} consistent within tolerance, ${geoCorroboration.summary.conflicts} spatial conflicts, ${geoCorroboration.summary.indeterminate} indeterminate. ${geoCorroboration.caveat}`);
 const videoMetadata=evidence.filter(e=>e.videoMetadata).map(e=>`- ${evidenceRef({id:e.id})} ${esc(e.title)}: container creation time ${esc(e.videoMetadata.containerCreationTime||'not recorded')}; location tag ${esc(e.videoMetadata.locationRaw||'not recorded')}; standard ${esc(e.videoMetadata.locationStandard||'not recorded')}; video SHA-256 ${esc(e.videoSha256||'not recorded')}`);
 if(videoMetadata.length)sections.push('Video container metadata:\\n'+videoMetadata.join('\\n')+'\\nContainer creation time is not necessarily camera capture time; embedded location tags are editable and require independent corroboration.');
 const keyframeReviews=evidence.flatMap(e=>(Array.isArray(e.videoMetadata?.keyframes)?e.videoMetadata.keyframes:[]).map(frame=>({
  evidence:e,frame
 })));
 if(keyframeReviews.length)sections.push('## Video keyframe review\\n'+keyframeReviews.map(({evidence:e,frame})=>`- ${evidenceRef({id:e.id})} ${esc(e.title)} · ${esc(frame.timecode||frame.timestampSeconds+'s')}: ${esc(frame.visualNote||'No analyst note')}; preview SHA-256 ${esc(frame.sha256||'not recorded')}; visual location candidate ${esc(frame.candidateLocation?.name||'none')} (${frame.candidateLocation?'UNVERIFIED':'not supplied'})`).join('\\n')+'\\nKeyframes are analyst-selected frame extracts. Visual location candidates are hypotheses only and are not independently verified event locations.');

 const intelligenceQuality=assessInvestigationQuality(caseRecord);
 sections.push('## 6A. Corroboration and source independence');
 sections.push(intelligenceQuality.corroboration.candidateRelationships.length?intelligenceQuality.corroboration.candidateRelationships.map(r=>`- ${r.evidenceIds.map(id=>evidenceRef({id})).join(' ↔ ')}: ${r.status}; independence: ${r.independence}; analyst rationale: ${r.analystRationale||'not recorded'}`).join('\\n'):'No explicit analyst corroboration relationships recorded. Similar headlines or different domains alone are not treated as corroboration.');
 sections.push(intelligenceQuality.corroboration.caveat);
 sections.push('## 6B. Contradictions and competing evidence');
 sections.push(intelligenceQuality.contradictions.items.length?intelligenceQuality.contradictions.items.map(r=>`- ${evidenceRef({id:r.leftEvidenceId})} ${r.leftTitle} ↔ ${evidenceRef({id:r.rightEvidenceId})} ${r.rightTitle}: ${r.status}; rationale: ${r.rationale||'not recorded'}`).join('\\n'):'No analyst-recorded contradiction relationships. This is not evidence that no contradictions exist; automated semantic contradiction detection is not claimed.');
 sections.push('## 6C. Visual geolocation review');
 const visualReviews=evidence.filter(e=>e.visualGeolocationReview).map(e=>({evidence:e,result:assessVisualGeolocation(e.visualGeolocationReview)}));
 sections.push(visualReviews.length?visualReviews.map(({evidence:e,result:r})=>`- ${evidenceRef(e)} ${e.title}: ${r.status} (${r.gateCount.passed}/${r.gateCount.total} gates); candidate: ${r.candidate? r.candidate.name+' '+r.candidate.lat+', '+r.candidate.lon+' ±'+r.candidate.accuracyMeters+'m':'invalid or missing'}; reference hosts: ${r.independentReferenceHosts.join(', ')||'none'}`).join('\\n'):'No analyst visual geolocation reviews recorded.');
 sections.push(visualReviews.flatMap(x=>x.result.caveats).filter((v,i,a)=>a.indexOf(v)===i).map(x=>'- '+x).join('\\n'));
 sections.push('## 7. Timeline reconstruction');
 sections.push(intelligenceQuality.timeline.events.length?intelligenceQuality.timeline.events.map(e=>`- ${e.at?new Date(e.at).toISOString():'Relative event'} — ${evidenceRef({id:e.evidenceId})} ${esc(e.title)} · ${esc(e.label)} · ${e.timezoneCertainty||'timezone not applicable'}${e.offsetSeconds!=null?' · '+e.offsetSeconds+'s offset':''}`).join('\\n'):'No timestamped or relative timeline events available.');
 sections.push(`Timeline coverage: ${intelligenceQuality.timeline.coverage}; ${intelligenceQuality.timeline.datedEventCount} dated events; ${intelligenceQuality.timeline.undatedRelativeEventCount} relative/undated events. ${intelligenceQuality.timeline.caveat}`);
 sections.push('## 8. Hypotheses and competing explanations');
 sections.push(hypotheses.length?hypotheses.map(h=>`- **${esc(h.status)}:** ${esc(h.text)} — evidence: ${list(h.evidenceIds).map(id=>`[E-${String(id).slice(0,12)}]`).join(', ')||'not linked'}`).join('\n'):'No alternative hypotheses recorded.');
 sections.push('## 9. Analyst notes');
 sections.push(notes.length?notes.map(n=>`- ${date(n.createdAt)} — ${esc(n.text)}`).join('\n'):'No analyst notes recorded.');
 sections.push('## 10. Intelligence gaps and limitations');
 sections.push(gaps.length?gaps.map(x=>'- '+x).join('\n'):'No automatic completeness gaps detected. This does not establish that the investigation is complete.');
 sections.push('## 11. Assessment and recommended next steps');
 sections.push('Analyst review is required before publication, operational use or external circulation. Resolve the listed gaps, independently corroborate material claims, investigate contradictory evidence, verify location claims with independent geospatial references, and ensure every key judgement is linked to supporting and disconfirming evidence.');
 sections.push('## 12. Integrity and provenance');
 sections.push(`**Case revision:** ${Number(caseRecord.revision)||'Not recorded'}\n\n**Evidence ledger head:** ${esc(options.ledgerHead||'Not available')}\n\n**Generated by:** Calibrex OSINT Studio\n\nThis report is a derived analytical product. The evidence ledger is application-level tamper evidence and is not independently timestamped WORM storage. Verify ledger status separately before relying on chain-of-custody assertions.`);
 sections.push('---\n**CALIBREX | Intelligence. Evidence. Clarity.**');
 const markdown=sections.join('\n\n');
 const plainText=markdown.replace(/^#{1,6}\s/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\[(E-[^\]]+)\]/g,'$1');
 return {title,markdown,plainText,evidenceCount:evidence.length,generatedAt:Date.now(),caseRevision:Number(caseRecord.revision)||null,
   quality:{gaps,hasEvidence:evidence.length>0,hasKeyJudgements:judgements.length>0,requiresAnalystReview:true}};
}
