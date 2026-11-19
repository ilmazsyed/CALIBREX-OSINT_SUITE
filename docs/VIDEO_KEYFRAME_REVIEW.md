# Video keyframe review

Investigation evidence supports analyst-controlled keyframe capture in the browser.

## Workflow
- Open the source MP4/MOV/WebM URL when browser CORS permits, or select a local copy (up to 250 MB).
- Pause at a relevant moment and save the current frame.
- Calibrex creates a compressed JPEG preview (maximum 480 px wide), a SHA-256 hash, a video timestamp/timecode and an extraction timestamp.
- Analysts can add a visual note and an optional candidate place/coordinate.
- Up to six keyframes per evidence item are retained; each preview is capped at 80 KB.

## Visual geolocation safeguards
A candidate place or coordinate entered from visual inspection is stored with status `UNVERIFIED`. It does not overwrite the parent evidence coordinate, does not appear as a confirmed location on the case map and is not treated as corroboration. Analysts must create or attach a separately sourced evidence observation before promoting a visual location assessment.

## Storage and limitations
The browser captures frames locally; the original video is not uploaded again by this feature. Only compressed previews and metadata are saved to the case. Remote video capture depends on source CORS policy; a local copy can be used when cross-origin canvas capture is blocked. This is an analyst review tool, not automated object recognition, OCR, landmark matching or AI visual geolocation.
