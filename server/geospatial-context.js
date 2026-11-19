const str = (v, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function sanitiseGeospatialContext(result, actor, at = Date.now()) {
  if (!result || typeof result !== 'object' || !result.coordinates) throw new Error('A reverse-geocoding result is required.');
  const lat = Number(result.coordinates.lat), lon = Number(result.coordinates.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Reverse-geocoding coordinates are invalid.');
  const p = result.place && typeof result.place === 'object' ? result.place : {};
  const f = result.feature && typeof result.feature === 'object' ? result.feature : {};
  return {
    coordinates: { lat, lon },
    displayName: str(result.displayName),
    place: {
      name: str(p.name, 150), suburb: str(p.suburb, 150), district: str(p.district, 150),
      state: str(p.state, 150), country: str(p.country, 150),
      countryCode: str(p.countryCode, 8).toUpperCase(), postcode: str(p.postcode, 24)
    },
    feature: {
      category: str(f.category, 80), type: str(f.type, 80),
      osmType: str(f.osmType, 20), osmId: typeof f.osmId === 'number' || typeof f.osmId === 'string' ? String(f.osmId).slice(0, 40) : null
    },
    provider: 'OpenStreetMap Nominatim',
    sourceUrl: 'https://nominatim.openstreetmap.org/reverse',
    attribution: '© OpenStreetMap contributors',
    licence: str(result.licence, 300),
    caveat: 'Reverse-geocoded context is a provider interpretation of coordinates, not independent proof of an event location.',
    recordedAt: new Date(at).toISOString(),
    recordedBy: str(actor, 128)
  };
}

export function attachGeospatialContext(evidence = [], evidenceId, context) {
  if (!Array.isArray(evidence)) throw new Error('Investigation evidence must be an array.');
  let found = false;
  const updated = evidence.map(item => {
    if (item.id !== evidenceId) return item;
    found = true;
    return { ...item, geospatialContext: context };
  });
  if (!found) throw new Error('Evidence item not found.');
  return updated;
}
