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


## Collection freshness and alert usefulness

The authenticated `/api/intelligence/collection-freshness` endpoint reports publication age separately from collection delay. It uses an item-level `collectedAt` timestamp when present; otherwise it labels the feed snapshot time as a proxy. Future or missing publication timestamps are unverified rather than fresh. Source collection health remains operational telemetry, not editorial credibility or completeness.

Investigation monitoring alerts accept analyst usefulness feedback: `USEFUL`, `NOT_USEFUL`, `DUPLICATE`, and `NO_ACTION`, in addition to the existing lifecycle states. Feedback summaries are available from the case `monitor-alert-feedback` endpoint. These signals help prioritise product tuning; they are not truth labels and should not be interpreted as incident verification.

## Social repost and near-duplicate review

The authenticated `/api/chatter/duplicate-candidates` endpoint compares recent social items using Unicode-aware token overlap, allowing English, Bengali and Hindi text to be assessed without an English-only tokenizer. It distinguishes same-account repeats from cross-account near-duplicate text, includes source links and time separation, and always marks the pair as requiring review with `independentCorroboration:false`. Similarity is a retrieval cue only: it cannot establish copying, coordination, account control, common intent, or independent reporting. Thresholds should be evaluated against analyst-labelled pairs before operational use.
