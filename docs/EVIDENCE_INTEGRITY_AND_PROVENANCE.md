# Evidence integrity and provenance contract

## Stable identity
Every case, evidence item, analyst note, hypothesis, entity and relationship receives a server-generated UUID when the client omits an ID. Existing IDs are retained on updates so references remain stable. Evidence references in assessments, hypotheses, entities and relationships are filtered against the current case evidence register.

## Two distinct hashes
- `sha256` fingerprints the UTF-8 source text in `contentSnapshot` (or an equivalent supplied extracted-text field). Its `hashScope` is `SOURCE_CONTENT_SNAPSHOT`.
- `recordSha256` fingerprints the normalized evidence metadata record. It supports record-integrity checks even when no article text was captured.
- A client-supplied hash without a captured snapshot is marked `EXTERNALLY_SUPPLIED_HASH_UNVERIFIED`; Calibrex does not claim to have independently verified it.
- If no source text or valid supplied hash exists, `sha256` remains null and `hashScope` is `NO_SOURCE_CONTENT`.

A hash proves that the bytes captured by the platform have not changed relative to that digest. It does not prove that a publisher is truthful, that the page was authentic at the time of publication, or that the source was not manipulated before capture.

## Provenance classes
- `SOURCE_CAPTURED`: an external URL and source text snapshot are present.
- `SOURCE_LINK_ONLY`: an external URL is present, but the source body was not captured.
- `ANALYST_SUPPLIED_NO_EXTERNAL_SOURCE`: no valid external URL is present. The record remains a legitimate analyst observation, but must not be represented as a source-verified article.

## Source independence
Publisher-domain count is descriptive only. The assessment completeness score credits source diversity only when an analyst explicitly marks the source as `INDEPENDENT_VERIFIED`. Ownership and syndication groups can be used to prevent multiple labels or domains from inflating independence. Unassessed sources do not count as verified independent corroboration.

## MCP case updates
The case preparation tool exposes hypotheses, entities, relationships, structured judgements, assumptions, alternatives, indicators, scenarios, saved searches, monitoring, questions and priority requirements. Writes remain subject to the existing browser approval workflow.

## Revision history
Each update records the resulting revision number, post-update evidence and note counts, and explicit before/after counts. The `calibrex_get_case` MCP read now returns a separate `evidenceIntegrity` report that verifies non-empty unique IDs, captured-content hashes, record hashes and provenance consistency, alongside the append-only ledger verification. The combined `overallIntegrity` flag is true only when both checks pass. The ledger remains a tamper-evident change record; it is not a substitute for source-content capture.

## Evidence collection through MCP
`calibrex_collect_case_evidence` searches the current intelligence feed, reads original public article pages where available, and returns evidence-ready records with captured article text and a SHA-256 fingerprint. It reports missing URLs and extraction failures instead of silently upgrading headlines into captured source evidence. The returned records can be passed to `calibrex_prepare_case_change` for browser-approved case updates. Collection remains bounded to 12 results per call; analysts should collect in focused batches and review relevance before committing.
