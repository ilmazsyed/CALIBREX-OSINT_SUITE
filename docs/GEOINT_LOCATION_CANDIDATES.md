# GEOINT location candidate ranking

The text gazetteer now exposes ranked place candidates instead of forcing downstream analysts to treat one keyword match as a resolved event location.

Each candidate includes its canonical place name, coordinates, matched alias, match type, lexical priority, position, rank and the number of competing candidates.

## Interpretation
- This is deterministic lexical matching against the built-in gazetteer.
- Ranking is a retrieval aid, not probabilistic geolocation or named-entity resolution.
- Multiple mentions are preserved so analysts can inspect competing places.
- The legacy `locate(text)` API remains available and returns only the highest-ranked candidate in its original compact shape.
- Coordinates represent gazetteer reference points, not the exact location of an event.

Use `locateCandidates(text, { limit })` when a workflow needs candidate provenance and ambiguity rather than a single convenience result.
