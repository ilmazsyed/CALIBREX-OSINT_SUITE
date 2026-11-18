# Intelligence Core 2.0 — graph and defence reference foundation

## Scope

This increment adds two bounded, authenticated capabilities:

- A case-scoped graph projection over the investigation's existing entities, evidence, hypotheses, PIRs and analyst-entered relationships.
- A per-user strategic-level defence reference registry for public-source records covering organisations, units, platforms, installations, exercises, procurement, capabilities and events.

It does not claim automatic identity resolution, a comprehensive order of battle, live force disposition, tactical tracking or classified intelligence.

## Case graph API

`GET /api/investigations/:id/graph`

The endpoint uses the existing authenticated case/workspace access check. It returns:

- Entity, evidence, hypothesis and PIR nodes.
- Explicit entity-to-evidence and hypothesis-to-evidence references.
- Analyst-recorded relationships, with their assessment state and cited evidence IDs.
- Candidate edges for exact shared canonical URLs or highly similar titles.

Candidate edges are always `MACHINE_SUGGESTED`, `reviewRequired:true` and `independentCorroboration:false`. They are not counted as corroboration and do not assert that two reports concern the same event. Graph size is bounded to protect request cost and response size.

## Defence reference registry API

- `GET /api/defence-intelligence/registry` — return the signed-in user's public reference records and coverage summary.
- `PUT /api/defence-intelligence/registry` — validate and replace the signed-in user's registry with at most 500 submitted records.

Each record has a stable ID, record type, country, aliases, optional parent reference, descriptive attributes, temporal validity, analyst review state, confidence and source references. Unsafe/non-HTTP URLs are discarded. Missing source or temporal data is explicitly surfaced. The registry is stored in the existing per-user store; it is not shared across users or organisations in this increment.

`REVIEWED` means an analyst has reviewed the record and its sources. It is not an external certification. Catalogue counts do not represent force size, readiness or capability completeness.

## Safety and analytic boundaries

- Only public-source strategic reference records are in scope.
- No precise operational coordinates, targeting, force-readiness score or live operational availability is produced.
- Absence from the registry is not evidence of absence.
- A machine candidate link is not a confirmed identity, event, relationship or independent source.
- Existing provider credentials, Claude publishing and public-source connectors are unchanged. No new API key is required.

## Verification

Automated tests cover graph provenance, explicit-vs-candidate edge semantics, same-case evidence references, unsafe URLs, graph bounds, registry validation, source provenance, temporal validity and missing-data handling.

CI green is a necessary merge gate, not proof of live source coverage or analyst accuracy. Staging acceptance and analyst review remain separate release gates.
