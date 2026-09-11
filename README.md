# wardogs.tech

The tactical map every Wardogs server needs. A fan-made, unofficial companion for the game
_Wardogs_ (Bulkhead / Team17): a shared tactical map that opens inside a Discord voice channel,
war rooms for squads, a proof-of-concept server-admin dashboard, and a dev hub for people who run
dedicated servers.

Not affiliated with Bulkhead, Team17 or Discord. No game art is used: every map is a schematic
drawn by the site itself.

## What it does

- **Shared map in a voice call.** Add the Discord app once; anyone in the call presses _Start an
  Activity_ and lands on the same map. Draw, drop markers, raise supply requests, see the roster.
- **War rooms.** Open a room at `/create`, share the six-character code or the link, join at
  `/join`. Rooms persist in the browser and sync across tabs (LOCAL mode) or across devices when a
  relay is configured.
- **Live demo.** `/demo` is a shared room with scripted squadmates acting on a shared five-minute
  clock — populated the instant it loads, no sign-in.
- **Dashboard demo.** `/demo/admin` runs a deterministic server simulator in the browser: live
  players, rotation, history, bans, audit. Nothing reaches a real server.
- **Dev hub.** `/dev` with the RCON reference, an API console (works against the in-browser
  simulator or your own listener), the OpenAPI spec, the `ServerSettings.ini` template, Discord
  troubleshooting and the map guide.
- **Honest sync.** A three-state pill: `LIVE · n in room` (relay), `LOCAL · this browser` (no
  relay), `RECONNECTING…` (relay dropped). Never a fake LIVE.

## Run it

Node 22 (≥ 20.9 works). No database, no hosted auth: everything works with a typed callsign and
`npm run dev` alone.

```bash
npm install
npm run dev          # web on http://localhost:3000
npm run dev:relay    # optional websocket relay on :8787
npm run dev:all      # both
```

Gates: `npm run check` (typecheck + lint + unit tests), `npm run build`, `npm run e2e`
(Playwright; builds and starts the site and the relay itself), `npm run check:bundle` (first-load
JS budgets, run after a build).

## Environment variables

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_*` values are baked in at build time and are
public.

| Variable                        | Where | Purpose                                                                                                                                                                                               |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | site  | Canonical origin (`https://wardogs.tech`). Used for `metadataBase`, the sitemap, robots, OG URLs and COPY LINK. CI builds and tests with `http://127.0.0.1:3100`.                                     |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | site  | Your Discord application id. Unset: `/add` shows the setup page, the hero CTA becomes _Try the live demo_ and _Add to your server_ gets a **Setup required** badge.                                   |
| `NEXT_PUBLIC_DISCORD_INVITE`    | site  | Community invite linked from the header and footer.                                                                                                                                                   |
| `NEXT_PUBLIC_GITHUB_URL`        | site  | Repository link in the footer.                                                                                                                                                                        |
| `NEXT_PUBLIC_CONTACT_EMAIL`     | site  | Contact on `/terms` and `/privacy`. Empty: "reach us on the community Discord".                                                                                                                       |
| `NEXT_PUBLIC_RELAY_URL`         | site  | `ws://` or `wss://` origin of the relay. Unset: LOCAL mode. Its origin is added to the production CSP `connect-src`; a `wardogs:relay` localStorage override pointing elsewhere is blocked by design. |
| `RELAY_PORT`                    | relay | Port the relay listens on (default `8787`).                                                                                                                                                           |
| `RELAY_ALLOWED_ORIGINS`         | relay | Comma-separated origins allowed to connect: the site origin and, for the Activity, `https://<client id>.discordsays.com`. `*` for local development only.                                             |

Site-wide branding (name, links, teams, maps, version, legal dates) lives in `src/config/site.ts`.
To rebrand or repoint a fork, edit that file and the env vars above; nothing else hardcodes the
domain, invite or contact.

## Deploy

### Site on Vercel

Import the repository, framework preset _Next.js_, Node 22. Set the `NEXT_PUBLIC_*` variables in
the project settings (at minimum `NEXT_PUBLIC_SITE_URL`). `npm run build` runs the bundle budget
check in CI, not on Vercel. The security headers and redirects in `next.config.ts` apply as is;
the Content-Security-Policy is emitted only in production builds.

