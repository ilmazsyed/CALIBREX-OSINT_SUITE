import { normalizeGeospatialEvidence } from './geospatial-evidence.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const safeDate = value => value == null ? null : String(value).slice(0,80);

export function buildInvestigationGeoJson(investigation = {}, generatedAt = new Date().toISOString()) {
  const evidence = Array.isArray(investigation.evidence) ? investigation.evidence.slice(0,300) : [];
  const features = [];
  for (const item of evidence) {
    const normalized = normalizeGeospatialEvidence(item);
    if (!normalized.coordinates) continue;
    const { lat, lon } = normalized.coordinates;
    features.push({
      type: 'Feature',
      id: String(item.id || features.length + 1),
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        evidenceId: String(item.id || ''),
        title: String(item.title || 'Untitled evidence').slice(0,300),
        assessment: String(item.assessment || 'UNKNOWN'),
        triage: String(item.triage || 'NEW'),
        source: String(item.source || '').slice(0,120),
        sourceUrl: String(item.url || '').slice(0,1000),
        published: item.published ?? null,
        capturedAt: item.capturedAt ?? null,
        observedAt: normalized.observedAt,
        observedAtTimezone: normalized.observedAtTimezone,
        accuracyMeters: normalized.accuracyMeters,
        locationMethod: String(item.locationMethod || (item.exif ? 'EXIF_GPS' : '')).slice(0,100),
        metadataOrigin: normalized.metadata.origin,
        metadataSource: normalized.metadata.sourceReference,
        imageSha256: item.imageSha256 || null,
        videoSha256: item.videoSha256 || null,
        recordSha256: item.recordSha256 || null,
        providerPlaceContext: item.geospatialContext ? {
          provider: item.geospatialContext.provider || null,
          place: item.geospatialContext.place || null,
          recordedAt: item.geospatialContext.recordedAt || null
        } : null,
        coordinateCaveat: 'Evidence coordinate; not independently verified as the event location.'
      }
    });
  }
  return {
    type: 'FeatureCollection',
    name: String(investigation.title || 'Calibrex investigation').slice(0,160),
    description: 'Calibrex OSINT Studio investigation geospatial evidence export.',
    metadata: {
      investigationId: String(investigation.id || ''),
      caseRevision: Number(investigation.revision) || 1,
      generatedAt,
      featureCount: features.length,
      coordinateOrder: 'longitude, latitude',
      caveat: 'Features represent recorded evidence coordinates, not confirmed event locations. Reported accuracy values are source-provided and not independently verified.'
    },
    features
  };
}

export function buildInvestigationKml(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const placemarks = features.map(feature => {
    const p = feature.properties || {};
    const [lon,lat] = feature.geometry?.coordinates || [];
    const description = [
      'Assessment: ' + (p.assessment || 'UNKNOWN'),
      'Triage: ' + (p.triage || 'NEW'),
      'Source: ' + (p.source || 'Unspecified'),
      'Source URL: ' + (p.sourceUrl || 'Not recorded'),
      'Location method: ' + (p.locationMethod || 'Not recorded'),
      'Accuracy radius (m): ' + (p.accuracyMeters ?? 'Unknown'),
      'Observed at: ' + (p.observedAt || 'Not recorded') + ' (' + (p.observedAtTimezone || 'timezone unknown') + ')',
      'Caveat: Evidence coordinate; not independently verified as the event location.'
    ].join('\n');
    const data = Object.entries({
      evidenceId:p.evidenceId, assessment:p.assessment, triage:p.triage,
      source:p.source, sourceUrl:p.sourceUrl, accuracyMeters:p.accuracyMeters,
      locationMethod:p.locationMethod, metadataOrigin:p.metadataOrigin,
      metadataSource:p.metadataSource, recordSha256:p.recordSha256
    }).filter(([,v])=>v!=null&&v!=='').map(([name,value])=>`<Data name="${esc(name)}"><value>${esc(value)}</value></Data>`).join('');
    return `<Placemark><name>${esc(p.title || p.evidenceId || 'Evidence')}</name><description>${esc(description)}</description><ExtendedData>${data}</ExtendedData><Point><altitudeMode>clampToGround</altitudeMode><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(geojson?.name || 'Calibrex investigation')}</name><description>${esc(geojson?.metadata?.caveat || 'Evidence coordinates; not confirmed event locations.')}</description>${placemarks}</Document></kml>`;
}
