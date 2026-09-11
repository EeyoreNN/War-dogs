# site (WP6) — Phase 1 report

Branch `wp/site`, worktree `/home/user/wd-site`. Phase 0 (tokens, primitives, shell, tooling)
is the base; this report covers Phase 1.

## Shipped

**Home `/` (§4.1)** — `src/app/(site)/page.tsx` composing `src/components/home/*`:

- `hero.tsx`: eyebrow, `display display-1` H1, lede, CTA stack with the configured / unconfigured
  switch (`site.discord.clientId` empty → primary _Try the live demo_, secondary _Add to your
  server_ with the warn **Setup required** badge), the "Not an admin?" link, the two outline
  buttons (2-col grid at 390 px), the code field and the rejoin card. Two columns at `lg`
  (`5fr / 7fr`), map first and copy centred below `lg`.
- `hero-frame-shell.tsx` (client): the tier-3 frame — 16:10, `hud-corners`, `shadow-panel`, amber
  ground glow, 32 px top bar (mark 16, mono `WAR ROOM DEMO`, LIVE pip with `scanlines`), the
  _This is the real app — take over →_ overlay, `tabindex=0` + `aria-label` + Enter → `/demo`.
  Inside it, per the Phase 1 rule, a `Skeleton` layout (no stand-in map).
- `code-field.tsx` (client): single mono uppercase `Input` (`aria-label="War room code"`,
  placeholder `ABC234`) with an icon submit; Enter → `/room/<CODE>`, `DEMO` → `/demo`, otherwise
  the inline error `Codes are 6 letters or digits, never 0, O, 1 or I.` (`role="alert"`,
  `aria-invalid`, `aria-describedby`, 2 × 4 px shake). Progressive enhancement: the form is
  `action="/join" method="get" name="code"`, so it submits without JavaScript.
- `RecentRooms.tsx` (client): tier-1 **Rejoin** card, max 3 rows
  `X5GM4Q · Lonestar · Zestafona · 12 min ago` → `/room/X5GM4Q`, a **Forget** icon button per
  row. Backed by `useSyncExternalStore` over `wardogs:rooms` (no set-state-in-effect); renders
  nothing on the server and when there is no history — no layout is reserved.
- `logic.ts` (+ `logic.test.ts`): `resolveCodeRoute`, `formatRelativeTime`, `CODE_ERROR`.
- `room-api.stub.ts`: the local test double for WP1's `src/lib/room/code.ts` (`normalizeCode`,
  `isRoomCode`, `isReservedCode`, `RESERVED_CODES`, `CODE_ALPHABET`) and
  `src/lib/storage/rooms.ts` (`listRecentRooms`, `forgetRoom`) with the same `wardogs:rooms`
  key and hand-written guard. **Deleted in Phase 2** (swap the two import lines in
  `code-field.tsx`, `logic.ts` and `RecentRooms.tsx`).
- `how-it-works.tsx`: `id="how"`, three tier-1 step cards in a `role="list"` `<ol>` with the ghost
  numeral; media are original drawings — the primary button mock, a voice-call toolbar (three
  round buttons, rocket, _Start an Activity_ tooltip, cursor) and the app top bar mock
  (`WAR ROOM ABC234 · LIVE · 4 in room`).
- `exit-cards.tsx`: three tier-2 `LinkCard`s with the upstream copy.
- `faq.tsx` + `faq-data.ts`: five native `<details>` items, summary Barlow 600 17 px, rotating
  chevron; `faqJsonLd()` mirrors the same data into the `FAQPage` JSON-LD emitted by the page.
- `src/components/site/motion.tsx`: `<Rise>` — the §2.4 "rise" vocabulary (opacity 0→1,
  12 px → 0, 240 ms, stagger 60 ms, once, viewport margin −10 %). See _Deviations_.

