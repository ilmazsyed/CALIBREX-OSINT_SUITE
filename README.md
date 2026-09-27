# Calibrex OSINT Studio

A live open-source intelligence web app: threat map, intelligence wires,
news research with corroboration checks, report building, dispatch, and
account management. No AI is used; every feed is pulled from the web by the
server.

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
3. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) when prompted.
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
npm test          # feed parsing, gazetteer, clustering
npm run typecheck
npm run build && npm start
```

## Repository layout

- `server/` Express API: accounts, admin, feeds engine, gazetteer
- `client/` React + Tailwind + Leaflet web client
- `claude-artifact/` the earlier Claude artifact version (not deployed)
