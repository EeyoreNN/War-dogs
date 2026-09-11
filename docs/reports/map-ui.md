# WP3 — Map app UI, create/join, demo, activity (`map-ui`)

Branch `wp/map-ui`, worktree `/home/user/wd-map-ui`, built on `wp/core` and `wp/terrain` merged
in. Gates in this worktree: `npm run lint` ✓ (0 problems) · `npm run typecheck` ✓ ·
`npm run test` ✓ (56 files, 305 tests) · `npm run build` ✓ · `prettier --check` on every file this
package touched ✓. `npm run e2e` was not run (Phase 2, integrated build); the four specs this
package owns are written against the real UI and were exercised step by step with scratch
Playwright scripts against `next dev` (create → draw → marker → rename → undo/redo → reload →
copy link → second-tab LOCAL convergence → keyboard node list → help; mobile join → empty state →
bottom bar → Request FAB → Ping FAB; PNG export; plan text).

Screenshots (1440×900 and 390×844, plus 844×390) under
`/tmp/claude-0/-home-user-War-dogs/61851c33-82db-5257-a90e-a5d704125fb0/scratchpad/build/shots-map-ui/`:
`demo-desktop`, `demo-mobile`, `demo-tools`, `demo-zoomed`, `demo-nodelist`, `demo-brief`,
`demo-mobile-sheet`, `demo-mobile-more`, `demo-landscape`, `create-desktop`, `create-mobile`,
`join-desktop`, `join-mobile`, `room-desktop`, `room-manage`, `room-join-dialog`, `room-mobile`,
`room-mobile-empty`, `room-mobile-sheet`, `room-mobile-ping`, `export.png` (the 2048 px PNG the
Plan tab downloads), `hero-check` / `hero-check-late` (the §3.13 hero exports in a 16:10 frame).

## Integration (Phase 2, on `claude/wardogs-clone-improvement-agc9oe`)

Gates on the integrated build: lint ✓ · typecheck ✓ · `npm run test` ✓ (68 files, 388 tests) ·
`npm run build` ✓ · `check-bundle` ✓ (all within budget) · e2e `room` `demo` `mobile` `keyboard`
`sync`: desktop 6 passed / 2 skipped (mobile-only), mobile 3 passed / 5 skipped (desktop-only).

- **h1 on the app routes**: `MapAppLoader` renders one visually hidden, server-rendered h1
  (`Live demo · war room DEMO`, `War room ABC234`, `Discord activity · war room ABC234`); the
  static shell is aria-hidden and MapApp mounts late, so neither could own it. `ActivityShell`
  carries `Discord activity · war room` before the room is known. `/create` and `/join` already
  had the FormShell h1.
- **demo.spec marker count (9 vs 15)**: the six extras were the server shell's copy of the seed
  plan — it stays in the DOM with `hidden` by contract (§3.13), and the spec's page-wide locator
  counted it too (7 hidden + 7 live + ours = 15). The locators are now scoped to the live
  `role="application"` map, and the first assertion is `seed + 1` (the bot's troops marker
  arrives at 14 s, after that check). Spec fix; no rendering bug.
- **sync.spec (a) hang**: the New request kind picker is a `radiogroup` ("Fuel , key 1"), so
  `getByRole("button", { name: /^fuel$/ })` never resolved and the click waited out the test.
  Fixed the locator; Delivered is asserted on the DONE tab (ALL keeps a just-delivered card for
  8 s). **(b) RELAY** had two blockers: the production CSP only allows the relay origin baked in
  by `NEXT_PUBLIC_RELAY_URL` (§7.6, by design), so the `wardogs:relay` override to
  `ws://127.0.0.1:8787` was refused by `connect-src` on the config's build (see the request
  below); and the opted-out third browser has no plan, so the top bar (and pill) never rendered —
  the no-plan bar now carries the `SyncPill`, which honestly reads `LOCAL · this browser` next to
  the "Nothing here yet" dialog. Both halves pass on a build with
  `NEXT_PUBLIC_RELAY_URL=ws://127.0.0.1:8787`.
- **Store actions** `sendCursor(at)` and `ingestPing(ping)` are in; `MapSurface` sends the cursor
  on pointer move (null on leave), the broadcast transport trailing-throttles cursor frames at
  50 ms like the ws transport, and the demo director feeds bot pings through `ingestPing` —
  `useUiStore.demoPings` is gone.
