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
