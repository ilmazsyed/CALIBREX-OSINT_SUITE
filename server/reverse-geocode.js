const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
const USER_AGENT = 'CalibrexOSINTStudio/1.0 (https://calibrex.org)';

export function normaliseReverseGeocodeResult(payload, coordinates) {
  if (!payload || typeof payload !== 'object' || payload.error) return null;
  const address = payload.address && typeof payload.address === 'object' ? payload.address : {};
  const pick = (...keys) => keys.map(k => address[k]).find(v => typeof v === 'string' && v.trim()) || null;
  const result = {
    coordinates: { lat: coordinates.lat, lon: coordinates.lon },
    displayName: typeof payload.display_name === 'string' ? payload.display_name : null,
    place: {
      name: pick('city', 'town', 'village', 'municipality', 'hamlet', 'county', 'state_district'),
      suburb: pick('suburb', 'neighbourhood', 'quarter', 'city_district'),
      district: pick('state_district', 'county', 'district'),
      state: pick('state', 'region', 'province'),
      country: pick('country'),
      countryCode: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : null,
      postcode: pick('postcode')
    },
    feature: {
      category: typeof payload.category === 'string' ? payload.category : null,
      type: typeof payload.type === 'string' ? payload.type : null,
      osmType: typeof payload.osm_type === 'string' ? payload.osm_type : null,
      osmId: payload.osm_id ?? null
    },
    provider: 'OpenStreetMap Nominatim',
    sourceUrl: typeof payload.licence === 'string' ? NOMINATIM : NOMINATIM,
    attribution: '© OpenStreetMap contributors',
    licence: typeof payload.licence === 'string' ? payload.licence : 'OpenStreetMap data; see provider terms',
    caveat: 'Reverse-geocoded context is a provider interpretation of coordinates, not independent proof of an event location.'
  };
  return result;
}

export function createReverseGeocoder({ fetchImpl = fetch, now = () => Date.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), minIntervalMs = MIN_INTERVAL_MS } = {}) {
  const cache = new Map();
  let lastRequestAt = 0;
  let queue = Promise.resolve();

  async function lookup(latValue, lonValue) {
    const lat = Number(latValue), lon = Number(lonValue);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      const error = new Error('Valid latitude and longitude are required.');
      error.status = 400;
      throw error;
    }
    const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    const cached = cache.get(key);
    if (cached && now() - cached.savedAt < CACHE_TTL_MS) return { ...cached.result, cached: true };
    const run = async () => {
      const waitMs = Math.max(0, minIntervalMs - (now() - lastRequestAt));
      if (waitMs) await sleep(waitMs);
      const url = new URL(NOMINATIM);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetchImpl(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
        if (!response.ok) {
          const error = new Error(`Reverse geocoder returned HTTP ${response.status}.`);
          error.status = response.status === 429 ? 503 : 502;
          throw error;
        }
        const payload = await response.json();
        const result = normaliseReverseGeocodeResult(payload, { lat, lon });
        if (!result) {
          const error = new Error('The geocoder returned no usable place result.');
          error.status = 404;
          throw error;
        }
        lastRequestAt = now();
        cache.set(key, { savedAt: now(), result });
        if (cache.size > 5000) {
          for (const [cacheKey, entry] of cache) if (now() - entry.savedAt >= CACHE_TTL_MS) cache.delete(cacheKey);
          while (cache.size > 5000) cache.delete(cache.keys().next().value);
        }
        return { ...result, cached: false };
      } finally {
        clearTimeout(timeout);
      }
    };
    const pending = queue.then(run, run);
    queue = pending.then(() => undefined, () => undefined);
    return pending;
  }
  return { lookup, clearCache: () => cache.clear() };
}

export const reverseGeocoder = createReverseGeocoder();
