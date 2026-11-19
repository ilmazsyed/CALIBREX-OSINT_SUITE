import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvestigation } from '../intelligence.js';
import { buildInvestigationReport } from '../investigation-report-builder.js';
import { buildInvestigationGeoJson, buildInvestigationKml } from '../geospatial-export.js';
import { buildInvestigationGraph } from '../intelligence-graph.js';
import { validateWorkflowTasks } from '../investigation-workflow.js';
import { createReportVersion, transitionReportVersion } from '../investigation-reports.js';
import { renderInvestigationPdf } from '../investigation-pdf-renderer.js';

test('end-to-end case acceptance: validated evidence → graph/timeline inputs → report → GIS and approved PDF exports',()=>{
 const preview='data:image/jpeg;base64,'+'A'.repeat(100);
 const caseRecord=validateInvestigation({
  id:'acceptance-case',title:'Port disruption assessment',objective:'Assess a reported disruption using traceable evidence',revision:4,
  evidence:[
   {id:'ev-official',title:'Port authority notice',url:'https://port.example/notice',source:'Port Authority',published:1763500000000,capturedAt:1763500100000,assessment:'CLAIM',triage:'REVIEWED',lat:22.57,lon:88.36,accuracyMeters:30,sha256:'a'.repeat(64),sourceTimestamp:'2026-11-19T08:00:00Z',locationMethod:'ANALYST_REVIEW',metadataOrigin:'SOURCE_DOCUMENT'},
   {id:'ev-video',title:'Field video',url:'https://video.example/clip.mp4',source:'Field reporter',assessment:'ASSESSMENT',triage:'NEW',lat:22.571,lon:88.361,videoSha256:'b'.repeat(64),videoMetadata:{containerCreationTime:'2026-11-19T08:00:00Z',locationRaw:'+22.571+088.361/',locationStandard:'ISO 6709',keyframes:[{id:'frame-1',timestampSeconds:12,timecode:'00:00:12',sha256:'c'.repeat(64),previewDataUrl:preview,visualNote:'Smoke visible near the terminal',candidateLocation:{name:'Possible terminal gate',lat:22.571,lon:88.361,status:'UNVERIFIED'}}]}}
  ],
  entities:[{id:'port-org',name:'Port Authority',type:'ORGANIZATION',resolution:'CANDIDATE',sourceEvidenceIds:['ev-official']}],
  notes:[{id:'note-1',text:'Seek independent vessel movement evidence',createdAt:1763500200000}],
  workflowStatus:'ANALYSIS',workflowHistory:[{id:'wf-1',from:'TRIAGE',to:'ANALYSIS',actorId:'analyst-1',actorRole:'analyst',at:1763500300000}]
 });
 const taskResult=validateWorkflowTasks([{id:'task-1',title:'Collect vessel movement evidence',ownerId:'analyst-1',status:'IN_PROGRESS',priority:'HIGH',dueAt:1763600000000}]);
 assert.equal(taskResult.valid,true);
 const withTasks={...caseRecord,workflowTasks:taskResult.tasks,workflowTaskHistory:[{id:'task-event-1',taskId:'task-1',action:'ADDED',title:'Collect vessel movement evidence',role:'analyst',at:1763500400000}]};
 const report=buildInvestigationReport(withTasks,{ledgerHead:'d'.repeat(64)});
 assert.match(report.markdown,/Port authority notice/);
 assert.match(report.markdown,/Video keyframe review/);
 assert.match(report.markdown,/UNVERIFIED/);
 const graph=buildInvestigationGraph(withTasks);
 assert.ok(graph.summary.evidenceCount>=2);
 const geojson=buildInvestigationGeoJson(withTasks,'2026-11-20T00:00:00Z');
 assert.equal(geojson.features.length,2);
 assert.equal(geojson.features[0].geometry.coordinates[0],88.36);
 const kml=buildInvestigationKml(geojson);
 assert.match(kml,/<Placemark>/);
 assert.match(kml,/accuracyMeters/);
 const draft=createReportVersion({input:{title:report.title,content:report.markdown},actor:'analyst-1',versions:[],now:100});
 const approved=transitionReportVersion(draft,'APPROVED','reviewer-1',200);
 const pdf=renderInvestigationPdf({title:approved.title,content:approved.content,caseId:withTasks.id,version:approved.version,generatedAt:approved.approvedAt,evidence:withTasks.evidence,geojson});
 const pdfText=pdf.toString('latin1');
 assert.ok(pdfText.startsWith('%PDF-1.4'));
 assert.ok(pdfText.includes('Annexure A'));
 assert.ok(pdfText.includes('Annexure B'));
 assert.ok(pdfText.includes('Port Authority'));
 assert.ok(pdfText.includes('Smoke visible near the terminal'));
 assert.ok(pdfText.endsWith('%%EOF'));
});
