# Persisted GEOINT evidence context

An analyst can explicitly attach a reverse-geocoded place context to an existing coordinate-bearing evidence item.

The server:
- Resolves the stored evidence coordinates itself; it does not trust a client-supplied place name.
- Stores the provider, returned administrative place hierarchy, feature metadata, licence, attribution, lookup timestamp and analyst identity.
- Updates the investigation revision and evidence ledger.
- Includes the saved place context in subsequent investigation validation responses and generated reports.
- Preserves the saved context through normal investigation validation and includes it in the evidence record hash.

This is a contextual annotation, not a change to the original evidence coordinates or source claim. The report retains a caveat that reverse-geocoding is not independent verification of event location.
