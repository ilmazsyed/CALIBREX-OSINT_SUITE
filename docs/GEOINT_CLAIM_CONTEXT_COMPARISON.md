# GEOINT claim/context comparison

Investigation validation and report generation now compare analyst-entered claimed place/country fields with the saved reverse-geocoded context attached to the same evidence item.

Possible warnings:
- `COUNTRY_MISMATCH`: the claimed country differs from the provider-derived country.
- `PLACE_NAME_MISMATCH`: the claimed place differs from the provider-derived place label.

The validation response retains the provider name, lookup timestamp, analyst identity, place/country and caveat so the analyst can inspect where the comparison came from.

These are discrepancy flags, not determinations that the claim is false or that the provider result is correct. Administrative labels may differ because of boundary, transliteration, locality hierarchy or provider coverage. Analysts should inspect the original coordinate, source metadata and provider attribution before drawing a conclusion.
