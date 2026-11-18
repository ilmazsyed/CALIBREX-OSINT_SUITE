# Query relevance and recency audit — Release 5

## Purpose
Make user-initiated searches query-relevant, make publication recency explicit, and avoid applying a news ranking rule to structured datasets whose ordering has a different meaning. Relevance is not truth, source reliability, attribution, or corroboration. A 100% relevance guarantee is not technically defensible; acceptance must use labelled benchmark sets and report precision/recall.

## Current result-producing surface inventory

| Surface | Data / endpoint | Query semantics | Ordering / date semantics | Release 5 treatment |
|---|---|---|---|---|
| Research / global news | GET /api/search → searchNews → server/feeds.js | Free-text news query | Publication date; requested 1d/3d/7d/30d window | Shared relevance gate + recency-first rank already integrated in shared search path |
| Corroboration / Verify | POST /api/verify | Claim search + article-body corroboration | 3-day search; evidence domains and article text | Uses news search; preserves headline-only vs article-backed evidence; requires separate contradiction and source-independence validation |
| Intelligence Library | GET /api/library → server/library.js | Query plus wire/severity/source/date filters | Publication date; undated retained only when no explicit date bound | Release 5: whole-token relevance gate, recency-first order, match terms/band and DATE_UNVERIFIED metadata |
| SOCMINT Reddit | GET /api/socmint/reddit → server/socmint.js | Public Reddit query | Reddit newest-first | Release 5: query relevance gate over title/body, newest-first order, relevance metadata; public Reddit coverage is not comprehensive |
| SOCMINT username presence | GET /api/socmint/username | Exact username/profile probe | Not a ranked search | Intentionally excluded from generic relevance ranking; yes/no/unknown semantics remain |
| Maritime incidents | GET /api/maritime | Feed-derived maritime keyword classifier | Published time from feed | Not a user free-text query; still needs a dedicated maritime incident precision benchmark and freshness diagnostics |
| Maritime sanctioned fleet | sanctions vessel registry; searchVessels helper | Entity/name/IMO/flag/owner matching | Identity match score, not publication recency | Must use entity-resolution semantics; do not apply news ranking |
| Sanctions screening | GET /api/sanctions/screen | Fuzzy identity screening against loaded OFAC entries | Match score and official list version/update time | Domain-specific fuzzy matching retained; no recency sort. Add list coverage/date visibility and transliteration/alias benchmark |
| Markets / series | GET /api/markets, GET /api/markets/series/:id | Instrument and country selection | Market observation time, instrument chronology | Structured time-series; sort chronologically and show quote timestamp/staleness, not query relevance |
| Geospatial / conflict / world map | GET /api/geoint, /api/conflict, /api/worldmap | Geographic/category filters | Event occurrence/observation time | Structured event layer; preserve geography and event-time semantics; query relevance is not applicable unless a text-search control is added |
| Chatter / patterns | GET /api/chatter, GET /api/intelligence/patterns | Pattern detection, not keyword search | Event window and author timestamps | Similarity/coordination candidates remain leads; require query-specific investigation filtering and false-positive benchmark |
| Specialist collection | POST /api/specialist-operations/:role/collect | Role-specific focused search | Publication time first; collection time separate | Existing role-specific relevance and recency logic; needs five-role labelled acceptance sets |
| Specialist workspace assessment | POST /api/specialist-operations/:role/assess | Evidence synthesis against analyst subject | Evidence publication and capture times | Must retain source provenance, evidence status, contradictions and unassessed gaps; assessment quality not established by query score |
| Pivot / entity registry / investigation | GET /api/pivot; /api/entity-registry; /api/investigations | Identifier resolution, graph and case queries | Entity match/relationship semantics; case audit chronology | Not generic news search; require exact-ID precedence, ambiguity candidates and no auto-merge |

## Release 5 code changes
- server/library.js: removed substring-only matching. Search now applies shared whole-token relevance scoring after structured filters, sorts relevant items by publication time, and returns match quality, matched/missing terms and explicit date status.
- server/socmint.js: Reddit search now fetches a bounded 50 newest public posts, scores title and self-text against the query, excludes unrelated incidental matches, and retains newest-first ordering. It remains public Reddit coverage only, not all social networks.
- Regression tests added for incidental PLA/plane matches, title/body matching, newest-first ordering and undated Library evidence.

## Remaining acceptance work
1. Run CI on the new head and inspect every job.
2. Build labelled benchmark fixtures for all modules and domains; calculate precision/recall rather than asserting 100%.
3. Add date-field/staleness tests for each structured provider: markets, sanctions lists, maritime, geospatial, aircraft/AIS and macro/trade.
4. Test full-text article capture and DNS behavior on live staging, including failures and retry/diagnostic visibility.
5. Test tenant isolation for saved searches, specialist workspaces, alerts, investigations and evidence.
6. Perform end-to-end staging acceptance across Defence, Corporate Risk, Supply Chain, Geopolitical and Strategic roles.
7. Keep Atlas, provider credentials, production branch and production deployment unchanged.

## Acceptance rules
- Relevance gate first; publication recency orders the relevant news evidence.
- Do not confuse publication time, event time, collection time, update time or market quote time.
- Missing dates are labelled unverified; they are not silently treated as current.
- Future-dated records are excluded from user-facing news windows unless explicitly handled as scheduled events.
- Structured datasets retain their domain-specific matching and chronological semantics.
- Social posts are unverified leads; search relevance does not establish truth or coordination.
- No new API keys or X bearer token.