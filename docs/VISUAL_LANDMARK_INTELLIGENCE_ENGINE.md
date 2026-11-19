# Calibrex visual landmark intelligence engine

## Analyst workflow
1. Open an image evidence item in Investigation Studio.
2. Upload the source image (JPEG, PNG or WebP; maximum 12 MB) to the AI visual intelligence workbench.
3. The configured account-level multimodal AI provider analyses the image for scene type, visible geometry/features, legible text, and specific named landmark leads.
4. Named leads are searched against OpenStreetMap Nominatim. Returned places include provider identifiers, coordinates, display names and OpenStreetMap attribution.
5. An analyst selects a place candidate, checks its map position against the actual image and independent reference imagery, records the image capture date, uncertainty radius, provider/sensor/acquisition date/resolution and written visual rationale.
6. Save the evidence and investigation. The AI analysis, candidate result, selected place and analyst-entered visual review are included in the investigation record and report.

## What the engine does
- Uses the user's configured vision provider (Anthropic Claude, OpenAI, OpenRouter or Gemini where the selected model supports image input).
- Requests bounded structured JSON; rejects malformed model output instead of inventing missing data.
- Separates observed scene features and text from hypotheses and named place candidates.
- Limits model candidates and geocoder results; caches Nominatim lookups and serialises requests to respect its public service rate limit.
- Does not accept model-generated coordinates. Coordinates shown in place results are returned by the attributed gazetteer.
- Records provider/model and generation time for the AI analysis.

## Limitations and safe interpretation
- AI scene interpretation can be wrong. OCR-like text extraction can be partial or hallucinated; compare every transcription to the original image.
- Nominatim is a name-based gazetteer, not a visual similarity service. A place result is a search lead, not a matched landmark.
- This release does not claim image embeddings, reverse-image search, automated satellite scene matching, camera pose estimation, or computer-vision geolocation.
- Two reference URLs on different domains do not prove independent ownership or data acquisition.
- Analyst-recorded uncertainty is not a statistical confidence interval. A completed review checklist is not proof of the image's location.
- Image bytes are sent to the AI provider configured by the user. Provider retention, region and processing terms apply. Calibrex does not persist the uploaded image in this endpoint.
- Use original high-resolution imagery where possible. Preserve source URL, acquisition/capture context and a cryptographic hash in the evidence record.

## Acceptance
Automated tests cover structured output parsing, output bounds, candidate geocoder coordinate validation and provider failure handling. Operational acceptance requires test images with independently known locations, multiple vision providers, ambiguous scenes, no-landmark scenes, misleading visible text, and real provider rate limits.
