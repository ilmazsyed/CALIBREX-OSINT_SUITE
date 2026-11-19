// Attach ranked lexical GEOINT candidates to live intelligence items.
// Existing source-provided place assignments are preserved; candidates remain
// advisory and never overwrite an explicit source location.
export function applyPlaceCandidates(item, candidates = []) {
  if (!item || typeof item !== 'object') return item;
  const clean = Array.isArray(candidates)
    ? candidates.filter(c => c && typeof c.name === 'string' &&
      Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)))
      .slice(0, 8)
    : [];
  item.placeCandidates = clean;
  if (!item.place && clean.length) {
    const preferred = clean.find(c => c.priority >= 3) || clean[0];
    item.place = { name: preferred.name, lat: preferred.lat, lng: preferred.lng };
  }
  return item;
}
