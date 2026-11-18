import L from './leaflet';

/**
 * Consistent India framing for every 2D Atlas map.
 * Bounds are checked against the user-supplied Political Map of India
 * (January 2026) as a visual/cartographic reference. They include the full
 * northern extent (Jammu & Kashmir and Ladakh), the north-east, and the
 * southern/island extent.
 *
 * The map components overlay a dedicated state/UT GeoJSON on the coarse world
 * basemap. The geometry is an openly published community dataset, not a
 * certified Survey of India product; retain its source attribution in product docs.
 */
export const INDIA_VIEW_BOUNDS: L.LatLngBoundsExpression = [
  [5.5, 67.0],
  [38.0, 98.5],
];

export function fitIndia(map: L.Map, animate = true) {
  map.fitBounds(INDIA_VIEW_BOUNDS, {
    padding: [10, 10],
    maxZoom: 4,
    animate,
    duration: 0.7,
  });
}