**Site shell (§2.9)** — `src/components/site/header.tsx`: sticky, 56/64 px,
`bg-bg-0/80 backdrop-blur-[12px]`, bottom `border-line` only after 8 px scroll (an absolutely
positioned 8 px sentinel + `IntersectionObserver` → `data-scrolled`), nav underline (1 px accent
rule, `scale-x` 0→1 in 160 ms, on hover and on `aria-current="page"`; `/#how` is current only
when the hash matches), mobile menu as a full-height sheet with 20 px links and the primary CTA
pinned to the bottom (safe-area padded, Esc closes and returns focus, first link focused on open).
`footer.tsx`: 1 px accent rule at 30 %, lockup + `v{site.version}`, the disclaimer in mono 12 px
`text-fg-muted`, links right.

**`/add` (§4.6)** — `src/app/(site)/add/page.tsx`: `const { to } = await searchParams`,
`discordInstallUrl(to)` → `redirect()`; otherwise the setup page with the five steps in a tier-1
panel, the note callout linking `/discord-help`, and the two buttons. `robots: noindex`.

**`/terms`, `/privacy` (§4.10)** — `src/components/site/legal.tsx` (`LegalPage`, `ContactLine`)
and the two pages with the spec copy verbatim: 68ch column, mono `Updated {site.legalUpdated}`,
`display-2` H1, lede intro on an accent rule, h2 Barlow 600 20 px, contact from
`site.contactEmail` or the community Discord, cross-link at the end.

**Not found (§4.11)** — `src/app/not-found.tsx` outside every group, composing skip link,
`SiteHeader`, `SiteFooter`; copy per spec; the same `CodeField` (`size="lg"`); `robots: noindex`.

**SEO (§6)** — `sitemap.ts` (12 routes with the spec priorities / frequencies, `lastModified =
site.updated`), `robots.ts` (allow all; the nine disallows; sitemap URL from `site.url`),
`manifest.ts` (Phase 0), root metadata gains `openGraph.images` (`/opengraph-image`, with alt)
and `twitter.images`; every page exports `title`, `description`, `alternates.canonical`;
`FAQPage` JSON-LD on the home page.

**Budgets and CI (§7.3, §7.5)** — `scripts/check-bundle.mjs` (reads `.next/server/app/**/*.html`,
sums the non-`noModule` `/_next/static` scripts at gzip -9 per route, classifies routes into
site / app / admin budgets, finds lazy bundles by their `data-bundle="wd:<name>"` literal and
follows chunk references; prints a table, exits 1 over budget) and `scripts/bundle-baseline.json`.
Measured today: `/` **153.2 kB**, `/terms` and `/privacy` 154.6 kB (budget 190 kB).
`.github/workflows/ci.yml` is the spec's YAML byte-for-byte (`sed -n 3063,3122p docs/SPEC.md`);
it is listed in `.prettierignore` because Prettier's YAML parser rejects its flow-style mappings.
`.env.example` documents every variable.

**Docs** — `README.md` (what it is, features, every env var, dev / relay / Docker / Vercel
deploy, the Discord app + Activity setup incl. the _Use Activities_ note and the `/relay` mapping,
rebranding via `src/config/site.ts`, the kick trust model), `CONTRIBUTING.md`,
`docs/architecture.md`, `docs/accessibility.md` (§7.4 as a checklist), `docs/reports/README.md`.

**E2E specs (written, not run in Phase 1)** — `tests/e2e/home.spec.ts` (hero text, CTAs, console
errors, LCP/CLS annotations with the 4000 ms / 0.25 hard limits, OG route PNG, FAQ toggles, code
field → `/room/ABC234` and `/demo`, rejoin card, no horizontal scroll), `seo.spec.ts`
(sitemap, robots, manifest, canonicals, noindex, JSON-LD, `og:image:alt`), `a11y.spec.ts`
(structural audit on 16 routes, skip link, visible focus on every focusable element).

**Config** — `next.config.ts`: `agentRules: false` (Next 16's `next dev` otherwise appends a
block to `CLAUDE.md`, a file nobody owns during the build) and
`allowedDevOrigins: ["127.0.0.1", "localhost"]` (without it, `next dev` refuses hydration when
the page is opened via the other loopback spelling — every builder's Playwright scripts hit
this). Inputs no longer set `outline-none`: the global 2 px accent `:focus-visible` outline shows
on `Input`, `Textarea`, `CodeInput` cells and the code field (the a11y spec asserts it).

