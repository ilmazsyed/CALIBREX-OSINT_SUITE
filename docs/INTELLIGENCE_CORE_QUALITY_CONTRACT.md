# Intelligence Core Quality Contract

## User outcome
The Intelligence Core must return information that is relevant to the user's question, current enough for the decision, traceable to its original source, explicit about uncertainty, and accompanied by a useful next action.

## Result quality dimensions
- **Relevance:** lexical overlap with the active query is a first-pass retrieval signal, not semantic understanding.
- **Freshness:** publication time is distinct from capture time. Missing publication time receives an explicit unknown/low-default freshness value; future timestamps are flagged for metadata verification.
- **Provenance:** show original URL, publisher domain, source type, publication time and capture time wherever available.
- **Evidence strength:** social observations and search snippets remain leads. Official-source origin is not a guarantee that every claim is correct. Distinct domains do not automatically mean independent reporting.
- **Actionability:** return a next action such as open and triage, corroborate, verify metadata, check for updates, or refine the query.

## Ranking semantics
The server/intelligence-quality.js module exposes assessObservationQuality and rankIntelligenceItems. Ranking uses relevance (55%) and freshness (45%) for queue ordering. The dimensions remain separately visible. Weighted priority is a triage order only; it is not confidence, credibility, probability of truth, or threat severity.

The first implementation uses bounded lexical matching and exponential freshness decay with a configurable half-life. It is transparent and testable, but not a semantic relevance model and must be evaluated against labelled user queries before automated decision gating.

## Operational safeguards
- Never replace publication time with collection time without labelling the substitution.
- Never label a social post, search snippet, pattern cluster, or single-source report as a verified fact.
- Preserve contradictory evidence and source links.
- Display uncertainty and missing metadata rather than hiding it.
- Do not infer source independence from publisher-domain count alone.
- Do not add new API keys or change existing AI provider or Claude publishing integrations.

## Next engineering gates
1. Wire quality assessment into feed/search result APIs and the Investigation Studio UI.
2. Add multilingual semantic retrieval and query expansion for Bengali, Hindi and English, with evaluation sets.
3. Add syndication/near-duplicate detection so reposts are not mistaken for independent corroboration.
4. Measure precision@5, freshness lag, source coverage and analyst usefulness on labelled tasks.
5. Add feedback capture (useful, not relevant, outdated, misleading) and use it to tune ranking under review.
6. Ensure alerts expose why they fired, what changed, evidence links, freshness and a recommended verification step.

## Current limitation
This change introduces tested ranking primitives and an explicit quality contract. It does not prove that all product surfaces use this ranking or that live source coverage is complete. Production impact requires API/UI integration, staging checks and measured evaluation.
