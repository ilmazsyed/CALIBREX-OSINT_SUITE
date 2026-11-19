# Investigation PDF annexures and language support

Approved server-rendered investigation PDFs now append:
- Annexure A: a bounded structured evidence register with evidence IDs, assessment, triage, source URL, timestamps, coordinates, reported accuracy, hash scope, content/record hashes, image/video hashes and metadata provenance.
- Annexure B: a schematic equirectangular plot of up to 100 recorded evidence coordinates, labelled by evidence number and assessment.

The coordinate plot is deliberately labelled as schematic and has no basemap. It is a visual index, not a survey map or location verification. The evidence register remains the authoritative detail for source references and reported accuracy.

The server PDF renderer currently uses standard Helvetica fonts and may substitute glyphs outside its supported character set. For Bengali, Hindi and other non-Latin scripts, use the browser Print / Save PDF action, which relies on browser font shaping. This limitation is disclosed in the report UI; the server PDF is not advertised as full Unicode.
