# Investigation location comparison summary

The Investigation Studio validation panel now shows:
- Pairwise coordinate conflicts, including distance and applied tolerance.
- Claimed place/country mismatches against saved provider-derived place context.
- Provider name where available.

A `REVIEW_REQUIRED` status means one or more provider-place discrepancies were found. `CONFLICTS_FOUND` means coordinate claims are farther apart than the comparison tolerance. These signals are not verdicts; the analyst must review source provenance, uncertainty radii, administrative boundaries and competing explanations.
