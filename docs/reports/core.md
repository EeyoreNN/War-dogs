# WP1 — Map engine, sync, storage, relay (`core`)

Branch `wp/core`, worktree `/home/user/wd-core`. Gates in this worktree: `npm run lint` ✓ ·
`npm run typecheck` ✓ · `npm run test` ✓ (32 files, 180 tests) · `npm run build` ✓ ·
`npm run build:relay` ✓ and `node server/dist/server/relay.js` answers `GET /healthz`
(`{"ok":true,"rooms":0}`, 404 elsewhere). `npm run e2e` was not run (Phase 2, integrated build).
No UI is built here, so there was nothing to screenshot.

## What shipped

**Verbatim contracts (byte copies from the spec, create-if-missing):** `src/lib/geo.ts`,
`src/lib/terrain/types.ts`, `src/lib/map/types.ts`, `src/lib/map/keys.ts`, `src/lib/map/teams.ts`,
`src/lib/realtime/transport.ts`, `src/config/maps.ts`, `server/tsconfig.json`.

**Map engine `src/lib/map/*`** (barrel `index.ts`):

- `ids.ts` — `newId` (16 base32), `newClientId` (`wd_` + 12), `seededIds` (mulberry32), patterns.
- `reduce.ts` — `createRoomState`, `compareRev`, `isStale`, `applyOp`, `applyOps`, `mergeStates`,
  `inverseOf`, `nextSeq`, `canonicalOrder`, plus `nodesOverCap` (what the single-writer removes).
  Per-entity + per-field LWW revs, tombstones, structural sharing (same reference when nothing
  changed, seq bump only when `op.seq > state.seq`), node cap, body caps. `reduce.test.ts` covers
  idempotence, stale ops, move-vs-rename in both orders, same-field races (seq then actor),
  patch-then-remove / remove-then-patch / remove→resurrect→late patch, re-add clearing field
  revs, `layer.clear` with type filter racing adds, settings per-field LWW, canonical `order`,
  the 200-op × 3-actor × 20-permutation convergence test, `mergeStates` commutative / associative
  / idempotent and `merge(a, applyOps(a, ops)) = applyOps(a, ops)`, `inverseOf` round trips and
  batching at `MAX_NODES_PER_OP`.
- `schema.ts` — zod v4 schemas for every entity, op, state, snapshot, identity, presence, ping;
  `parseSnapshot` (never throws, warns once in dev), `migrateSnapshot` (v1 only); a type-level
  assertion that the inferred state type is a `RoomState`.
- `history.ts`, `viewport.ts`, `grid.ts` (keypad sub-cells, `gridCell` inverse, `gridCentre`),
  `ink.ts` (perfect-freehand outline, quadratic path, RDP simplify with the 2,000-point cap),
  `tools.ts` (pen / shapes / measure / marker state machine, Shift snap and constrain),
  `requests.ts` (lifecycle, ranking, filters, prune), `roster.ts` (derived online, canDraw matrix,
  tallies, warnings, layers, successor, single-writer, stale members), `plan.ts` (`planToText`
  Markdown, `planToSnapshot`, `importPlan` replace / merge with id re-minting and batching),
  `scenario.ts` (demo epochs, seed plan, `DEMO_TIMELINE`, `timelineOps`, `stateAt`,
  `botPresence`, `HERO_TIMELINE`, `heroOps`, `heroStartState`, `heroFinalState`),
  `export-png.ts` (browser: `exportSvg`, `exportPng` with the 56 px legend strip).
- `boundaries.test.ts` — no `useRoomStore.setState` under `src/components/**`; no `@/` import and
  no React/Next/DOM package reachable from the relay-reachable set; no zod reachable from
  `src/components/home/**`, `storage/identity.ts`, `storage/rooms.ts`, `room/code.ts`.
- `test-fixtures.ts` — builders (nodes, requests, members, stamped ops, seeded shuffle) for tests
  in every package; not imported by app code.

