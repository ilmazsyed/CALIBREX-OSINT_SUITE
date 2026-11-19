# Uncertainty-aware geospatial corroboration

Investigation analysis can compare multiple coordinate observations using their reported horizontal accuracy radii.

## Pair assessments
- `CONSISTENT_WITHIN_TOLERANCE`: the maximum separation implied by the two reported radii is within the configured tolerance.
- `SPATIAL_CONFLICT`: even the minimum possible separation exceeds the configured tolerance.
- `INDETERMINATE`: one or both accuracy radii are missing or unusable, so the system does not infer agreement or conflict from distance alone.

The default consistency tolerance is 1,000 metres and can be overridden by a caller. The output includes centre-to-centre distance, reported radii, minimum/maximum possible separation, and an explanation.

## Safeguards
Accuracy values are source-reported bounds, not verified statistical confidence intervals. Unknown accuracy is not converted to zero. A spatial conflict is a review flag, not a determination that either source is false. A consistent result does not establish the event location, source independence, or authenticity of metadata.
