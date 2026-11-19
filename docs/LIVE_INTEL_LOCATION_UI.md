# Live intelligence location leads UI

The Live Intelligence Wires panel now displays up to four ranked place candidates supplied by article enrichment.

The label is deliberately **Location leads**. The candidates are lexical gazetteer matches and must not be read as confirmed event locations. The UI exposes the caveat on hover and retains the existing single `place` field for map and visual-intelligence compatibility.

No map marker is created for every candidate: that would imply event-location certainty the source does not provide. Analysts can use the list as a prompt to inspect the article and choose the correct location during investigation.
