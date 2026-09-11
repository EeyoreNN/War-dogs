# Architecture

How the pieces of wardogs.tech fit together. The authoritative detail is `docs/SPEC.md`; this is
the map.

## Shape

```
browser ──── Next 16 App Router (Vercel) ──── static shells + client islands
   │
   ├── localStorage / IndexedDB         rooms, identity, prefs, uploaded maps (per browser)
   ├── BroadcastChannel                 LOCAL mode: tabs of one browser converge
   └── WebSocket ── relay (server/)     LIVE mode: browsers converge; memory only, no disk
```

There is no database and no hosted auth. A person is a per-browser client id plus a typed
callsign. Discord is an optional integration: an install link (`/add`) and an embedded Activity
(`/activity`) that only supplies the call's instance id so everyone lands in the same room.

## Routes and layouts

| Group     | Layout                                                                | Routes                                                                                                       |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `(site)`  | skip link, `SiteHeader`, `<main id="main">`, `SiteFooter`, `vignette` | `/`, `/add`, `/dev` and the docs pages, `/terms`, `/privacy`                                                 |
| `(app)`   | chromeless, `Skip to map`, `<main>` with no fixed height              | `/create`, `/join`, `/room/[code]`, `/demo`, `/activity`                                                     |
| `(admin)` | `AdminStrip`, no site header                                          | `/demo/admin` and the dashboard tabs                                                                         |
| root      | fonts, `Toaster`, `LiveRegion`, JSON-LD                               | `not-found.tsx` composes the site shell itself; metadata routes (`sitemap`, `robots`, `manifest`, icons, OG) |

Every route ships a server-rendered shell: the home hero's map is a server-rendered
`<MapPreview>` (the LCP element) that a lazily loaded player replaces in place; `/demo` and
`/room/[code]` render a static shell that `MapAppLoader` hides once the client app is ready.
Dynamic imports with `ssr: false` live only inside `"use client"` loader files.

## Layers

- **`src/lib`** — pure, unit-tested logic. `map/` (types, op-log reducer with per-entity and
  per-field last-writer-wins revisions, tools, requests, roster, viewport, grid, ink, plan
  import/export, the demo scenario), `terrain/` (procedural, seeded map generation → SVG),
  `realtime/` (wire schema, memory / broadcast / websocket transports), `room/` (codes),
  `storage/` (guards for localStorage and IndexedDB), `admin-sim/` (deterministic server
  simulator and RCON handler), `openapi/`, `config-ini/`, `brand/` (mark and contour geometry
  shared by the UI and the OG renderer), `a11y/`.
- **`src/store`** — zustand stores; the room store applies ops locally, persists debounced, and
  forwards to the active transport.
- **`src/components`** — `ui/` primitives (button, card tiers, dialog, sheet, tabs, code input,
  toast, live region, …), `site/` (header, footer, contour backdrop, JSON-LD, legal shell, rise
  motion), `home/`, `map/`, `admin/`, `docs/`.
- **`server/`** — the relay: rooms keyed by code, op fan-out, `sync.request` replay, presence,
  rate limits, origin allow-list, `/healthz`. Compiled with `tsc -p server/tsconfig.json`, which
  is why the modules it shares with the browser use relative imports only.

## Sync model

Every change to a room is an **op** with a sequence number, actor and revision. Clients apply ops
optimistically and persist; transports deliver the same ops to peers, and the reducer is
idempotent and commutative under the revision rules, so any arrival order converges. Three states
are shown honestly: `LIVE · n in room` (relay), `LOCAL · this browser` (BroadcastChannel only),
`RECONNECTING…` (relay dropped; queued ops replay with `since`). Housekeeping ops are emitted by a
single writer — the lowest client id with recent presence — so the op stream stays quiet.

The demo is the same machinery with a scripted timeline keyed to five-minute wall-clock epochs:
every visitor computes the same bot ops, so the room is populated instantly and stays consistent
with or without a relay.

## Design system

Tokens live in `src/app/globals.css` (`@theme inline`): surfaces `bg-0…3`, lines, text tiers,
amber accent, semantic and game palettes, the type scale (`display-1…4`, `lede`, `mono-data`),
textures (`bg-grid`, `bg-grid-masked`, `hud-corners`, `vignette`, `scanlines`) and the card
tiers (panel / link / live). Fonts are self-hosted through `next/font/local`. The brand mark's
geometry is data (`src/lib/brand/mark.ts`) so the React `LogoMark`, the favicon and the OG image
are one drawing.

## Performance

- First-load JS budgets in `scripts/check-bundle.mjs` (site routes ≤ 190 kB gzip, app/admin
  shells ≤ 200 kB, lazy bundles measured through `data-bundle` markers plus the sibling chunks
  named in the parent's Turbopack async loader list, minus what the page already ships). Baseline in
  `scripts/bundle-baseline.json`.
- The home page reaches no `zod`, no terrain generator, no reducer and no animation runtime; the
  "rise" entry is CSS driven by a one-line IntersectionObserver.
- Terrain is generated once per map/zone, served by `/terrain/<map>.svg` with immutable caching,
  and cached as an `ImageBitmap` in the app; the canvas is not redrawn on pan.

## Security

Conservative headers in `next.config.ts` (`securityHeaders(kind, isProd)`): nosniff, referrer
policy, permissions policy, HSTS, `X-Frame-Options: DENY` and COOP for everything except the
Activity route, and a nonce-free CSP in production with three variants (site, console, activity).
The relay origin from `NEXT_PUBLIC_RELAY_URL` is the only websocket origin allowed on site
routes; the console route may reach `https:`/`wss:` so it can call a user's own listener. Every
wire frame, stored snapshot and route param is validated (zod, or hand-written guards where zod
must stay off the home page).

## Testing

- Unit: vitest + Testing Library (jsdom; `vitest.setup.ts` installs Node's webcrypto). Every pure
  engine under `src/lib/<domain>` ships with a unit test next to it; no coverage provider is
  installed, so review by reading the test, not a percentage.
- E2E: Playwright, projects `desktop` and `mobile` (Pixel 7). `playwright.config.ts` starts a
  production `next start` and the relay, so the relay half of `sync.spec` needs no Docker.
- CI (`.github/workflows/ci.yml`): check → build (+ bundle budget) → e2e, and a relay Docker
  build with a health probe.