**Gates (in the worktree)** — `prettier --check .` ✓ · `npm run lint` ✓ · `npm run typecheck` ✓ ·
`npm run test` ✓ (8 files, 28 tests) · `npm run build` ✓ · `node scripts/check-bundle.mjs` ✓.
Visual QA at 1440 × 900 and 390 × 844 for `/`, `/add`, `/terms`, `/privacy` and the 404; no
horizontal scroll at either width; structural a11y audit and focus-ring check clean on all five.

## Deviations

1. **No `motion` runtime on the marketing pages.** §2.4 names `useReducedMotion()` from
   `motion/react` and §7.3 allows `motion` via `LazyMotion`. Measured: even `m` + `LazyMotion`
   (features lazy) added **41 kB gzipped** to the home page's first load (194.2 kB, over the
   190 kB budget) because `motion/react` re-exports the whole of framer-motion and the core
   (projection, drag, layout) is not tree-shaken by Turbopack. The rise vocabulary is instead
   CSS (`[data-rise]` rules in `globals.css`, same duration / easing / offset / stagger) flipped
   by a 20-line `IntersectionObserver` in `<Rise>`. Reduced motion → opacity only (and the
   existing global reduced-motion rule makes it instant); `@media (scripting: none)` and a
   `<noscript>` style keep everything visible without JavaScript. Result: `/` at 153.2 kB. If
   the lead prefers the runtime, the budget needs to move to ≥ 200 kB.
2. **Hero H1 size at `lg`.** With the 5fr / 7fr split, `display-1` (100 px at 1440) put the
   headline on six lines in a 480 px column. At `lg` and up the H1 uses
   `clamp(3.5rem, 5vw, 4.75rem)` (72 px at 1440 → four lines); below `lg` it is `display-1` as
   specified (44 px at 390).
