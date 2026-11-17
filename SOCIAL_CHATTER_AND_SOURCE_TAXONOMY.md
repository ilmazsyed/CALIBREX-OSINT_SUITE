# Calibrex OSINT source expansion and social chatter

## Source taxonomy

Every source and resulting intelligence item carries one primary category:

- `STRATEGIC`: defence posture, military procurement, exercises, force deployments and strategic infrastructure.
- `LOGISTICS_SUPPLY_CHAIN`: shipping, ports, freight, chokepoints, trade corridors and supply-chain disruptions.
- `MARKETS`: equities, rates, currencies, commodities, sanctions/financial restrictions and corporate markets.
- `GEOPOLITICS`: diplomacy, state relations, international institutions and geopolitical developments.
- Existing operational categories remain available: `SECURITY`, `CYBER`, `POLITICS`, `GOVERNANCE`, `CRISIS`, `OTHER`.

The Admin Sources catalogue exposes the category. Items display it in the intelligence feed. Category metadata is propagated through direct feeds and GDELT keyword searches.

## Added primary / official sources

- Reserve Bank of India press releases and notifications (RBI's published RSS endpoints).
- SEBI releases, circulars and orders (SEBI's published RSS endpoint).
- PIB Defence and Commerce & Industry releases (PIB's regional RSS feeds).
- WTO news RSS.
- IMO press briefing search, restricted to the official IMO domain.
- UNCTAD maritime trade search, restricted to the official UNCTAD domain.
- UN Security Council sanctions search, restricted to the official UN domain.

These are official-source origins, but the runtime still checks endpoint health. A publisher's official source does not imply every downstream claim is independently verified.

## X / Twitter public chatter

The X streams use the official X API v2 Recent Search endpoint only. They do not scrape X webpages, use cookies, or bypass platform controls.

### Required deployment configuration

Set `X_BEARER_TOKEN` as a server-side secret in the Render service environment. Never put the token in the client, repository, or chat. The token must have access to X API Recent Search. X documents Recent Search as a rolling seven-day window; full archive requires a different access tier. API access and usage are subject to X's current developer plan, quotas and terms.

Built-in query streams cover:
- Strategic / defence
- Logistics / shipping / supply chain
- Markets / commodities
- Geopolitics
- Hindi public chatter
- Bengali public chatter

Recent Search is polled on a five-minute per-source cadence (even though the direct-feed loop runs more frequently). A missing token appears as a source-health configuration error and does not affect the other feeds.

### Pattern detection

A chatter pattern is raised only when at least three distinct X author IDs publish near-duplicate text within a 30-minute window. Exact duplicate text from different authors is preserved rather than collapsed.

The UI label says **CHATTER PATTERN**, not coordinated campaign, bot network or disinformation. It is a review lead only. It does not infer account identity, intent, automation, common control, or truth. Built-in queries exclude retweets but include public replies, and it does not establish causation or coordination.

A human analyst must inspect original posts, timestamps, account histories, links, media provenance and independent reporting before making any stronger assessment.

## Known limitations / next phase

- X access must be configured and tested with a real project token in staging; no token is stored in source code.
- The current pattern matcher detects near-duplicate text only. It does not yet identify semantic paraphrase, synchronized URL sharing, hashtag co-occurrence, temporal bursts, cross-platform propagation or network communities.
- Do not ingest private accounts, DMs, protected posts or personal data outside the public API's permitted fields.
- Rate limits and API errors are surfaced through the source health circuit breaker; do not evade them.
- Official source URLs are monitored and must be reconciled against the live source-health inventory after deployment.
