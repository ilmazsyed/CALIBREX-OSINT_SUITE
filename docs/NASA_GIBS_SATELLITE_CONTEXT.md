# NASA GIBS satellite imagery context

The investigation evidence map can optionally load NASA EOSDIS Global Imagery Browse Services (GIBS) true-colour imagery.

Supported layers:
- VIIRS Suomi-NPP corrected reflectance true colour.
- VIIRS NOAA-20 corrected reflectance true colour.
- MODIS Terra corrected reflectance true colour.
- MODIS Aqua corrected reflectance true colour.

Analysts can choose an imagery date and overlay opacity. The layer is off by default, so the evidence map remains usable without external imagery. Tile loading errors are surfaced in the panel.

## Interpretation
GIBS browse imagery is contextual, not survey-grade imagery. Cloud cover, acquisition time, sensor resolution, swath, revisit cadence and tile availability affect what can be seen. A visual feature on a browse layer is not proof of an event or exact location. Record the layer, date and independent imagery/source references in the investigation before relying on a visual interpretation.

Attribution: NASA EOSDIS Global Imagery Browse Services (GIBS). The imagery service is external to Calibrex and subject to its availability and terms.