3. **`HeroFrameShell` renders the "take over" overlay and the focusable frame.** §3.13 says
   `HeroPlayer` also has a _Take over_ overlay link. In Phase 2, whoever wires `HeroFrame` in
   should drop one of the two (my shell's is one prop away from removal).
4. **`a11y.spec.ts` carries its own audit function** rather than importing WP3's
   `src/lib/a11y/audit.ts`, so the spec typechecks in this worktree. The function implements the
   §7.2 #10 list exactly; switching to `auditPage()` in Phase 2 is a two-line change.
5. **`.prettierignore` gains `.github/workflows/ci.yml`** (verbatim spec YAML; see above).
6. **`Input` / `Textarea` / `CodeInput` keep the global focus outline** instead of
   `outline-none` + border colour only — a border-colour change alone failed the "visible focus
   ring" assertion and is weak for keyboard users.

## Requests to other packages

- **WP3** (`src/components/map/HeroFrame.tsx`, `HeroStatic.tsx`): the home page will render
  `<HeroFrameShell><HeroFrame><HeroStatic /></HeroFrame></HeroFrameShell>`; the map slot is an
  absolutely positioned box below a 32 px top bar (`relative min-h-0 flex-1 bg-bg-0`), so
  `HeroStatic` should fill its parent (`absolute inset-0` or `h-full w-full`) rather than set
  its own aspect ratio. Please render `data-bundle="wd:hero"` on `HeroPlayer`'s root so
  `scripts/check-bundle.mjs` can measure it.
- **WP1** (`src/lib/room/code.ts`, `src/lib/storage/rooms.ts`): no changes; the stub mirrors the
  §5.3 / §5.4 signatures. Note `forgetRoom(code)` is what the Rejoin card calls (spec §5.4 lists
  `forgetRoom` under the room API) — keep it exported from `rooms.ts` or say where it lives.
- **WP3** (`src/lib/a11y/audit.ts`): export `auditPage(): Issue[]` with `Issue` serialisable
  (string or `{ kind, target }`) so `page.evaluate` can return it.
- **WP2** (`src/app/opengraph-image.tsx`, `twitter-image.tsx`): the root metadata already points
  at `/opengraph-image` and `/twitter-image`; `home.spec` asserts 200 `image/png`.
- **WP5** (`DocsShell`): the docs pages should export `alternates.canonical` and emit
  `TechArticle` + `BreadcrumbList` JSON-LD through `@/components/site/json-ld` (`<JsonLd data>`).

## Not done

- **Hero map.** The tier-3 frame holds a `Skeleton` until WP3's `HeroFrame` / `HeroStatic` merge
  (Phase 2). The LCP element is therefore not yet the terrain image; `home.spec` records the LCP
  element as an annotation and only enforces the hard limits.
- **E2E not executed** (Phase 1 rule); the `webServer` relay entry needs WP1's `server/relay.ts`
  and `a11y.spec` visits routes other packages own, so the specs are exercised on the integrated
  build.
- **Bundle check for the lazy bundles** reports "not present in this build" until the
  `data-bundle` markers land (WP3 / WP4).

## Phase 2 (integration fixes)

Worktree `wp/site` merged `claude/wardogs-clone-improvement-agc9oe` (fast-forward; WP1, WP2, WP4,
WP5 in the tree; WP3 not yet). Gates in the worktree: `npm run lint`, `npm run typecheck`,
`npm run test` (55 files / 325 tests), `npm run build`, `node scripts/check-bundle.mjs`.

### Done

- **Rise reveal is no longer script-dependent.** `src/components/site/motion.tsx` renders every
  `[data-rise]` element as `in` (visible) on the server. At hydration only elements whose top is
  below `innerHeight` are switched to `pending` and observed (`rootMargin -10%`, once); a 1.5 s
  safety timer (`RISE_SAFETY_MS`) reveals them regardless, and the effect's cleanup restores `in`.
  Reduced motion never enters `pending` (CSS: 120 ms opacity only if it somehow did); `@media
print` forces visible. `globals.css` hides only `[data-rise="pending"]`; the `<noscript>` style
  on the home page is gone (nothing to undo). Verified on the integrated build with
  `scrollshoot.mjs`: `riseTotal 9 / riseHidden 0` at 1440 and 390 after scrolling, and a plain
  full-page screenshot without scrolling shows every section (all nine `in` after 2 s).
- **WP1 modules replace the stub.** `code-field.tsx`, `logic.ts`, `RecentRooms.tsx` and
  `logic.test.ts` import `@/lib/room/code` (`normalizeCode`, `isRoomCode`, `isReservedCode`) and
  `@/lib/storage/rooms` (`listRecentRooms`, `forgetRoom`; `RecentRoom` from `@/lib/map/types`).
  `src/components/home/room-api.stub.ts` is deleted. The home fixtures (`Lonestar` /
  `zestafona` / `default` / `commander`) pass WP1's stricter guard.
- **e2e fixes.** `home.spec`: the bad-code assertion targets `#hero-code-error` (role=alert +
  `aria-describedby`) instead of `getByRole("alert")`, which also matched Next's route announcer.
  `seo.spec`: `siteUrl` follows `PORT` like `playwright.config.ts`; the canonical check compares
  URLs (Next emits the root canonical without a trailing slash); the noindex check reads every
  `meta[name=robots]` and requires each to say `noindex` (Next adds its own on not-found; the
  §6.1 metadata one stays). `a11y.spec`: the audit waits for `load` instead of `networkidle`
  (link prefetches to routes that are not built yet never settle). `src/lib/a11y/audit.ts` is
  not in the tree yet, so the inline `auditInPage` stays.
- **README** relay section now carries WP1's requested text (`npm run dev:relay` /
  `docker compose up relay`, `RELAY_PORT` fallback, `RELAY_MAX_ROOMS`, `RELAY_IDLE_HOURS`,
  `RELAY_ALLOWED_ORIGINS`, `/healthz`, the `wardogs:relay` localStorage override and `"off"`).
- Other WP6-targeted requests checked: `.prettierignore` already lists every verbatim contract
  file (`src/lib/geo.ts` is prettier-clean, so not needed); `next.config.ts` already has
  `allowedDevOrigins: ["127.0.0.1", "localhost"]`; `sitemap.ts` already lists the docs routes;
  the root OG routes exist. WP5's optional `#site-before-header` slot was not added (not needed
  for the current layout, per their note).
