# Specialist Intelligence Operations — Release 4

## What is operational now in this branch

### Collection
- Each of the five roles has a focused, keyless public-web collection plan.
- Manual collection runs three role-specific searches through the existing multi-provider news search engine, merges matching items from the existing live feed snapshot, deduplicates by URL/headline and captures up to ten readable article bodies.
- Strategic and Supply Chain collection also requests five World Bank country indicators. Supply Chain additionally queries the public UN Comtrade preview endpoint for partner-level import/export records. Provider failures are recorded as gaps, never silently converted into zero values.
- Publisher URL, source, capture time, publication time and content hash are retained. Official, media and social evidence classes are preserved. Social/community material remains an unverified lead.
- Per-operator workspaces persist observations, source collection history, macro/trade context, analyst subject and saved assessments using the existing per-user store.

### Continuous capture
- Operators may enable auto-capture separately for each role.
- The server checks the existing shared feed snapshot every ten minutes and saves role-matching items to opted-in users' private workspaces.
- Auto-capture does not run additional searches or independently poll every source. It reuses the platform's existing feed collection.
- Auto-capture is off by default and can be disabled per role.

### Assessment fusion
- Defence: six-lane collection coverage, claim decomposition, evidence references, source-independence-aware defence brief and conflict-watch context.
- Corporate Risk: analyst-supplied company name/registration identifier, corporate/adverse-media chronology, ownership caveats and the existing official OFAC SDN/consolidated-list screening result when a subject is supplied.
- Supply Chain: UN Comtrade partner concentration by import/export flow where the public preview responds, World Bank context, live maritime news and sanctioned-vessel context. Partner-country concentration is explicitly not supplier-company concentration.
- Geopolitical: event chronology, disputed/unverified claim status, existing geospatial event and conflict-watch context.
- Strategic: World Bank macro indicators, existing market context, analyst-entered drivers, scenarios and forecasts with scenario probability validation.
- Every role supports analyst-authored judgement, confidence, alternatives, implications and a review date. These are stored with the assessment.

## Authenticated endpoints
- GET /api/specialist-operations/:role — private workspace and status.
- POST /api/specialist-operations/:role/collect — focused public-source collection.
- POST /api/specialist-operations/:role/assess — fuse saved evidence and persist an assessment plus analyst review.
- PUT /api/specialist-operations/:role/monitor — enable/disable ten-minute existing-feed capture.
- POST /api/specialist-operations/:role/clear — clear that role's private workspace.
- POST /api/specialist-analytics/:role — stateless specialist analytic engine.
- GET /api/specialist-workflows and POST /api/specialist-workflows/:role/validate — workflow requirements and structural completeness.

## User interface
The Specialist Intelligence Centre is available in the Investigate navigation group. It provides role selection, focus and stable-identifier fields, country context, collection, assessment, auto-capture control, evidence list, analyst judgement and optional JSON planning inputs.

## Operational boundaries
- No new API keys, X bearer token or mandatory credentials have been introduced.
- Existing AIS data remains dependent on the pre-existing AIS integration/configuration. The specialist workflow does not add or require an AIS key.
- Public web search coverage and publisher readability vary. Search results are not exhaustive.
- World Bank indicators are annual/lagged structural context, not real-time market intelligence.
- UN Comtrade preview data may be rate-limited or unavailable; no partner concentration is reported when no usable records arrive.
- OFAC screening results are potential matches and require identifier-level human resolution. A no-match result is not legal clearance.
- Corporate registries, complete beneficial ownership, private contracts, inventory, shipment-level tracking and comprehensive live AIS are not implied.
- Geospatial/conflict and maritime context reuses existing platform modules and inherits their coverage/latency limits.
- No classified order of battle, tactical tracking, target selection, operational planning or attribution is produced.

## Acceptance criteria before claiming the requested ratings
### Defence 8.5
1. Six lanes represented with visible gaps.
2. Source provenance and independence groups preserved.
3. Corroboration separated from truth and intent.
4. Conflict-watch and official/public-source context included.
5. Analyst judgement, confidence, alternatives, implications and review date saved.
6. CI and end-to-end analyst acceptance pass.

### Other roles 7.5 minimum
1. Role-specific collection and provenance.
2. At least one relevant structured public dataset/context source where available.
3. Explicit unassessed states for unavailable or missing data.
4. Role-specific analysis, saved analyst judgement and review triggers.
5. CI and end-to-end analyst acceptance pass.

A successful build/test run validates software behaviour, not intelligence accuracy. Operational scores remain provisional until source availability, end-to-end use and analyst acceptance are verified in the deployed environment.
