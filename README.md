# Calibrex OSINT Studio

A live open-source intelligence web app: threat map, intelligence wires,
news research with corroboration checks, report building, dispatch, and
account management, watchlists with alerts, and daily trends. Every feed is
pulled from the web by the server. AI is optional: each user can connect
their own Claude, ChatGPT or Gemini account.

## What it pulls (every 5 minutes)

| Group | Sources |
|---|---|
| Google News wires | 6 searches: SATP, FATF/FATP, Regional, Power Axis, Cyber, Kinetic |
| International news | BBC World, Al Jazeera, DW, France 24 |
| Indian news | India Today OSINT team (via a Google News search of indiatoday.in), The Hindu, Times of India, Hindustan Times, NDTV, The Indian Express, ThePrint, Greater Kashmir, PIB (Government of India releases) |
| South Asia | Dawn (Pakistan); SATP (South Asia Terrorism Portal) via its YouTube channel, its website through Google News, and reports citing SATP data; South Asian Voices (Stimson) |
| Defence & military | IDRW, Livefist Defence, ThePrint Defence, Naval News, Breaking Defense, The War Zone, Defense News, and an ORBAT / force-deployment news search |
| OSINT & analysis | Bellingcat, International Crisis Group, Long War Journal, War on the Rocks, The Diplomat, ACLED, CTC Sentinel (West Point), Jamestown Foundation |
| Cyber | CISA advisories, BleepingComputer, The Hacker News, The Record |
| OSINT social accounts | Bluesky: Bellingcat, Eliot Higgins, GeoConfirmed, OSINTtechnical, Damien Symon (satellite imagery, South Asia), Jaidev Jamwal (PLA order of battle), Institute for the Study of War, Rob Lee, Shashank Joshi; Telegram: OSINTdefender, osintlive (mirror of OSINT X accounts) |
| Hazards | USGS real-time earthquakes, GDACS disaster alerts |

Admins can switch any source off and add their own (RSS/Atom feeds, news searches such as `site:example.com`, public
Telegram channels, Bluesky or Mastodon accounts) under **User Management →
Sources**, with a live health check per source. X (Twitter) has no free feed;
a paid X-to-RSS service's address can be added as an RSS source.

Social posts are labelled "SOCIAL · UNVERIFIED" and never raise alerts on
their own. Headlines are rated by keyword, sorted into wires, and placed on
the map from the places they mention (built-in gazetteer, including Indian
states and districts). Research runs live Google News searches. **Verify**
counts how many independent outlets carry a matching story in the last 3
days (3+ = corroborated).

## Reading full articles

- **Read** (feed, research results, threat wire, alerts, watchlist matches)
  opens the full story in an in-app reader. The server fetches the page,
  resolves Google News links to the publisher, and extracts the text.
  Paywalled or script-only pages fall back to "Open original".
- After every refresh the server reads the articles behind the most serious
  new reports, adding a summary and placing them on the map when only the
  article body names the location.
- AI answers read up to six full articles behind the sources on screen, and
  the reader can summarise any single article with AI.
- The reader only fetches public web addresses (local and private networks
  are refused) and caches results for 6 hours.

## Visual Intel

- **Visual Intel dashboard** (sidebar): every photo and video gathered from
  the last 48 hours of reporting in one grid, filterable by type (photos,
  video, social posts), severity, wire and words, with a full-screen viewer.
  A **Satellite watch** row shows the latest NASA daily pass over each top
  threat location.
- **Visual intel button** on every feed item, threat card, map pin, Threat
  Wire, alert, research result and watchlist match: opens that story's
  collection with two tabs:
  - *Photos & video*: pictures and video from the feed item and from the
    articles themselves (lead image, captioned photos, embedded YouTube/Vimeo,
    Telegram and Bluesky post media).
  - *Satellite*: NASA VIIRS true colour (latest daily pass and 7 days
    earlier), NASA heat/fire detections, and Esri high-resolution reference
    imagery of the area, plus links to NASA Worldview, FIRMS, Sentinel Hub EO
    Browser, Zoom Earth and Google Maps satellite.
- Where it comes from: RSS media tags and inline images, Telegram channel
  previews, Bluesky's public API (which, unlike its RSS, includes images),
  YouTube feeds, and the article pages read by the server.
- Limits: satellite imagery is free daily imagery (about 375 m per pixel),
  good for smoke, fires, floods and burn scars but not for vehicles or
  buildings; the high-resolution layer is archival, not current. Map points
  are the centre of the named place, not the exact incident. Images come
  through the server's media proxy (public addresses only, images only).

## OSINT Tools & Infrastructure Recon

- **Tool directory** (OSINT Tools screen): a curated toolkit distilled from
  awesome-osint, the OSINT Framework and awesome-osint-repos, grouped by what
  you start with (domain, IP, email, username, phone, maps/satellite, images,
  companies, crypto, and directories/automation). Sites open in a new tab and
  carry your search term where they support it; command-line tools are marked
  as GitHub projects to run on your own machine.
- **Infrastructure Recon** (built in, no key, no external worker): enter a
  domain or IP tied to a threat actor's site and Calibrex gathers, from public
  sources, in one view:
  - subdomains from Certificate Transparency (crt.sh)
  - DNS records (A, AAAA, MX, NS, TXT via DNS-over-HTTPS)
  - domain registration (RDAP): registrar, dates, status, registrant org
  - hosting / IP ownership (RDAP): network, organisation, country, abuse contact
  - reputation flags (abuse.ch URLhaus)
  - Wayback Machine snapshot, plus one-click links to VirusTotal, Shodan,
    urlscan.io, AbuseIPDB, GreyNoise and more.
  It looks up **infrastructure, not people**: emails, usernames and phone
  numbers are rejected. Sources can be incomplete or rate-limited; the panel
  says so and links out to confirm.