- Hero: `HeroFrameShell` keeps the `Skeleton` placeholder; the slot (`relative min-h-0 flex-1`)
  fills the frame and takes `<HeroFrame><HeroStatic/></HeroFrame>` unchanged once WP3 lands.
- Bundle: `/` first-load 153.7 kB gz (budget 190 kB; Phase 1 was 156.9 kB). Recorded as
  `phase2` in `scripts/bundle-baseline.json`.
- e2e on the integrated build (`PORT=3106`, relay on 8787 started by the config):
  `seo.spec` + `a11y.spec` 50/50 passed; `home.spec` 10/12 passed.

### Not done / blocked

- `home.spec` "hero copy, CTAs and no console errors" fails on the integrated build (desktop and
  mobile) with three `404` console errors: Next prefetches the hero links `/demo`, `/create`,
  `/join`, and those routes are WP3's and not merged yet. The assertion is correct and left
  strict; it passes once WP3's `(app)` routes exist. (The same missing routes are why
  `networkidle` never settles.)
- `/dev` is over the `(site)` first-load budget: 248.1 kB vs 190 kB (WP5's page). Not WP6's
  file; see requests.
- Visual QA at 1440 and 390 (`/`, `/add`, `/terms`, 404): no overflow (the reported wide
  `path`s are inside the clipped `ContourBackdrop` SVG; `scrollWidth == clientWidth`), nothing
  to polish.

### Requests to other packages

- **WP3**: land `/demo`, `/create`, `/join` (and `/room/[code]`) — the home hero links and
  `home.spec`'s console-error assertion depend on them. `HeroFrameShell`'s child slot is ready
  for `<HeroFrame><HeroStatic/></HeroFrame>`.
- **WP5 (`src/app/(site)/dev/page.tsx`)**: first-load JS is 248.1 kB against the 190 kB site
  budget (`node scripts/check-bundle.mjs` reports `OVER`); the other `(site)` routes sit at
  154–158 kB, so roughly 90 kB of client code is entering through that page — a `dynamic()`
  import for the heavy client piece should bring it back.

## Phase 3 (integrated build, all six packages)

### Done

- **Real hero wired** (`src/components/home/hero.tsx`, `hero-frame-shell.tsx`): the frame holds
  `<HeroFrame><HeroStatic /></HeroFrame>` (§4.1, §3.13). The shell is now a server component and
  draws no chrome of its own: `HeroStatic` / `HeroPlayer` bring the 32 px top bar (mark,
  `WAR ROOM DEMO`, LIVE pip), `HeroFrame` owns the focusable wrapper (`role="group"`,
  `tabindex=0`, Enter → `/demo`) and `HeroPlayer` the one _take over_ overlay — the Phase 1
  duplicates (shell top bar, shell overlay, shell `tabindex`) are gone. `hud-corners` moved to
  an overlay above the map (its `::before` paints under positioned children); the shell draws the
  focus ring on itself (`has-[:focus-visible]:outline-*`) because the frame's own outline sits
  outside its box and is clipped by `overflow-hidden`. Verified on the built page: the terrain
  `<img>` is server-rendered with `fetchpriority="high" loading="eager"` and the finished plan's
  markers are in the HTML (the LCP element), the frame's bounding box is identical before and
  after the player swaps in at 1440 and 390 (no CLS), exactly one _take over_ link, no console
  errors, `wd:hero` now measured (30.8 kB of 60 kB; 6.9 kB entry + the 23.8 kB shared scene
  chunk).
- `tests/e2e/a11y.spec.ts` imports WP3's `auditPage` (`src/lib/a11y/audit`) — same routes, same
  assertion.
- `tests/e2e/og.spec.ts` reads `<meta property="og:image">` off `/`, `/demo`, `/dev`,
  `/demo/admin`, `/room/ABC123`, `/create`, `/join` and asserts that URL is a 200 `image/png`
  with IHDR 1200 × 630; the root `/opengraph-image` and `/twitter-image` keep their fixed URLs.
- `scripts/check-bundle.mjs`: `wd:validator` (100 kB) added; lazy bundles now also count the
  sibling chunks Turbopack names beside the entry in the parent's async loader list
  (`Promise.all(["static/chunks/…", …].map(l))`), minus chunks the loading page already has in
  its first-load scripts; the largest cost across parents is reported. `bundle-baseline.json`
  gains `phase3`.
- `docs/reports/map-ui.md` fails `prettier --check` on the integrated branch; it is WP3's file and
  is left alone. `.prettierignore` needs no change (reports are meant to be formatted — the fix is
  `npx prettier --write docs/reports/map-ui.md` in the map-ui worktree).

### Findings the truer lazy measure exposes (not mine to fix)

- `/create` 256.2 kB and `/join` 251.3 kB (budget 200 kB), `wd:map-app` 177.8 kB (140 kB) and
  `wd:console` 119.1 kB (90 kB): all four carry the same 87.3 kB gzip chunk
  (`2t_38bmbv53l6.js` in this build — `zod`), so `zod` is reachable from the `/create` and
  `/join` shells and from `MapApp` and `ApiConsole`. `check-bundle` is red until that import is
  moved behind a lazy boundary or replaced by hand-written guards (§7.3).
- `/demo` and `/room/[code]` render no `h1` (a11y audit `h1-count`, desktop and mobile). A
  visually hidden `<h1>` (`War room DEMO` / `War room ABC234`) in `AppShell` / `TopBar` — and in
  `MapAppLoader`'s server-rendered fallback so the pre-hydration audit passes — fixes it.
- `HeroPlayer`'s _take over_ overlay spans most of the 340 px frame at 390 (mono uppercase with
  tracking); a shorter mobile label or `sm:` sizing in `HeroPlayer.tsx` would free the map. The
  hero's LIVE pip is the §4.1 chrome (a live preview of the replay), unchanged.

