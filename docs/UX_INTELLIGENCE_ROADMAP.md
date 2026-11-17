# Calibrex OSINT Studio — UX and Intelligence Upgrade

## Product objective

Make the application a practical intelligence workbench: one clear route from collection to triage, source review, corroboration, investigation, case capture, reporting and alerting. Preserve the depth of the existing toolset while reducing the number of decisions a new operator must make.

## UX changes in this rollout branch

- Sidebar navigation now includes a screen/tool search so operators can jump directly to a capability without scanning every section.
- 2D maps include a one-tap India framing control with a national extent intended to retain Jammu & Kashmir, Ladakh, the north-east and southern/island extent.
- The 3D globe includes an India focus action.
- Atlas Global Situation now surfaces a priority attention queue, critical/high triage counts, signal-convergence count and collection-volume context before the map layers.
- In-app Guide and Getting Started documentation now explain map controls, source health, convergence, source independence, evidence capture and a repeatable analyst workflow.

## Design principles informed by product research

1. **Make map actions explicit.** ArcGIS Dashboards exposes default extents/bookmarks, layer visibility, legends and basemap controls, and supports actions from map selections and extent changes. Calibrex should progressively add saved map views, linked filters and selection-to-case actions rather than only plotting markers.
2. **Keep complex graphs controllable.** Maltego's interface provides quick find, filters, graph/map/table views, bookmarks, layout controls and incremental layout. Calibrex should bring equivalent analyst control to its graph and entity workbench, with progressive disclosure instead of hiding functionality.
3. **Show provenance and uncertainty.** Intelligence products should describe source quality, methodology, currency and uncertainty, and separate source information from analyst judgement. Priority scores and convergence must remain triage aids, never automatic attribution or proof.
4. **Design for action, not dashboard decoration.** Each important signal should offer inspect source, compare corroboration, add to case, investigate related entities, create watch/alert and draft a brief—where the underlying capability exists.
5. **Keep maps readable.** Default to a small number of useful layers; make layer counts, freshness, legends, bookmarks and map extent obvious. Avoid implying that duplicate records are separate incidents.

## India map boundary — release requirement

The India quick-view extent is set to include the northern extent, Jammu & Kashmir and Ladakh. However, the current bundled world basemap geometry is not an authenticated Survey of India political boundary dataset. **Do not represent the extent adjustment as a verified correction to the India boundary geometry.**

Survey of India publishes an official vector outline and political map. Its public-awareness notice states that the outline map is available for individual, internal, educational and research website purposes, and that commercial usage is not permitted for that SoI copyright product. Before replacing the current boundary geometry in this commercial product, obtain written commercial permission/licensing from Survey of India or a separately cleared source with appropriate legal review. The map should then be validated at country and regional scale, including the full northern boundary, Ladakh, Jammu & Kashmir, north-east and island territories.

Reference: https://surveyofindia.gov.in/pages/public-awareness

## Next high-value product work

### P0 — before broad enterprise rollout
- Replace/approve the India boundary dataset under a commercial licence; verify all map components use the same source and framing.
- Test on iOS Safari, Android Chrome, desktop and narrow tablet widths.
- Add visible freshness/source-health context on every intelligence surface.
- Validate Atlas attention queue ranking and layer selection with real analyst scenarios; include empty, stale and partial-source states.
- Ensure all key marker actions work with keyboard and touch, and that mobile detail cards never cover map controls.
- Complete the separate corporate tenant-isolation and PostgreSQL workspace release gates.

### P1 — analyst efficiency
- [x] Saved map views/bookmarks: current map centre and zoom can be saved locally per browser profile.
- [ ] Curated shared bookmarks for India, South Asia, border regions, maritime chokepoints and corporate workspaces.
- [ ] Linked selection: map marker filters related feeds; feed selection pans the map to the marker.
- [x] Time-window presets (6h, 24h, 3d, 7d, all available); undated records remain visible and are not misrepresented as fresh.
- [ ] Full timeline scrubber with explicit timezone labels and event playback.
- Case-first actions from maps, chatter, research, graphs and alerts.
- Source comparison view: original article, publication time, source type, independent-source grouping, cached/live status.
- [x] Graph quick find, layout choices, layout lock and fit-to-view controls.
- [ ] Entity filters, edge-label controls, incremental layout preservation and graph table view.
- Alert builder based on entity, region, layer, severity, source health and time window, with preview before saving.

### P2 — intelligence depth
- Structured event records with separate fields for observation, source claim, analyst inference, confidence rationale and unknowns.
- Alternative-hypothesis and contradiction panels for important assessments.
- Entity resolution review queue; no automatic identity merge based only on fuzzy matches.
- Change detection for monitored entities, facilities, routes and topics.
- Analyst feedback on false positives and source utility, feeding transparent rule tuning rather than opaque scores.
- Exportable source register and reproducible assessment timeline.

## Current implementation notes

The current Atlas time filter is a client-side view over the latest collected snapshot; it does not request historical backfill or create an event-time archive. Saved map views are browser-local preferences, not shared tenant bookmarks. The graph quick-find dims non-matching nodes; it does not remove graph elements. These controls must not be described as cross-device collaboration or historical replay.

## Release discipline

This branch is a UX/intelligence upgrade candidate, not a production deployment. Require CI, accessibility/mobile checks, analyst acceptance and the outstanding security gates before rollout. Preserve existing AI provider integrations and do not add mandatory API credentials as part of this redesign.