**Room codes `src/lib/room/*`** — `code.ts` (zod-free: alphabet, `newRoomCode`, `normalizeCode`,
`isRoomCode`, reserved codes, `codeFromInstance`), `schema.ts` (`RoomCodeSchema`,
`AnyRoomCodeSchema`, `RelayRoomSchema` for `DEMO-<n>`).

**Realtime `src/lib/realtime/*`** — `schema.ts` (`WireMessageSchema`, `WIRE_LIMITS`, `wireLimit`,
`parseWire`, `validateWire`), `peer.ts` (the shared BroadcastChannel / memory core: hello with
snapshot, sync.request after 300 ms, jittered snapshot replies cancelled when another reply is
seen, presence every 10 s, bye), `broadcast.ts` (`wardogs:<ROOM>` channel, memory fallback when
BroadcastChannel is missing), `memory.ts` (synchronous bus), `ws.ts` (hello on open, backoff
`min(15000, 500·2^n)` ± 20 %, offline after 10 failures with 15 s retries, 1,000-op queue,
`sync.request {since}` on reconnect, cursor throttle 50 ms + 20 s keepalive, stops after
`kicked` / `room-full`), `index.ts` (`createTransport` with the 3 s fallback to BroadcastChannel
and the 30 s upgrade retry, `resolveRelayUrl`), `discord-env.ts`, `map-chunks.ts` (48 kB base64
chunks, assembler with SHA-256 verification). Tests: schema limits (100 kB op fails, 1 MB
snapshot passes, 3 MB fails), memory convergence, ws backoff / queue cap / since (mock
WebSocket + fake timers), broadcast handshake and reply cancellation (mock BroadcastChannel),
`resolveRelayUrl` precedence, fallback + upgrade.

**Storage `src/lib/storage/*`** — `local.ts` (guarded access, failure notifications),
`identity.ts` (zod-free, minted once, `generateCallsign`), `prefs.ts`, `rooms.ts` (zod-free,
max 5, forgetting drops the snapshot), `room.ts` (`compactState`, `dropOldestStrokes`,
`saveRoom` trimming to `MAX_STATE_BYTES`, `loadRoomResult` with quarantine to `:bad`),
`relay.ts` (`loadRelayOverride`), `idb.ts` (IDB `wardogs/maps` with memory fallback), `keys.ts`.

**Store `src/store/*`** — `room.ts` (`useRoomStore`, `selectNode`, `selectMe`, `selectSettings`):
boot sequence (§4.3.1) with snapshot load, transport join, empty state after 1.5 s, announce
self, persistence debounced 500 ms + recent-rooms index, `pagehide` leave; `dispatch` (meta
stamping, permission table, caps, history, send), `dispatchMany` (one history entry per batch),
`ingest` (kick detection, draw approval toasts, promotion offers), `ingestPresence` (local
`seenAt`), undo / redo as new ops, pings (4 s), prefs-backed UI toggles, `updateIdentity`,
housekeeping every 10 s when I am the single-writer (off in demo), demo mode (no persistence,
`clearMine`), uploaded-map plumbing (`requestMap`, `shareMap`, chunk assembly into IDB).
`permissions.ts` (the §5.1 table), `housekeeping.ts` (§5.5 ops), `notify.ts` (the store's one
door to toasts, swappable in tests). Tests for all three.

**Relay `server/*`** — `relay.ts` (`createRelay`, `/healthz`, upgrade validation of room and
origin, hello within 5 s, per-room state + 500-op ring, `sync.ops` when the ring covers else a
snapshot, fan-out in arrival order, presence de-duplicated by client every 15 s and on
join/leave, kick closes every socket of the client, 60 frames/s token bucket with 3 strikes,
20 bad frames, 64 sockets per room, 2,000 rooms, 6 h idle eviction, `MAX_STATE_BYTES`
enforcement with fanned-out `node.remove`, map chunk cache ≤ 1.5 MB). `relay.test.ts`
(`// @vitest-environment node`, port 0, real `ws` clients) covers every row in §7.1.
`Dockerfile` (multi-stage node:22-alpine, ships `server/dist` + `ws` + `zod`, user `node`,
healthcheck) and `docker-compose.yml`.