- **Budget**: `/create` 252 → 167 kB and `/join` 247 → 162 kB gz. The leak was zod itself
  (94 kB gz, one chunk) reached through `CallsignSchema` from `@/lib/map/schema`; the forms use
  the zod-free `parseCallsign` (`src/components/map/forms/callsign.ts`, unit-tested against the
  schema), and `CreateForm` loads `@/lib/storage/room` (parseSnapshot) on submit only.
- `room`, `demo`, `mobile` and `keyboard` prime `wardogs:relay = "off"` so they stay LOCAL
  whatever relay the build was configured with.

## What shipped

### Routes and layout (`src/app/(app)/**`)

- `layout.tsx` — chromeless `(app)` shell: the one `Skip to map` link → `#map`, `<main id="main"
class="flex min-h-dvh flex-col">` with no fixed height / overflow, `viewport.interactiveWidget:
"resizes-content"`.
- `demo/page.tsx` — static shell (`AppShellStatic` + `<MapPreview state={demoSeedState(0)} priority/>`
  - `<noscript>`) as the child of `<MapAppLoader mode="demo" code="DEMO">`; `demo/opengraph-image.tsx`.
- `room/[code]/page.tsx` — `await params`, `AnyRoomCodeSchema`, `DEMO` → `redirect("/demo")`,
  invalid → `notFound()`, Skeleton map area; `room/[code]/opengraph-image.tsx` (generic room preset).
- `create/page.tsx` + `CreateForm.tsx` — §4.4 in order (team radiogroup with team rule and
  `--team` glow, terrain thumbnails by URL with the zone ring on the selected map, zone chips,
  squads / access RadioCards, the Discord button, callsign with dice, "Start from a recent plan",
  submit with the warning line and the focus-help dialog, sticky submit bar on phones, noscript).
  Prefills `?t=`, `?map=`, `?zone=` and the saved callsign come from `window.location` /
  localStorage **after mount** via a `useSyncExternalStore`-based `useMounted()` (no
  `useSearchParams`, no setState-in-effect).
- `join/page.tsx` + `JoinForm.tsx` — `CodeInput` (prefilled from `?code=` after mount, `DEMO` →
  `/demo`, the spec error line + shake), Discord, callsign, the 2×3 focus grid, `Rejoin` card.
- `activity/page.tsx` + `ActivityShell.tsx` — static "Loading the war room for this call…" shell;
  outside Discord → toast + `router.replace("/demo")`; inside with a client id →
  `initActivity` → `codeFromInstance` → `<MapAppLoader mode="activity" activity={{ openExternal }}>`;
  inside without → the `/add` steps in a Callout. Every internal navigation in the app is gated on
  `mode !== "activity"`; external links go through `openExternal`.
- `src/lib/discord/activity.ts` — the only importer of `@discord/embedded-app-sdk` (`initActivity`,
  `activityParams`), with a test.
- `src/lib/a11y/audit.ts` — `auditPage(): Issue[]`, one self-contained function (no closures) so
  `page.evaluate(auditPage)` ships it into any page; rules per §7.2 #10; unit-tested.

### Map UI (`src/components/map/**`)

- **§3.13 exports**: `MapPreview` (server-renderable; terrain `<img>` by URL with `fetchPriority`,
  the same `Scene` layers, `fitToBox` geometry, `fit="cover"` + `shift` for the hero), `HeroStatic`,
  `HeroFrame` (`"use client"`, `dynamic(() => import("./HeroPlayer"), { ssr: false })`, loads only
  in-viewport and never under reduced motion, swaps in place), `HeroPlayer` (default export,
  `data-bundle="wd:hero"`, loops `HERO_TIMELINE` over `heroStartState()`, cover-fitted canvas
  terrain + SVG layers, the "take over" link), `MapAppLoader` (default export, the only dynamic
  importer of `MapApp`, hides the shell on `onReady`), `MapApp` (default export,
  `data-bundle="wd:map-app"`, `MapAppProps` as specified).
- **Scene** (`Scene.tsx`, `MarkerSprite.tsx`, `layers/*`): `<defs>` with the eight Appendix B
  symbols (original artwork), the request crate and the peer chevron; one world group
  `data-export="world"` with `GridLayer` (A–J / 1–10, keypad sub-grid from scale 2), `ZoneLayer`,
  `StrokeLayer` (perfect-freehand outlines), `ShapeLayer` (arrow / line / circle / rect with
  transparent hit strokes), `MeasureLayer` (world line, screen-constant `1,240 m · 047°` label),
  `MarkerLayer` (32 px screen-constant `<g data-screen style="transform: translate(…) scale(var(--inv))">`
  glyphs with mono halo labels and the faction in the label, world-scaled danger disc, request
  pins with number and leader), `TextLayer`, `PingLayer`, `CursorLayer`, `SelectionLayer`.
  Everything inside the SVG uses presentation attributes; skip layers carry `data-export="skip"`
  (asserted by `export-svg.test.tsx`).
