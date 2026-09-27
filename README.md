# Calibrex OSINT Studio

A live open-source intelligence web app: threat map, intelligence wires,
news research with corroboration checks, report building, dispatch, and
account management, watchlists with alerts, and daily trends. Every feed is
pulled from the web by the server. AI is optional: each user can connect
their own Claude, ChatGPT or Gemini account.

## What it pulls (every 5 minutes)

| Source | Used for |
|---|---|
| Google News searches (6 wires: SATP, FATF/FATP, Regional, Power Axis, Cyber, Kinetic) | Wires, stats, map, alerts |
| BBC World, Al Jazeera, DW, France 24 | Sorted into wires by keyword |
| CISA advisories, BleepingComputer, The Hacker News | Cyber wire |
| USGS real-time earthquakes, GDACS disaster alerts | Crisis Monitor hazard layer |

Headlines are placed on the map by the places they mention (built-in
gazetteer) and grouped into threat vectors per place. Research runs live
Google News searches. **Verify** counts how many independent outlets carry a
matching story in the last 3 days (3+ = corroborated). Feed health is shown
in User Management.

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
   `render.yaml` and creates the web service and a PostgreSQL database.
3. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) when prompted,
   and `PUBLIC_URL` (the service address).
4. When the deploy finishes, open the service URL and sign in with those.
   Every push to the branch redeploys automatically.

Notes:
- Free web services sleep after 15 minutes without visitors; the first visit
  after that takes about a minute while it wakes and pulls feeds.
- Render's free PostgreSQL expires after 30 days. Switch the database to a
  paid plan (Starter) before then to keep accounts and reports.
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
npm test          # feeds, gazetteer, clustering, watchlists, trends, AI prompts
npm run typecheck
npm run build && npm start
```

## Repository layout

- `server/` Express API: accounts, admin, feeds engine, gazetteer,
  watchlists and trends (`watch.js`), optional AI (`ai.js`)
- `client/` React + Tailwind + Leaflet web client
- `claude-artifact/` the earlier Claude artifact version (not deployed)
