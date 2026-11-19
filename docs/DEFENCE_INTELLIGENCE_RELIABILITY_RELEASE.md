# Defence Intelligence Reliability Release

## Scope

This release hardens Calibrex OSINT Studio's public-source intelligence workflow. It is designed for research, monitoring and analyst-led assessment. It is not an autonomous operational intelligence system and does not establish facts from reporting volume.

## P0 controls

| Control | Implementation | Acceptance boundary |
|---|---|---|
| Search-window correctness | Requested 1d/3d/7d/30d window is passed to GDELT and Google News; freshness filter remains authoritative | Search fixtures verify provider URL/window mapping; live source availability remains external |
| Original-source evidence capture | POST /api/investigations/:id/evidence/capture saves readable article text, capture timestamp, content hash and source-reader fingerprint | Capture failures remain explicit URL-only records; publisher access restrictions are not bypassed |
| Source taxonomy | Live source labels are normalised before source reliability scoring | Score describes source-record context, not truth probability |
| Source lineage | Existing lineage engine and analyst review workflow retained | Similarity is a lead; no automated independence certification |
| Corroboration | Explicit evidence relationships and source lineage are combined in quality output | Different domains alone never count as independent corroboration |
| Geospatial uncertainty | Conflict clusters disclose place-centroid precision and unverified incident location | No map pin is described as a verified incident coordinate without evidence |
| Collection failures | Capture state, provenance state and error are preserved in evidence and reports | Failed source reads cannot silently appear as captured content |

## P1 controls

| Control | Implementation | Acceptance boundary |
|---|---|---|
| Event clustering | Headline similarity plus temporal proximity; reports remain individually linked | Candidate cluster is not proof of one incident |
| Severity handling | Highest source headline classification is retained; report count does not increase severity | Severity is not analyst-verified impact |
| Structured discrepancy detection | Candidate mismatches in reported figures, event timestamps and location claims | Candidate only; analyst must inspect original context |
| Contradiction review | Existing CONTRADICTS evidence relationships are surfaced in quality output and reports | Semantic contradiction detection is not claimed |
| Timeline | Publication, source metadata, event and collection times remain distinct | Timeline order does not establish causation |
| Intelligence reporting | Reports include capture integrity, source lineage, discrepancy candidates, confidence, hypotheses, gaps and limitations | Every key judgement requires analyst review and evidence linkage |
| Analyst workbench | Search capture state and discrepancy candidates are visible in Investigation Studio | Analysts must save and review the current case revision |

## API entry points

- POST /api/investigations/:id/evidence/capture — capture a public article into a saved investigation.
- GET /api/investigations/:id/validation — evidence, source reliability, source grouping, geospatial checks and quality assessment.
- GET /api/investigations/:id/quality — consolidated lineage, corroboration, discrepancy, timeline, geospatial and capture status.
- GET /api/investigations/:id/source-lineage — candidate upstream relationships.
- POST /api/investigations/:id/source-lineage/reviews — record an analyst lineage decision.
- POST /api/investigations/:id/reports/generate — create a versioned intelligence report.
- GET /api/investigations/:id/evidence-ledger/verify — verify the application-level evidence hash chain.

## Release gate

Do not merge or deploy unless the latest PR-head CI run passes:
1. Dependency audit
2. Type check
3. Complete automated test suite
4. Production client build

After merge, run the staging smoke test and a two-geography analyst acceptance test. Confirm that one geography is South Asia and the second is geographically unrelated. Test 7-day and 30-day searches, article capture success and failure, same-event candidate clustering, different-event separation, source lineage, contradictory figures, geospatial uncertainty, report export and evidence-ledger verification.

## Known limitations

- Publisher capture may fail due to paywalls, robots controls, anti-bot measures, content changes or unsupported formats.
- A source-content hash proves only the integrity of the captured text as stored; it does not prove publisher authenticity or completeness.
- Domain grouping and lineage similarity do not prove source independence.
- Gazetteer centroids are not incident coordinates.
- Structured discrepancy candidates can be false positives and are not confirmed contradictions.
- External source freshness and availability are not under Calibrex's control.
- Application-level hash chaining is tamper evidence, not independently timestamped WORM storage.