## Subject Lookup (Phase 3, OFF by default)

Investigating individuals carries legal duties (in India, the DPDP Act 2023),
so this is disabled for everyone until the admin turns it on, and it is built
to stay on the safe side of the line:

- **Off by default.** Admin switches it on globally, then grants it per user
  in User Management. Non-granted users see a locked screen.
- **Usage agreement on every lookup.** A granted user must read and accept the
  Acceptable Use Agreement for each search — the tick resets after every one —
  and cannot proceed until they do. Each acceptance is recorded (who, the
  agreement version, and a timestamp) in the audit log.
- **Editable agreement.** The admin edits the agreement text in User
  Management (paste your lawyer's wording). Editing it changes its version, so
  everyone must accept the new text on their next lookup.
- **Purpose + audit.** Every search requires a stated purpose and optional
  case reference, and is written to an immutable audit log the admin can view.
- **Daily limit** per user (default 25).
- **Phone lookup:** offline metadata only — country, line type, validity —
  plus search links. No owner name, no private data.
- **Username lookup:** builds candidate profile URLs across ~25 platforms for
  the analyst to open and verify. Calibrex does **not** mass-query sites, and
  every result is labelled an unverified lead, not an identification.
- Deliberately excluded: owner identification, breach passwords, and
  Google-account mapping.

Consult a lawyer on your DPDP basis and customer agreement before enabling it.

## Watchlists, alerts and trends

## Watchlists, alerts and trends

## Watchlists, alerts and trends

- **Watchlists**: each user saves up to 25 terms (names, places, groups,
  vessels). New reports that match raise an in-app alert (bell in the
  header) and on the Watchlists screen. (Email digests are built in but
  switched off; they only appear if `RESEND_API_KEY` and `EMAIL_FROM` are
  ever set.)
- **Trends**: daily report counts per wire, severity and place, kept for 90
  days. History builds up from the day you deploy.
- **Custom feeds**: admins add any RSS/Atom feed in User Management, test
  it, and choose which wire it feeds (or let keywords decide).

## Optional AI

Admins can switch AI on or off for everyone (User Management). When on,
each user connects their own account in **Settings → AI Connection**:

1. Choose Claude, ChatGPT or Gemini.
2. Click **Connect**. The recommended path signs in through OpenRouter
   (one login for all three; no key to copy). Alternatively paste an API key
   from Anthropic, OpenAI or Google, with step-by-step links shown.
3. Pick a model and click **Test connection**.

AI buttons then appear in Research (summarise), Verify (explain), Report
Generator (draft), Threat Wire (situation summary) and Rapid Brief. The AI
only sees the sources on screen and cites them as [1], [2]. Keys are
encrypted at rest (`AI_ENCRYPTION_KEY`) and never sent to the browser. Set
`PUBLIC_URL` to your Render address so the OpenRouter sign-in returns to
the right place.

## Accounts

- New operators request access on the sign-in page; accounts start as
  **pending** until an admin activates them.
- Admins can **Activate**, **Suspend**, **Reactivate**, reset passwords,
  grant admin, and delete accounts in **User Management**.
- Suspended users see "Suspended by Calibrex. Contact your provider for
  re-access." with the provider contact you set.
- The first admin is created from the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  environment variables on first start.

## Deploy on Render

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. Render reads
   `render.yaml` and creates the web service (Starter plan) with a **1 GB
   persistent disk** mounted at `/var/data`.
3. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) when prompted.
   Leave `PUBLIC_URL` blank for now.
4. When the deploy finishes, copy the service address (e.g.
   `https://calibrex-osint-studio.onrender.com`) into the `PUBLIC_URL`
   environment variable and save; it redeploys.
5. Open the service URL and sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
   Every push to `main` redeploys automatically.

### Storage: disk vs. database

- **Default (this Blueprint): a persistent disk.** Accounts, reports,
  settings and the audit log are kept in a JSON file store on the disk at
  `/var/data`. It survives restarts and deploys and never expires. A disk
  needs a paid instance (Starter), pins the service to one instance, and the
  service does not sleep.
- **Prefer managed Postgres?** Remove the `disk:` block and `DATA_DIR` from
  `render.yaml`, set the plan to `free`, and uncomment the database block plus
  the `DATABASE_URL` env var at the bottom of the file. The app uses Postgres
  whenever `DATABASE_URL` is set and the disk-backed file store otherwise.
  (Render's free Postgres expires after 30 days; upgrade it before then.)

Notes:
- Back up the data occasionally: use **User Management → Backup & restore →
  Download backup** (one click, no shell needed). It downloads the whole
  dataset as one JSON file. Restore the same way. Keep backups private — the
  file contains password hashes and encrypted AI keys.
- To reset the admin password: set `ADMIN_PASSWORD_RESET=true` with a new
  `ADMIN_PASSWORD`, redeploy, then remove `ADMIN_PASSWORD_RESET`.

## Run locally

```
npm install
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme123 npm run dev
```

Opens the client on http://localhost:5173 with the API on :3000. Without
`DATABASE_URL`, data is stored in `./data/db.json`.

```
npm test          # feeds, sources, article reader, watchlists, trends, AI prompts
npm run typecheck
npm run build && npm start
```

## Repository layout

- `server/` Express API: accounts, admin, feeds engine (`feeds.js`), source
  catalogue (`sources.js`), article reader (`article.js`), visual intel and
  satellite imagery (`visuals.js`), infrastructure recon (`recon.js`),
  gazetteer, subject lookups (`subject.js`, off by default),
  watchlists and trends (`watch.js`), optional AI (`ai.js`)
- `client/` React + Tailwind + Leaflet web client
- `claude-artifact/` the earlier Claude artifact version (not deployed)
