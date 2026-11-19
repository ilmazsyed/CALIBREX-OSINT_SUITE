# Cross-source entity and evidence correlation

The investigation graph now adds two separate classes of machine-suggested review edges.

## Entity identity candidates
- Compare same-type entity names and aliases after Unicode normalisation.
- Use exact alias matching and conservative edit/token similarity.
- Candidate threshold is 0.86.
- Suggestions retain both entity IDs, names, type, similarity and match signal.
- Records are never automatically merged or promoted to confirmed identity.

## Evidence correlation candidates
- Signals include canonical shared URLs, high title similarity, timestamps within 24 hours and coordinates within 10 km.
- Exact canonical URL matches are surfaced as shared-source candidates.
- Other candidates require multiple signals; title similarity alone requires a high threshold.
- The result records signal list, temporal delta, spatial distance, source hosts and a cautious source-independence assessment.

## Safeguards
- Candidate edges are labelled MACHINE_SUGGESTED, require analyst review and never count as independent corroboration.
- Different hostnames do not prove independent ownership or reporting.
- Similar names do not prove identity; similar titles, timing and proximity do not prove a shared event.
- No entity is merged and no evidence assessment is changed by this process.
