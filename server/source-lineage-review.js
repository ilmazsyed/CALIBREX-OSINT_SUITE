import crypto from 'node:crypto';

export function createSourceLineageReview({candidate,decision,rationale,actor,now=Date.now()}={}) {
  const status=String(decision||'').toUpperCase();
  if(!candidate||!Array.isArray(candidate.evidenceIds)||candidate.evidenceIds.length!==2||candidate.evidenceIds[0]===candidate.evidenceIds[1])throw new Error('A two-item lineage candidate is required.');
  if(!['ACCEPTED','REJECTED'].includes(status))throw new Error('Decision must be ACCEPTED or REJECTED.');
  const note=String(rationale||'').trim();
  if(note.length<12)throw new Error('A rationale of at least 12 characters is required.');
  if(!actor)throw new Error('An authenticated analyst is required.');
  return {id:crypto.randomUUID(),evidenceIds:candidate.evidenceIds.map(String).sort(),decision:status,
    rationale:note.slice(0,2000),signals:Array.isArray(candidate.signals)?candidate.signals.slice(0,20):[],
    candidateReviewOnly:true,independentCorroboration:false,reviewedBy:String(actor),reviewedAt:now};
}
