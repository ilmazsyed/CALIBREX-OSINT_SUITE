# Live intelligence location candidates

When Calibrex enriches a high-priority live news item by reading its source article, it now extracts up to eight ranked gazetteer place candidates from the first 2,400 characters of the article lead.

The live intelligence item can retain:
- Its existing source-provided place, when present.
- The legacy best lexical match when no source place exists.
- A `placeCandidates` array with ranked alternatives, matched aliases and match metadata.

## Safeguards
- Explicit source-provided locations are never overwritten by lexical candidates.
- Candidate coordinates are gazetteer reference points, not event coordinates.
- Lexical candidate ranking is not named-entity resolution or event geolocation.
- Consumers should present alternatives as analyst-review context and should not silently treat all candidates as event locations.

This is additive to the live intelligence item schema and preserves the existing `place` field for older clients.
