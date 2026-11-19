# Investigation validation workbench

The Investigation Studio exposes an on-demand validation view for saved case evidence.

## API

`GET /api/investigations/:id/validation`

The endpoint uses the same personal/workspace case-scope authorization as other investigation reads and returns:

- Per-evidence explainable source reliability factors and caveats.
- Publisher-host grouping as a first-pass independence aid.
- Coordinate range/format validation and any stored place/country/time discrepancies.
- Potential conflicts between coordinate claims in the same case.
- Case revision and aggregate triage counts.

## Interpretation limits

- Source scores describe the available source record; they are not probabilities that a claim is true.
- Missing adjudicated history is treated neutrally.
- Different domains do not establish independent ownership or reporting.
- Coordinate validity and absence of conflicts do not prove an event location.
- Validation is read-only and on-demand; it does not rewrite evidence or silently change analyst assessments.

The UI should display caveats alongside scores and must not present the checks as automated verification.