### E2E on this build (`PORT=3106`, desktop + mobile)

`home.spec`, `seo.spec`, `a11y.spec`, `og.spec`: 86 passed, 4 failed — the four failures are the
`h1-count` audit on `/demo` and `/room/ABC234` (desktop and mobile) noted above; every `home`,
`seo` and `og` test passes on both projects.

## Review fixes

Branch `wp/site` on top of the integrated branch. Every finding below was reproduced by the
adversarial review; the fixes are root-cause, with a unit or e2e regression test where one fits.

### Blocker

- **DES-01** — the mobile menu opened to a 1 px strip because `backdrop-filter` on the sticky
  `<header>` made it the containing block for its `position: fixed` child. The blur now lives on
  a `before:` layer and `#mobile-nav` is rendered as a sibling of `<header>`, so no header style
  can capture it again. Proven at 390 × 844: `#mobile-nav` is 390 × 788 (was 390 × 1), header
  `backdrop-filter: none`, five 52–56 px rows and the primary CTA at the bottom.

### Design

- **DES-04** — `hud-corners` moved to an outer unclipped box around the rounded
  `overflow-hidden` shell; at 3× the ticks are full 10 px Ls again.
- **DES-10** — shell is `aspect-[4/3] lg:aspect-[16/10]` (342 × 256 at 390). The _take over_
  overlay still spans the frame's bottom band: it is `HeroPlayer.tsx` (map package), see
  cross-cutting.
- **DES-08** — `Toaster` takes `position: "bottom-right" | "top"` and is mounted per route group:
  `(site)` bottom-right, `(app)` and `(admin)` `position="top"` (top centre under the 44–48 px
  top bar, §4.3.8). Verified on `/activity` at 1440 × 900: the fallback toast sits under the top
  bar; _Controls & help_ and the zoom stack are clear. `toast.test.tsx` covers placement, queue,
  action, dismiss and the live-region announce.
- **DES-11** — `ContourBackdrop` on `/terms`, `/privacy` and `/add` is bounded to 420 px and
  masked out from 50 %, so the rings sit behind the title block only.
- **DES-19** — `CodeField` gains `layout="inline"` (label, input and submit share one 40 px row
  from `lg`) and sits in the secondary-button row with `flex-wrap`. The 5/12 column at 1440 is
  ~460 px, so _Open_ + _Join_ + the form cannot share one line; the form now takes one compact
  row directly under the buttons (two rows before), and slides beside _Join_ when the column is
  wide enough.