- **`MapSurface.tsx`**: terrain `<canvas>` below (drawn once per map / resolution bucket from
  `terrainBitmap`, or the uploaded map from IDB, following the viewport by CSS transform, never
  redrawn on pan), the `role="application"` SVG (`#map`, `aria-describedby="map-help"`,
  `tabindex=0`, `touch-action: none`), an overlay `<canvas>` for the in-progress pen stroke
  (`getCoalescedEvents`, rAF), pointer capture, pinch / two-finger pan, wheel and ctrl-wheel zoom
  at the cursor, Space / middle-button pan, select-drag-move with a live transform, handle drags
  (shape endpoints, danger radius), double-click precedence (rename / edit a node, ping on empty
  map in any tool — tap commits are deferred 230 ms so a double-click never leaves a marker
  behind), long-press marker sheet and double-tap ping on touch, the keyboard model of §4.3.3
  (crosshair with grid reference, arrows / Shift, Enter for markers, shapes A→B, pen points, text,
  request placement, ping; Esc; Delete; Tab → node list), the inline `foreignObject` editor for
  marker labels / text, the "Commander's map not received" banner, and the `ViewportApi`
  (zoom / fit / centre / crosshair / export raster) registered in the UI store.
- **Chrome**: `TopBar` (hud-corners, code chip copy with the COPIED flash, COPY LINK with the
  `Mod+C` hint, MANAGE for command roles, map · zone centre / `DEMO · resets in m:ss`, the sync
  pill, Brief toggle, callsign menu with Change callsign / focus / ink / Leave room, CMD /
  Co-CMD badge; container-query collapse order; the 44 px phone variant with the demo chip),
  `SyncPill` (LIVE · n in room / LOCAL · this browser / RECONNECTING… / CONNECTING… with the spec
  tooltips, `data-testid="sync-pill"`), `ToolRail` (vertical roving toolbar, `aria-pressed` +
  `aria-keyshortcuts`, tooltips, ink radiogroup with 20 px discs in 40 px targets, FRIENDLY /
  ENEMY with the faction radiogroup / MARK palettes, lock glyphs and `Ask to draw` in request
  mode, sticky version), `ZoomStack` (+ − fit fullscreen grid ping, layers popover with
  `Focus my squad` in squad mode), `BottomChrome` (sound toggle with a generated click, OUR
  DISCORD, CONTROLS & HELP, version + schematic note), `RequestsPanel` (+ New with the `N`
  kbd, HIDE ≫ / ≪ PANELS, ALL · OPEN · MINE · DONE tabs, ranked cards with the state rule, kind
  icon, state text, URGENT badge, `#n D7` grid chip that centres the map, tabular age timer
  with amber / red thresholds and an absolute-time tooltip, by / claimed by / ETA countdown /
  note, Claim / Delivered / Release with the > 60 s confirm, ETA chips `30s 1m 2m 5m`, edit and
  delete, the `No pilot in room` hint line, the three empty states, hover ↔ pin highlight via
  `highlightId`), `NewRequestDialog` (kind chips with keys 1–4, Normal / Urgent, note, Place on
  map / No location), `RosterPanel` (tallies, `focusWarnings`, draw-request badge, COMMANDER /
  TEAM or per-squad sections, 40 px rows with ink dot, `(you)`, crown / star, focus chip you can
  change, idle dot, offline rows, Approve / Deny, the `⋯` `role="menu"` with co-commander, allow /
  revoke drawing, hand off, kick — each with confirms; the empty copy with a Copy link button),
  `ManageDialog` (Map with thumbnails / zone chips / `UploadMap`; Squads with add / remove and
  the move-or-delete prompt; Access; Plan with Export PNG, Copy plan as text, Save / Load plan
  with the replace / merge and other-map confirms, Clear ink / markers / everything; Room with
  the link, the warning Callout and Leave room), `HelpDialog` (Appendix A rendered from
  `lib/keymap.ts` with `<Kbd>` and the Pings preference), `NodeList` (the visible
  `role="listbox"`, collapsed disclosure that opens on keyboard focus, options read as
  `Enemy FOB · Valkyra "AUSTIN" at F3, placed by Rook`, arrows / Shift-nudge / Delete / Enter),
  `AppDialogs` (the undismissable Join dialog with dice and the focus grid, squad pick, `Nothing
here yet` with Wait / Start fresh, `You were removed from this room`, `This room is full (64)`,
  `You are now commander` OK / Decline, the clipboard fallback dialog, `Downloads are blocked
inside Discord`).
- **Mobile** (`mobile/*`): the 56 px `role="toolbar"` bottom bar (Select · Pen · Arrow · Marker ·
  More, 44 px targets), `Ping` / `Request` FABs that rise with the sheet, the panels bottom
  `Sheet` with Requests / Roster tabs and the peek handle badge (positioned above the bar through
  a sized transformed container so the primitive's `fixed bottom-0` lands at 56 px), the marker
  sheet (also the long-press palette), the More sheet (tools, ink, undo / redo, grid / fit /
  fullscreen, sound, help, Manage, Clear mine, the node list). Portrait phones fit the map to
  the width. Brief mode (`B`, default ON for members on phones, remembered) hides tools and
  panels and shows the FABs and an `Exit brief` chip; the map refits when brief toggles.
- **Demo** (`demo/*`): `useDemoDirector` boots the store with `stateAt(now)` on
  `demoRelayRoom(now)`, applies every due op idempotently, schedules the rest with `setTimeout`,
  feeds `botPresence` every 10 s, re-syncs on `visibilitychange`, rolls the epoch (leave → boot
  the next seed and room), and renders the scripted bot pings; `DemoClock` ticks from the store
  clock (`window.__wardogs.now` aware); `DemoBar` (`Like it? Open your own war room →`,
  `Clear mine` with its tooltip); the mobile `Open yours →` chip with `demoChipDismissed`.
- **Announcements**: `lib/announcer.ts` diffs store states (request lifecycle, others' marker
  placements, joins; floods collapse to `n changes on the map`) and `MapApp` announces every line
  through `announce()`; the sound click plays on others' new requests when sound is on.
- Pure helpers with unit tests under `lib/`: `palette` (asserts the hex literals match
  `globals.css`), `format`, `keymap`, `screen`, `describe`, `announcer`, `upload` (magic-byte
  sniff, size copy), `hit`; plus `export-svg.test.tsx` and `panels.test.tsx` (RequestsPanel,
  RosterPanel, ToolRail, NodeList on the real store with the memory transport).
- E2E specs: `tests/e2e/room.spec.ts`, `demo.spec.ts`, `mobile.spec.ts`, `keyboard.spec.ts`.

## Deviations from the spec (with reasons)

1. **Own cursor is never sent.** `RoomStore` exposes no `sendCursor`; `CursorLayer` renders peers'
   cursors from `presence[client].cursor` and will light up as soon as the store gains the action
   (request to WP1 below). Nothing else is missing from the cursor path.
2. **Bot pings in the demo** are rendered from `useUiStore.demoPings` (merged into the ping layer)
   because the store cannot ingest a ping that is not mine (`ping(at)` sends as me). Request below.
3. **Enter on a focused map edits the selected marker / text only in the Select tool**; in a
   drawing tool Enter always performs the tool (so `1`, `Enter`, `Enter` places two markers, as
   Appendix A reads). Keyboard rename otherwise goes through the node list (Enter), which is the
   path §4.3.10 specifies.
4. **Just-delivered requests linger in ALL for 8 s** (then only DONE shows them). `filterRequests("all")`
   is open + claimed, but the "claim" motion needs the hand-off to be seen, and WP1's
   `sync.spec` asserts `cardA` contains "delivered" while on the ALL tab.
5. **Tap commits of the pen and marker tools are deferred 230 ms** so a double-click on the map is
   a ping (§4.3.3 precedence) and never also a dot / marker.
6. **Request pins sit up-right of their anchor with a leader line**; the spec fixes the glyph
   (crate + number, state colour) but not the placement, and centring the crate on the anchor
   covered the marker most requests belong to (a Fuel request at the LZ).
7. **Portrait phones fit the map to the width** rather than `fitToBox` (which leaves a small
   square in the middle of a tall box); `0` / Fit does the same. Desktop is unchanged.
8. **`HeroFrame` is `role="group"`** (with the spec's `tabindex=0`, `aria-label` and Enter → /demo)
   rather than a link role, because the player renders a real "take over" link inside it.
9. **The Join dialog hides the `Dialog` primitive's Close button** with a scoped CSS wrapper; the
   primitive always renders it and the dialog must not be dismissable.
10. **Additive props**: `HeroPlayer` takes `onReady`, `MapPreview` takes `fit` / `shift`,
    `MapAppLoader` forwards `onReady`; all optional, the §3.13 signatures still hold.
11. **Brief defaults ON for phone members only when `wardogs:prefs` has no `brief` key** (the pref
    shape has no "unset" state, so the first visit sets it and the choice is then remembered).
12. **Long-press on touch opens the marker sheet** (bottom sheet with "Place a marker here") and a
    tile places at the long-pressed point — a sheet, not a popover at the point.
13. **Landscape phones** keep the compact rail and the desktop panel column (the `Sheet` primitive
    is fixed at 360 px, the spec's 280 px right sheet would need a primitive change).
14. **`demo.spec` uses `page.clock.install({ time })` + `runFor`** rather than `setFixedTime`:
    `runFor` needs installed fake timers, and the director's timers must advance with the clock.
15. **PNG export writes `--inv: 2.5` on the world group during serialisation** so screen-constant
    markers come out legible at 2048 px (with the live `--inv` a fit-zoomed room exports 13 px
    glyphs); the `exportSvg` contract (reset world transform, skip layers) is untouched.
16. **Text label sizes** are world-scaled at 28 / 40 / 56 world px (sm / md / lg); the spec gives
    no numbers.
17. **`Ask to draw`** renders inside the rail under the palettes (the rail is the scrolling
    column) rather than "under the rail".
18. **Peer cursors are hidden in demo mode** (bots have no cursors; visitors' cursors would need
    the WP1 action above).

## Requests to other packages

**Integration — `playwright.config.ts` / `.github/workflows/ci.yml` (WP6)**: `sync.spec` (b) needs
the e2e build to bake in the relay origin, exactly as production does (§7.6: the CSP allows only
`NEXT_PUBLIC_RELAY_URL`; a `wardogs:relay` override elsewhere is blocked by design). Add
`NEXT_PUBLIC_RELAY_URL: process.env.NEXT_PUBLIC_RELAY_URL ?? "ws://127.0.0.1:8787"` to the Next
`webServer` `env` (and `NEXT_PUBLIC_RELAY_URL: "ws://127.0.0.1:8787"` to the CI `env`). The
LOCAL journeys already opt out with `wardogs:relay = "off"`, so nothing else changes.

**WP1 — `src/store/room.ts`** (done in integration: `sendCursor` / `ingestPing` are in):

```ts
// RoomStore
  /** Send my cursor (throttled by the transport); null when leaving the map. */
  sendCursor(at: Point | null): void;
  /** A ping from someone who is not me (the demo director's scripted bots). */
  ingestPing(ping: Ping): void;
// implementation
    sendCursor(at) {
      const s = get();
      if (!s.me || !s.room) return;
      internals.transport?.sendEphemeral({ k: "cursor", room: s.room, client: s.me.client, at });
    },
    ingestPing(ping) {
      addPing({ ...ping, ts: now() });
    },
```

**WP1 — `tests/e2e/sync.spec.ts`** (a) (done in integration): after `cardB … Delivered`, assert on
the DONE tab or within 8 s — ALL shows open + claimed by contract:

```ts
-(await expect(cardA).toContainText(/delivered/i));
+(await a.getByRole("tab", { name: /done/i }).click());
+(await expect(a.getByRole("listitem").filter({ hasText: /fuel/i }).first()).toContainText(
  /delivered/i,
));
```

**WP6 — home page**: `<HeroFrame><HeroStatic /></HeroFrame>` inside the 16:10 tier-3 frame with
`overflow-hidden`; both fill their box (`h-full w-full`). `HeroFrame` owns the focusable wrapper.
**WP6 — `tests/e2e/a11y.spec.ts`**: `import { auditPage } from "../../src/lib/a11y/audit";` and
`const issues = await page.evaluate(auditPage);` — the function is self-contained by design.
**WP6 — `next.config.ts`** (optional, dev only): `allowedDevOrigins: ["127.0.0.1"]` so scripts that
hit `next dev` over 127.0.0.1 hydrate (Next 16 blocks cross-origin dev resources; `next start`
is unaffected).

## Not done

- `sync.spec` (b) on the Playwright config as committed: it builds without
  `NEXT_PUBLIC_RELAY_URL`, so the CSP refuses the relay override (see the request above); (a) and
  every other owned spec pass on that build too.
- Browser tests for the upload pipeline and the plan load dialogs beyond manual checks; the
  squad-mode layers popover was verified by code only.
- The landscape-phone right sheet (deviation 13). Cursor sending is in (integration); the
  per-viewer cursor _rendering_ is unchanged.
