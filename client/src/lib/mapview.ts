import L from './leaflet';

/**
 * Consistent India framing for every 2D Atlas map.
 * Bounds include the full northern extent (Jammu & Kashmir and Ladakh),
 * the north-east, and the southern/island extent. The underlying boundary
 * geometry remains the app's embedded map dataset; this helper only frames it.
 */
export const INDIA_VIEW_BOUNDS: L.LatLngBoundsExpression = [
  [5.5, 67.0],
  [38.0, 98.5],
];

export function fitIndia(map: L.Map, animate = true) {
  map.fitBounds(INDIA_VIEW_BOUNDS, {
    padding: [18, 18],
    maxZoom: 4.5,
    animate,
    duration: 0.7,
  });
}