### Relay (Docker)

The relay is a small WebSocket server in `server/` that fans room ops out between browsers. It
keeps rooms in memory only, drops a room six hours after the last activity, writes nothing to disk
and needs no database.

```bash
docker build -f server/Dockerfile -t wardogs-relay .
docker run -p 8787:8787 \
  -e RELAY_ALLOWED_ORIGINS="https://wardogs.example.com,https://<client id>.discordsays.com" \
  wardogs-relay
```

Locally, `npm run dev:relay` (or `docker compose up relay`) starts the relay on :8787. Deploy
`server/Dockerfile` to any Docker host (Fly, Railway, a VPS) behind TLS, then set
`NEXT_PUBLIC_RELAY_URL=wss://relay.example.com` on Vercel, list the site origin plus
`https://<client id>.discordsays.com` in `RELAY_ALLOWED_ORIGINS` (comma list; `*` for dev) and
redeploy. Env: `RELAY_PORT` (falls back to `PORT`, then 8787), `RELAY_ALLOWED_ORIGINS`,
`RELAY_MAX_ROOMS` (2000), `RELAY_IDLE_HOURS` (6). Health: `GET /healthz`. Self-hosters can point
one browser at a relay with `localStorage.setItem("wardogs:relay", "ws://host:8787")` (`"off"`
forces LOCAL; in production only the configured relay origin is allowed by the CSP). Without a
relay the site still works: rooms sync between tabs of one browser.

## Discord app and Activity setup

1. Create an application at <https://discord.com/developers/applications>.
2. Under **Activities**, enable Activities and add a URL mapping: prefix `/` → your site origin
   (for example `https://wardogs.example.com`). If you run a relay, add a second mapping: prefix
   `/relay` → the relay origin. Inside Discord the Activity loads through
   `https://<client id>.discordsays.com`, and that proxy only reaches origins you map.
3. Under **OAuth2**, note the Client ID. Add `applications.commands` to the default install scopes.
   Enable both **Guild Install** and **User Install**.
4. Set `NEXT_PUBLIC_DISCORD_CLIENT_ID=<client id>` in the site's environment and redeploy. If you
   run a relay, set `NEXT_PUBLIC_RELAY_URL` too, and add `https://<client id>.discordsays.com` to
   the relay's `RELAY_ALLOWED_ORIGINS`.
5. In Discord, join a voice channel, press **Start an Activity**, pick your app.

Discord opens the root of the URL mapping with `?frame_id=…`; `next.config.ts` redirects that to
`/activity`, where the embedded-app SDK reads the call's instance id and puts everyone in the same
room.

**Members cannot launch it?** That is almost always the **Use Activities** permission on the
voice channel (or on a temporary channel created by a bot with its own permission set). The
one-minute test and the fixes are on `/discord-help`.

## The kick trust model

There are no accounts. A callsign lives in the browser that typed it, and a war room is protected
by its code alone. So:

- Anyone in a room can remove anyone else from it. Kick deletes the roster entry; in relay mode
  the relay also drops that person's socket.
- Someone removed can come back with the code. There is no identity to enforce a block against,
  and the relay keeps no history of who was kicked.
- The only real protection is the code: do not share it with people who should not see the plan.
  Open a fresh room if a code has leaked.

This is stated the same way on `/terms`.

## Layout of the repository

```
src/app            routes: (site) marketing/docs/legal, (app) map shells, (admin) dashboard
src/components     ui primitives, site shell, home, map, admin, docs
src/lib            pure logic with unit tests (map engine, terrain, realtime, storage, brand)
src/config         site.ts (branding, links, teams, maps), maps.ts
server/            the relay (compiled with its own tsconfig; relative imports only)
scripts/           check-bundle.mjs and its baseline
tests/e2e          Playwright journeys (desktop + Pixel 7)
docs/              SPEC.md (build spec), architecture.md, accessibility.md, reports/
```

See `docs/architecture.md` for how the pieces fit, `docs/accessibility.md` for the a11y checklist
and `CONTRIBUTING.md` before opening a pull request.

## Licence and credits

Fan-made, free, no ads, no sign-up. Wardogs is a trademark of its owners; this project is not
endorsed by them. Fonts: Saira Condensed, Barlow and JetBrains Mono (SIL Open Font License),
self-hosted.