- **PF-11** — with no Discord client id the header CTA is _Try the live demo_ → `/demo`
  (desktop, compact mobile and the menu's primary), mirroring the hero.

### Accessibility

- **A11Y-05** — `Button` `sm` / `icon` / `chip` and `Tabs` `sm` carry `pointer-coarse:min-h-10`
  (`min-w-10` for icons); `min-*` survives the `h-8 w-8` overrides in the request panel, so those
  rows are 40 px on touch. The raw `h-8` spans in `TopBar.tsx` and the 45 × 20 grid-ref button
  are map files — cross-cutting.
- **A11Y-06** — Badge `danger` tone uses `text-danger-text` (6.1:1 at 11 px); the pulse stays
  (spec-mandated).
- **A11Y-09** — the `(app)` layout's skip link is _Skip to content_ → `#main`; `/create` and
  `/join` have no map. A _Skip to map_ belongs to the map app once the map exists.

### Performance / SEO

- **PS-3 / Q14** — `src/lib/zod-locales-stub.ts` replaces zod's `v4/locales/index.js` barrel
  through `turbopack.resolveAlias` (the entries import it relatively, so the alias key is the
  relative request). Measured: `wd:map-app` 177.8 → 142.6 kB, `wd:console` 119.1 → 83.9 kB,
  `/create` 256.2 → 173.7 kB, `/join` 251.3 → 167.9 kB. `LAZY_BUDGETS` are now 150 / 60 / 90 /
  90 / 100 kB — `wd:map-app` is 2.6 kB over the §7.3 figure, so its budget holds the
  measurement plus ~5 % rather than the spec's 140; `bundle-baseline.json` records the enforced
  budgets and a `current` block. zod still installs English at runtime (`schemas.js` imports
  `../locales/en.js` directly).
- **Q1 / PS-2** — the three JetBrains Mono files were byte-copies of Google's _variable_ font
  (fvar/gvar); one `src` entry with `weight: "400 700"` and `preload: false` (§7.3). Saira
  600/700 never rendered (`display` is 800) and are gone. Preloads on `/`: 10 files / 237 kB →
  5 files (Barlow ×4, Saira 800). `src/app/fonts/fonts.test.ts` asserts distinct hashes, that
  every shipped file is declared, the variable axes and the preload flag.
- **PS-1** — the root layout keeps only `openGraph.{type,siteName,images}` and
  `twitter.card`; every page's `og:title` / `og:description` / `twitter:title` now follow the
  page (verified on `/dev`, `/terms`, `/demo`, `/room/ABCDEF`, `/activity`,
  `/demo/admin/live`). `og:url` is emitted only where a page sets it (`/demo`), never the home
  URL. `twitter:image` still resolves to the root file-based `twitter-image.tsx` on nested
  routes — that is Next's file convention, see cross-cutting.
- **PS-7** — no root `alternates.canonical`; `/room/*`, `/activity` and the dashboard tabs emit
  none (`/add` keeps its own). `seo.spec` asserts a noindex page's canonical is absent or itself.
- **PS-10** — the spec's `Disallow` lines stay (§6.3); `next.config.ts` adds
  `X-Robots-Tag: noindex, nofollow` on `/room/:path*`, `/activity`, `/add` and
  `/demo/admin/:tab(live|rotation|history|bans|audit)`, honoured without fetching the body.
- **Q5** — `next.config.test.ts` (vitest, root) covers `securityHeaders` for all three kinds,
  the relay origin in `connect-src`, no CSP outside production, `headers()` routing and the
  `X-Robots-Tag` sources. It sits at the repo root, so `vitest.config.ts` needs
  `"next.config.test.ts"` added to `test.include` (cross-cutting; verified here with a scratch
  config).

### Quality

- **Q2** — `.gitignore` un-ignores `.env.example`; the file lists every variable the code reads;
  README gains `RELAY_MAX_ROOMS` / `RELAY_IDLE_HOURS`.
- **Q3 / Q15** — already on the integrated branch (`.dockerignore` exists; `.prettierignore` no
  longer claims ci.yml is byte-exact).
- **Q4 / Q18** — `sheet.test.tsx` (modal dialog, focus in, Tab trap both ways, Escape + focus
  return, backdrop click; non-modal region), `copy-button.test.tsx` (success + announce, missing
  API, refused write), `toast.test.tsx`; `accessibility.md` names what exists. `peer.ts`,
  `emitter.ts`, `tooltip.tsx` remain untested (cross-cutting for the first two).
- **Q7** — `a11y.spec` audits `/activity` and all five dashboard tabs; the focus-ring test runs
  on `/room/ABC234` (seeded identity, map chunk awaited) and `/`, including `[role="option"]`,
  after one real key press so Chromium's `:focus-visible` heuristic is in keyboard mode. A fresh
  room renders the join gate, so the map SVG is only reachable on `/demo` — and there it shows
  no ring: `MapSurface.tsx` pairs `outline-none` (which sets `--tw-outline-style: none`) with
  `focus-visible:outline-2`, which reuses that variable, so the used outline width is 0. One
  class (`focus-visible:outline-solid`) fixes it; `/demo` joins the loop then (cross-cutting).
- **Q9** — `src/lib/format/time.ts` `timeAgo` (floor, 24 h → `N days ago`) is the one Rejoin
  formatter; `home/RecentRooms` reads `KEY_ROOMS` and its `now` bucket rounds up so floor never
  under-reports; `map/forms/RecentRooms` is a wrapper passing `mapById` names.
  `map/lib/format.ts` still has its own `timeAgo` (used by `CreateForm`) — cross-cutting.
- **Q12** — `clamp` / `formatDuration` removed from `src/lib/utils.ts`.
- **Q13** — `src/lib/clipboard.ts` `copyText`, used by `CopyButton` and re-exported from
  `map/lib/download.ts`.
- **Q16 / Q19** — docs match reality (no coverage provider; dependency rule as in `CLAUDE.md`).
- **Q17** — the relay job polls `/healthz` for 15 s and prints `docker logs relay` on failure.

### Gates

`prettier --check`, `eslint`, `tsc`, `vitest` (74 files / 407 tests), `next build`,
`check-bundle` (all within budget) and `home`, `seo`, `a11y`, `og` on desktop + mobile
(`PORT=3106`): 106 passed, 0 failed.

### Cross-cutting (exact changes, outside this package's paths)

- `src/components/map/HeroPlayer.tsx:162` — the _take over_ link: add
  `max-lg:h-7 max-lg:px-2 max-lg:text-[10px]` and render the label as
  `<span className="lg:hidden">Take over →</span><span className="max-lg:hidden">This is the real app — take over →</span>`
  (DES-10).
- `src/components/map/MapSurface.tsx:914` — add `focus-visible:outline-solid` next to
  `focus-visible:outline-2`, then add `"/demo"` to the focus-ring loop in `tests/e2e/a11y.spec.ts`
  (Q7).
- `src/components/map/TopBar.tsx:112,137,164` — the raw `h-8` room-code / callsign / sync spans
  need `pointer-coarse:min-h-10` (and `pointer-coarse:min-w-10` on the 28 px copy glyph);
  `src/components/map/RequestsPanel.tsx:292-299` — the 45 × 20 grid-ref button needs
  `pointer-coarse:min-h-10` (A11Y-05).
- `src/components/map/lib/format.ts:73-82` — replace `timeAgo`'s body with
  `export { timeAgo } from "@/lib/format/time";` (identical semantics; `CreateForm.tsx` keeps its
  import) (Q9).
- `vitest.config.ts` — `include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts", "next.config.test.ts"]`
  so the root `next.config.test.ts` runs in `npm run test` (Q5).
- `src/app/twitter-image.tsx` — file-based root Twitter image is injected on every nested route,
  so `/demo`, `/create`, `/join`, `/demo/admin` still get `/twitter-image` as `twitter:image`
  although they have their own `opengraph-image`. Either add `twitter: { images: ["…"] }` in those
  four pages' metadata or drop the root file (Twitter falls back to `og:image`) and update
  `tests/e2e/og.spec.ts` `ROOT_IMAGES` (PS-1, remaining part).
- `src/lib/realtime/peer.ts`, `src/lib/realtime/emitter.ts` — untested timing / emitter
  behaviour (Q18) is realtime-package work.