**E2E** — `tests/e2e/sync.spec.ts` (LOCAL two-tab part and RELAY two-context part, written
against the §4.3 UI; runs in Phase 2).

## Deviations from the spec (with reasons)

1. **Id pattern.** `IdSchema` accepts `/^[A-Za-z0-9_-]{1,32}$/` for node / request / op ids rather
   than strictly base32. The invariant `keys.ts` relies on is "no `:`", which holds; `newId()`
   still emits 16 base32 chars. Strict base32 would reject every other package's fixtures
   (`"n1"`, `"M1"`) at the wire and snapshot boundary. Client ids stay strict (`wd_` + 12 base32).
2. **`OpMeta.id` and the body `id` share one key.** `Op = OpMeta & OpBody` gives `node.update`,
   `request.update`, `request.remove`, `roster.update` and `roster.remove` a single `id`
   property, so for those op types `op.id` _is_ the entity id and there is no separate op id.
   Nothing in the engine keys on op ids (dedupe is by rev), so this is harmless, but tests must
   not assert op-id uniqueness across update ops. Proposed contract change for a later revision:
   rename the meta field to `opId`.
3. **Convergence test constraints.** The reducer is not order-independent for a `layer.clear`
   racing a concurrent _layer move_ patch (a node moved onto / off the cleared layer), or for a
   patch whose rev exceeds a concurrent remove + re-add. Both need causal delivery, which the
   relay's total order and the entity-wise merge provide in practice. The random-history
   generator therefore treats a `layer.clear` as a barrier for everything the clearing actor had
   seen and keeps node patches after the last clear they saw; adds and removes still race clears
   freely, exactly as §3.4 lists. The `mergeStates` property tests use causal cuts of the same
   histories.
4. **Peer transport answers `hello` too.** Besides answering `sync.request`, a holder answers a
   peer's `hello` with the same jittered, cancellable `sync.snapshot`, and posts its own
   `presence` immediately on a `hello`, so a joining tab converges and counts peers without
   waiting for the 300 ms request or the 10 s presence beat. Additive; the spec'd path still runs.
5. **Relay `sync.ops` on hello** is sent only when the hello carried no snapshot and the ring
   provably covers `hello.seq` (`since > floor` of the last state-changing merge and above any
   evicted seq); otherwise a snapshot. Same rule for `sync.request`.
6. **Store surface is a superset of §5.1.** Added fields `awaitingPlan`, `roomFull`,
   `rateLimitStrikes`, `pendingPromotion`, `uploadedMap` and actions `startFresh`,
   `acceptPromotion`, `declinePromotion`, `clearMine`, `requestMap`, `shareMap`, plus
   `setTransportFactory` (test seam) and `DispatchOptions.housekeeping`; `HistoryEntry` gained an
   optional `batch?: Op[]` so a `dispatchMany` batch redoes as one entry. All additive.
7. **Toasts from the store** go through `src/store/notify.ts` (one import of
   `@/components/ui/toast`), so the §4.3.9 messages that only the store can detect (corrupt
   snapshot, storage full, relay unreachable, rate-limit, bad-frame, draw approval / denial,
   map mismatch) are shown without UI wiring. Copy is in `COPY` there.
8. **`isOnline` with no presence record ever seen** returns the persisted flag (spec), so a member
   whose flag is `true` and who left before the single-writer ever saw them is never flipped to
   `online:false`. Spec-conformant; flagged as a gap for a later revision (a `lastSeen`-based
   fallback would close it).
9. **`planToText`** adds `NOTES` (text labels, measurements with metres) and an `Ink:` summary
   line under the spec'd FRIENDLY / ENEMY / MARKS / OPEN REQUESTS sections. Dates are `UTC`.
