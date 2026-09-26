# Calibrex OSINT Studio — Claude artifact build

The Calibrex OSINT Studio UI, packaged as a single-file claude.ai artifact.
AI features run on Claude (each person's own Claude account); identity, access
tracking and revocation use the claude.ai artifact runtime.

## Build

```
npm install
npm run build        # -> dist/calibrex-osint-studio.html
npm run typecheck
```

`build.mjs` compiles Tailwind with the original Calibrex theme, bundles React,
Leaflet and the app with esbuild, and inlines everything (plus an embedded world
basemap, since artifact pages cannot load external map tiles) into one HTML file.

## What changed from the AI Studio version

| Original | Artifact build |
|---|---|
| Gemini API key bundled into the browser | Claude via the artifact `sample` capability; no API key |
| Email/password + master token stored in localStorage | claude.ai sign-in identity (`user` capability) |
| "Master Identity Registry" read from one browser's localStorage | Owner-only User Management: live presence, visit log, revoke/restore (`db` + `room`) |
| Report history in localStorage | Private per-operator records in the artifact database, localStorage fallback |
| `<a download>` / print popups | `downloads` capability: TXT and printable HTML dossier |
| CartoDB map tiles | Embedded Natural Earth country outlines (world-atlas) |

Bugs fixed on the way: build-breaking import paths and syntax errors, map
"Investigate" button, threat pin coordinates, FATP filter, repeated
investigations, Hold-to-Dispatch release, Re-Synthesize, state lost when
switching screens, footer overlapping content. Scenario feeds are labelled
SIMULATED.

## Access control

- Share the artifact from claude.ai (Share button). Declaring the database makes
  it organization/invite-only; it cannot be shared by public link.
- The owner sees **User Management** in the sidebar: everyone seen, when, how
  often, who is online now and on which screen, with Revoke / Restore.
- Revoking locks that person out immediately. Remove them in the Share menu too
  to take the link away entirely.
