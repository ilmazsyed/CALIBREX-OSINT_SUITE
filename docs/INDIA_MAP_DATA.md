# India map geometry and attribution

The 2D Threat Map and Atlas Global Situation map overlay `client/src/lib/india-states.geojson` above the coarse world basemap so the full India state/union-territory geometry remains visible at India-wide zoom levels, including the northern extent and north-east.

## Data source

- Dataset: `india-states-simplified.geojson`
- Source repository: https://github.com/AbhinavSwami28/india-official-geojson
- Source repository declares the project MIT-licensed.
- The dataset is a community-published cartographic dataset, not a certified Survey of India GIS product. Verify against current official mapping guidance before legal, regulatory, or publication use.

The map framing helper controls viewport only; it does not alter the geometry. The dedicated GeoJSON overlay supplies the India state/UT shapes.