10. **Marker tool** commits from `up()` (the `ToolSession` contract only returns ops there) using
    the `down` point, so a tap places at the tap.
11. **Relay origin default**: with `RELAY_ALLOWED_ORIGINS` unset the relay allows `*` outside
    production and nothing in production.
12. **`exportSvg`** also strips `transform` from `[data-export="world"]` elements so the whole map
    renders at `MAP_PX` regardless of the live viewport (convention for WP3 below).
13. **Demo entity ids** in the seed and timeline are fixed literals (`SEED_IDS`, `TIMELINE_IDS`)
    so timeline items can reference seed entities; `seededIds(epochIndex)` stamps the seed _op_
    ids and `seededIds(epochIndex * 7919 + 1)` the timeline op ids, as specified. Epoch 0 clamps
    request timestamps at 0 (the hero).

## Requests to other packages

**WP6 — `.prettierignore`** (the four verbatim files are byte copies; `format:check` must skip them):

```diff
 # Verbatim contract files keep the spec's bytes (§3.0).
 src/lib/brand/mark.ts
+src/lib/terrain/types.ts
+src/lib/map/types.ts
+src/lib/map/keys.ts
+src/lib/realtime/transport.ts
+src/config/maps.ts
```

**WP6 — README** (relay section, §7.7): add

```md
## Relay (optional)

`npm run dev:relay` (or `docker compose up relay`) starts the WebSocket relay on :8787.
Deploy `server/Dockerfile` to any Docker host (Fly, Railway, a VPS); set
`NEXT_PUBLIC_RELAY_URL=wss://…` on Vercel and list the site origin plus
`https://<clientId>.discordsays.com` in `RELAY_ALLOWED_ORIGINS` (comma list; `*` for dev).
Env: `RELAY_PORT` (falls back to `PORT`, then 8787), `RELAY_ALLOWED_ORIGINS`, `RELAY_MAX_ROOMS`
(2000), `RELAY_IDLE_HOURS` (6). Health: `GET /healthz`. Self-hosters can point one browser at a
relay with `localStorage.setItem("wardogs:relay", "ws://host:8787")` (`"off"` forces LOCAL).
```

**WP3 — conventions the engine and `sync.spec` rely on** (`src/components/map/**`):

- Map SVG: elements to drop from exports carry `data-export="skip"` (cursor, pings, selection,
  `foreignObject` editors, help); the world transform group carries `data-export="world"`; map
  shapes/text use presentation attributes, never `class` (dev throws otherwise).
- `sync.spec` selectors: the sync pill `data-testid="sync-pill"` with text `LIVE · n in room` /
  `LOCAL · this browser`; the map surface `role="application"`; rendered markers carry
  `data-node-type="marker"`; the roster list has `aria-label="Roster"` (`role="list"`, rows
  `role="listitem"` containing the callsign and, for command roles, a `⋯` button with an
  accessible name matching `/more|menu/i` opening a `role="menu"` with a `Kick` menuitem);
  request cards are `role="listitem"` with `Claim` / `Delivered` buttons; the New request dialog
  is named `New request` with a `Fuel` chip and a `No location` button; the kicked dialog is named
  `You were removed from this room`; `/create` submits with a button named `Open war room →`
  and `/join` with `Join war room →`.
- Store hooks: `awaitingPlan` → the "Nothing here yet" dialog (`startFresh(joinHint)` for "Start
  a fresh plan here"); `roomFull`; `pendingPromotion` → "You are now commander" (`acceptPromotion`
  / `declinePromotion`); `uploadedMap` → the "Commander's map not received" banner
  (`requestMap` for "Request again"); `clearMine()` for the demo bar; `shareMap(bytes, meta)`
  after `settings.update { mapSource }`. `window.__wardogs.store` is set in non-production builds
  (merged with `window.__wardogs.now`).

## Not done

- `npm run e2e` (sync.spec) — runs against the integrated build in Phase 2; the spec is written.
- Screenshots — no UI in this package.
