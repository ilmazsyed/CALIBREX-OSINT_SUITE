# Intelligence retrieval quality evaluation

## Purpose
This harness computes deterministic retrieval metrics against explicitly labelled fixtures or analyst-reviewed samples. It does not assign truth, credibility, source independence, attribution, or threat severity.

## Metrics
- **Precision@K:** relevant labelled items among the top K returned items.
- **Recall:** relevant labelled items returned divided by all relevant labelled items in the supplied label set.
- **Stale/future result rate:** returned items marked outside the requested window or future-dated. The current query ranker filters these, so this should remain zero in regression fixtures.
- **Median publication age:** median age of returned items with a valid publication timestamp. This is not collection latency; capture time must be measured separately when available.

## Use
Run the automated test suite with `npm test`. Extend fixtures with analyst-labelled examples across languages, geographies and product domains. Record label provenance, reviewer, date, query, search window and expected relevance. Do not present fixture scores as production accuracy.

## Analyst-reviewed multilingual samples

Use `validateAnalystReviewSample` to validate a reviewed sample before it is added to a private evaluation set. Supported language codes are `en`, `bn`, and `hi`, plus `other` for explicitly out-of-scope languages. Each sample records the query, search window, domain, pseudonymous reviewer ID, review timestamp, and per-item relevant/not-relevant label. Keep reviewer identity and customer-sensitive query context out of shared fixtures. Do not infer language performance from the synthetic regression fixtures; only report per-language scores once a sufficiently representative, human-reviewed sample exists.

## Syndication / duplicate evaluation

`evaluateSyndicationQuality` compares proposed item pairs with analyst labels. It reports pair-level precision, recall, false-positive candidates and missed labelled pairs. A positive label means the same underlying report/story, not proof of copying, coordination, common ownership, or intent. Use canonical item identifiers consistently and retain reviewer provenance for every label.

## Next evaluation gates
1. Build a reviewed sample from real, consented product usage, preserving query context and publication/capture timestamps.
2. Track precision@5, recall, stale-result rate, publication-age distribution and freshness lag by language/domain.
3. Label syndicated and copied reports to estimate false independent-corroboration rates.
4. Track alert acknowledgement, dismissal and investigation outcomes without treating engagement as proof of correctness.
5. Set release thresholds only after a representative baseline exists.
