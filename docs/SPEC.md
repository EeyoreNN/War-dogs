# wardogs.tech clone — BUILD SPEC (authoritative)

Version 1.1 · 2026-09-11 · Lead architect spec, revised after the critic's review (change list in
Appendix E). Builders work from this document only.
Repo: `/home/user/War-dogs` (Next 16 App Router, React 19, Tailwind v4, TypeScript strict).
Read `CLAUDE.md` first; it is binding. Where this spec and `CLAUDE.md` disagree, this spec wins,
except for the dependency rule: **no new npm dependencies**.

---

## 0. How to read this spec

- Sections 1–2 say what we are building and how it must look.
- Section 3 is the set of **shared contracts**. The TypeScript in section 3 is final. Copy it
  verbatim. Do not rename, reorder or "improve" a contract; if you believe one is wrong, finish
  your package against it and state the proposed change in your report.
- Section 4 is the page-by-page spec, including the actual copy. Use the copy as written.
- Sections 5–7 are realtime/persistence, SEO and the quality bar. They are not optional.
- Section 8 partitions the work into six packages with **owned paths**, each built in its own git
  worktree (§8.1). You only create or edit files inside your package's owned paths, plus the
  verbatim contract files under the create-if-missing rule (§3.0). Anything else is requested
  through your report.
- "Upstream" means https://wardogs.tech as captured on 2026-09-10 (v0.27). We reproduce its
  product, IA, brand and voice; we do not reproduce its code, its map art or its screenshots.

Terminology: **war room** = a shared map identified by a six-character code. **Node** = anything
drawn on the map (stroke, shape, marker, text, measurement). **Op** = one replayable state change.
**Relay** = the optional WebSocket server in `server/`. **LOCAL mode** = no relay configured; sync
is same-browser only via BroadcastChannel. **ClientId** = the per-browser identity key: one
person, one browser, one roster member; every tab of that browser shares it (§3.3). **Entity rev /
field rev** = the last-writer-wins revision kept per entity (add/remove) and per patched field (§3.4).

Hard constraints (from the brief; non-negotiable):

1. Same product, same information architecture, same brand identity as upstream.
2. No database, no hosted auth. Everything works with a typed callsign and `npm run dev` alone.
   Discord sign-in/install is an env-configured integration with graceful fallback.
3. No copyrighted game art, no upstream screenshots. Maps are procedurally generated in-app,
   plus commander image upload.
4. Deploys to Vercel; relay deploys separately (Docker). `npm run build`, `npm run typecheck`,
   `npm run lint`, `npm run test`, `npm run e2e` all pass.
5. Installed dependencies only (see `package.json`).
6. No new pages that dilute the product.

---

## 1. Product summary — and what "better than upstream" means here

**wardogs.tech** is a fan-made, unofficial companion for *Wardogs* (Bulkhead / Team17): a
100-player, three-team (Lonestar, Valkyra, Manticore) tactical FPS with King-of-the-Hill control
zones on three maps (Zestafona, Bakurani, Ozeti). The product is a **shared tactical map that
opens inside a Discord voice channel**: everyone in the call draws on the same map, drops markers,
raises supply requests and sees the roster. Around it sit a live demo, a war-room create/join
flow, a proof-of-concept server-admin dashboard, and a dev hub for people who run dedicated
servers (RCON reference, API console, OpenAPI spec, config template, Discord troubleshooting,
map guide), plus Terms and Privacy.

Upstream's weaknesses, verified from the captures: `/demo` renders a black frame until a
backend connects (screenshots are empty, mobile is black); `/create` ships broken map
thumbnails; the LIVE pill is a static decoration; there is no mobile layout for the map; the
"click around" admin preview is a static card; the API console needs a real RCON host; the dev
hub drops to a fallback font; requests carry no location, urgency or timing; there is no ping,
no grid reference, no export; and the whole app is a single opaque client bundle.

**"Better" is defined as all of the following, and nothing that is not on this list:**

| Better means | Concretely |
|---|---|
| Everything on the landing page is true in the browser | The hero is the real map replaying a plan (no screenshot). The demo is live and populated the instant it loads, with simulated squadmates acting on a shared timer. Rooms persist across refresh and sync across tabs (LOCAL) or devices (relay). The admin preview is a working, deterministic server simulator. The API console works with zero backend by targeting that simulator. |
| Honest sync | A three-state sync pill: `LIVE · n in room` (relay), `LOCAL · this browser` (no relay), `RECONNECTING…` (relay dropped). Never a fake LIVE. |
| More useful in a voice call | Ping (double-click), grid references (A–J / 1–10, keypad sub-cells), measure with distance + bearing, requests pinned to the map with age timers / urgency / ETA, roster with focus tallies and draw-permission requests, brief (read-only) mode, export PNG / copy plan as text / save-load plan. |
| Faster | Server-rendered shells for every route (real LCP element, no blank frame), the map bundle dynamically imported only on app routes, terrain cached as ImageBitmap, SVG node layers with one transform group, pointer events with coalescing. Budgets in §7.3. |
| Phone beside the PC | Under 768 px the map fills the viewport, tools move to a bottom bar, panels become a bottom sheet, Ping and Request are thumb-reachable FABs. |
| Accessible | Keyboard path for every pointer interaction, roving toolbars, `role="application"` map with a focusable node list, one polite live region, native `<dialog>` focus management, 4.5:1 text contrast asserted in a unit test, reduced-motion respected everywhere. |
| SEO-complete | Per-route metadata, generated OG images from the procedural terrain, sitemap, robots, JSON-LD, canonical URLs, noindex on room/activity routes. |
| Well-tested | Pure engine (op-log reducer, terrain, simulator, OpenAPI parser, ini validator) with ≥ 90 % line coverage; component tests for panels; Playwright journeys on desktop and Pixel 7 including two-tab convergence in LOCAL mode and two-browser convergence through the relay. |
| Sharper design | Same amber-on-charcoal identity, tightened type scale and rhythm, one disciplined texture system (masked grid, contours, HUD corner ticks), a card tier system, a small motion vocabulary, a refined original logo mark. |

Explicitly **dropped** from the proposals (with reasons) — do not build these:

- *Phases (Setup · Push · Hold layers)* — valuable, but it doubles the layer UI on top of squad
  layers in one build pass. The node model carries `layer`, so phases can be added later as
  `phase:` layers without a schema change.
- *Chamfered clip-path buttons* — the clip drops the focus ring outside the shape; a11y cost for
  a cosmetic gain. Signature comes from `hud-corners` on live surfaces instead.
- *Nonce-based CSP via proxy.ts* — a mis-plumbed nonce blanks the whole site. We ship a
  conservative header CSP without nonces (§7.6).
- *Web-vitals beacon route, perf HUD* — an API route with no consumer. E2E asserts LCP/CLS instead.
- *Room-code OG images* — codes are secrets ("never share your war room code"). Room OG is generic.
- *Kick with relay-side 10-minute rejoin block* — no identity to enforce it against; kick removes
  the roster entry and, in relay mode, the relay drops that socket. Documented as such.
- *Landing "stats band"* — dropped entirely, including build-time-true trivia such as
  `Sign-in needed 0`; that is filler by another name.
- *Relay-shared admin-simulator commands* — in v1 the simulator's command log is shared across
  tabs of one browser only (§4.8). Putting it on the relay needs a new wire kind and a second
  reducer on the relay; not worth it for a proof of concept.
- *Per-tab client ids* — one browser is one roster member (§3.3). A second tab is the same
  person, not a ghost squadmate; the relay e2e uses two browser contexts instead (§7.2).

---

## 2. Design system

All tokens live in `src/app/globals.css`. Use utilities, never raw hex. Existing tokens (do not
rename): surfaces `bg-bg-0 bg-bg-1 bg-bg-2 bg-bg-3` (`bg-bg` = bg-0, `bg-panel` = bg-1), lines
`border-line border-line-strong border-line-hi`, text `text-fg text-fg-muted text-fg-faint`,
brand `accent accent-hover accent-active accent-ink accent-soft`, semantic `ok danger warn info`,
game `friendly enemy-a enemy-b lz rally objective lonestar valkyra manticore req-open
req-claimed req-delivered`, radii `rounded-sm/md/lg/xl` (4/6/8/12), `shadow-panel`, animations
`animate-pulse-slow animate-blink animate-rise`, utilities `display eyebrow label-mono bg-grid
panel scrollbar-thin`. Fonts: `font-display` (Saira Condensed), `font-sans` (Barlow),
`font-mono` (JetBrains Mono) — self-hosted via `next/font/local` in `layout.tsx`.

### 2.1 Type scale (WP6 adds these to `:root` and as utilities)

```css
:root {
  --t-display-1: clamp(2.75rem, 7vw, 6.5rem);   /* hero H1; 44 px at 390 */
  --t-display-2: clamp(2.25rem, 4.5vw, 3.75rem); /* page titles */
  --t-display-3: 1.75rem;                        /* card titles */
  --t-display-4: 1.25rem;                        /* panel headers in the app */
  --t-lede: 1.125rem;                            /* 18px / 1.55 */
  --t-body: 1rem;                                /* 16px / 1.6 */
  --t-small: 0.875rem;                           /* 14px / 1.5 */
  --t-mono-data: 0.75rem;                        /* 12px / 1, tabular-nums */
}
@utility display-1 { font-size: var(--t-display-1); line-height: 0.9; letter-spacing: -0.01em; }
@utility display-2 { font-size: var(--t-display-2); line-height: 0.92; letter-spacing: -0.01em; }
@utility display-3 { font-size: var(--t-display-3); line-height: 0.95; letter-spacing: 0; }
@utility display-4 { font-size: var(--t-display-4); line-height: 1; letter-spacing: 0; }
@utility lede { font-size: var(--t-lede); line-height: 1.55; color: var(--text-1); }
@utility mono-data { font-family: var(--font-mono); font-size: var(--t-mono-data); line-height: 1; font-variant-numeric: tabular-nums; }
```

Rules: `display` + `display-N` together (e.g. `class="display display-2"`). Body 16/1.6 Barlow
400; lede 18/1.55 `text-fg-muted`; small 14/1.5; mono data 12 tabular. Display letter-spacing
−0.01em above 48 px, 0 below. Prose measure on docs 68ch. Never override `font-family` in any
route; `/dev` and its pages use the same stack as the rest of the site (fixes the upstream
fallback-font break). Text that conveys state is never smaller than 11 px.

### 2.2 Spacing rhythm

- Sections: `padding-block: clamp(4rem, 8vw, 7rem)`. Eyebrow → heading 12 px; heading → body
  16 px; body → CTA 32 px. Grids gap 24 px (16 px on phones).
- `Container` (WP6 edits): `max-w-[1280px] px-6 sm:px-10 lg:px-16` (24 / 40 / 64 px gutters).
- Cards: padding 24 px (`p-6`), 28 px on `lg` for tier-3.
- App chrome is on an 8 px grid: top bar 48, rail 80 (tool buttons 40 in one column; ink
  swatches 20 px visual inside 40 px hit areas in a 3×2 grid; marker tiles 36 px in two columns),
  panel column 320, request card min-height 64, roster row 40, zoom-stack buttons 40, mobile
  bottom bar 56, FABs 48. Minimum touch target 40 px (a 20 px swatch sits centred in its 40 px
  button); 44 px for anything on the mobile bottom bar / FABs.

### 2.3 Colour usage rules

- Amber (`accent`) is for: primary CTAs, eyebrows, active tool, selected chips, the commander
  badge, control-zone rings, focus rings. Never for body text. Amber-on-amber-soft chips must
  use `text-accent` on `bg-accent-soft` only at ≥ 12 px mono uppercase.
- Team colours (`lonestar` blue, `valkyra` red, `manticore` green) mark **team identity only**:
  team pickers, the dot in the FRIENDLY palette header, scoreboard columns, roster dots in the
  admin. Never on a map marker: friendly markers are always `friendly` blue (upstream parity);
  the two enemy factions are `enemy-a` (orange) and `enemy-b` (pink) in the order the teams appear
  in `site.game.teams` with the room's own team removed (`enemyTeams(team)` in §3.4: Lonestar
  room → Valkyra = `enemy-a`, Manticore = `enemy-b`; Valkyra room → Lonestar = `enemy-a`,
  Manticore = `enemy-b`). So a Valkyra room never shows red friendlies beside orange enemies.
- Ink colours (`INK_HEX` in §3.3) are for map ink only. `friendly` and `info` share `#5fb8ff`;
  `info` is used only for POST method badges and info Badges, never near the map.
- Request state colours: `req-open` (text-0), `req-claimed` (accent), `req-delivered` (muted).
  Colour is never the only signal: state also appears as text and an icon.
- Semantic: `ok` = relay live dot, GET badges; `warn` = LOCAL pill, PUT badges, timers > 60 s;
  `danger` = destructive actions, DELETE badges, timers > 120 s, RECONNECTING pill.
- Discord blurple `#5865F2` appears only inside the Discord glyph, never as a fill for our
  buttons except the `discord` Button variant (sign-in / add buttons).
- Text contrast: `fg-muted` on `bg-1` ≥ 4.5:1 (it is 6.5:1); `fg-faint` (3.1:1) is decorative
  only (labels that repeat visible information, version tags) — the footer disclaimer uses
  `fg-muted`, not `fg-faint`. `danger` (#ff2e2e, 4.6:1 on bg-1) and `req-delivered` (#7e8a6c,
  4.65:1) are fills and ≥ 14 px text only; as small text (timers, `DELIVERED`, `URGENT`) use the
  text variants WP6 adds to `:root`/`@theme`: `--danger-text: #ff6b6b` (6.1:1 on bg-1) and
  `--req-delivered-text: #98a684` (6.6:1), exposed as `text-danger-text` / `text-req-delivered-text`.
  Terrain ground fill sits at relative luminance 0.15–0.19 (a mid charcoal-olive, far lighter
  than `bg-0` at 0.006) so both white and black ink reach ≥ 3.5:1 on the base fill (asserted in
  the `biomePalette` test, §7.1). Everything else is asserted in `src/lib/a11y/contrast.test.ts`.

### 2.4 Motion rules

One gate: `useReducedMotion()` from `motion/react` in marketing components; in the map app, CSS
transitions/animations only, and a `prefers-reduced-motion` media query already zeroes them in
`globals.css`. All durations ≤ 240 ms, easing `cubic-bezier(0.2, 0.7, 0.2, 1)`. Vocabulary:

1. **rise** — section entry, opacity 0→1 + translateY 12→0, staggered 60 ms, once, `viewport
   margin -10%`. Reduced: opacity only, 120 ms.
2. **pip** — LIVE dot `animate-pulse-slow`; the room-code chip flashes `bg-accent-soft` for
   600 ms on copy with the label swapping to COPIED for 2 s. Reduced: static ring.
3. **ink** — a committed stroke fades in over 120 ms; remote strokes reveal via
   `stroke-dashoffset` over 200 ms. Reduced: instant.
4. **claim** — request card left rule colour transitions 200 ms; button row slides 4 px.
5. **count** — admin score tiles tween numbers over 400 ms (tabular). Reduced: instant.
6. **drop** — marker placed: scale 0.6→1 plus a ring expanding to 24 px fading, 220 ms. Reduced: opacity.
7. **ping** — ring scales 0.4→1.6 and fades over 1.2 s, three cycles (4 s total). Reduced: a
   static ring with the callsign for 4 s.
8. **nav underline** — 1 px accent rule slides in under the active nav item, 160 ms.

No parallax, no scroll-jacking, no hover lifts above 2 px, nothing animates continuously except
the LIVE dot and active pings.

### 2.5 Texture rules (WP6 adds utilities)

```css
@utility bg-grid {          /* two-scale grid, replaces the old single-scale one */
  background-image:
    linear-gradient(to right, rgba(241,235,221,0.045) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(241,235,221,0.045) 1px, transparent 1px),
    linear-gradient(to right, rgba(241,235,221,0.018) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(241,235,221,0.018) 1px, transparent 1px);
  background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px;
}
@utility bg-grid-masked {   /* bg-grid that fades out from the top centre */
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%);
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%);
}
@utility hud-corners {      /* four 10 px L ticks, 1.5 px, accent at 60 %, drawn by one pseudo-element */
  position: relative;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    --tick: color-mix(in srgb, var(--accent) 60%, transparent);
    background-image:
      linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
      linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
      linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
      linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick));
    background-size: 10px 1.5px, 1.5px 10px, 10px 1.5px, 1.5px 10px, 10px 1.5px, 1.5px 10px, 10px 1.5px, 1.5px 10px;
    background-position: top left, top left, top right, top right, bottom left, bottom left, bottom right, bottom right;
    background-repeat: no-repeat;
  }
}
@utility vignette {         /* the (site) layout wrapper only; it has no other background image */
  background-image: radial-gradient(120% 80% at 50% -10%, rgba(255,160,40,0.06), transparent 60%);
}
@utility scanlines { background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px); }
```

Contours are **not** a CSS utility (CSS cannot import a TypeScript constant, and an empty
`@utility` block fails the Tailwind v4 build). `src/components/site/contour-backdrop.tsx` (WP6)
renders `<ContourBackdrop />`: an `aria-hidden`, `pointer-events-none`, absolutely positioned
inline `<svg viewBox="0 0 1200 800">` anchored top-right with 6–8 closed rings (`stroke`
accent at 7 % opacity, no fill, ≤ 2 kB of path data). The ring paths live in
`src/lib/brand/contours.ts` (`export const CONTOUR_PATHS: readonly string[]`) so the OG renderer
draws the same rings.

Rules: any single surface uses **at most two** textures. `<ContourBackdrop />` only behind the
home hero and page-title blocks. `hud-corners` only on the hero map frame, the admin live
server card, the war-room top bar and the create/join form panel. `scanlines` only inside the
LIVE pill. `vignette` on the `(site)` layout wrapper only, never on app routes. Never any
texture behind body text.

### 2.6 Component inventory

Existing primitives in `src/components/ui` (keep APIs, extend as listed; WP6 owns):

| Component | Keep | Add |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClasses` | variants `primary secondary ghost danger discord`, sizes `sm md lg` | variants `icon` (40×40, ghost; `active` → `bg-accent-soft text-accent` + 2 px left accent rule) and `chip` (h-8, mono 11 px 0.14em uppercase, `rounded-sm`; selected → `bg-accent text-accent-ink`); size `icon`; props `loading?: boolean` (label → three-dot mono pulse, width locked, `aria-busy`), `active?: boolean` (sets `aria-pressed`), `kbd?: string` (trailing `<Kbd>`); `focus-visible` on primary uses `outline-offset: 3px` plus `box-shadow: 0 0 0 1px var(--bg-0)`. md min-height 44 px on touch (`@media (pointer: coarse)`). |
| `Card`, `CardEyebrow`, `CardTitle`, `CardBody` | | `Card` prop `tier?: "panel" \| "link" \| "live"` (see 2.7); `LinkCard` (`href`, renders arrow top-right, whole card is the link). `CardTitle` uses `display display-3`. |
| `Container` | | max-width 1280, gutters 24/40/64. |
| `Badge` | tones | tone `team` with `team` prop (dot in team colour); text is 11 px mono (never 10 px — badges carry state). |
| `Input`, `Label` | | `Textarea`, `Field` (label + control + helper/error, wires `aria-describedby`/`aria-invalid`), `CodeInput` (six mono cells `flex-1 min-w-0 max-w-12`, §4.5). |
| `Logo`, `LogoMark`, `Wordmark` | API | new mark geometry (2.8). |
| `icons.tsx` | Discord, GitHub | nothing (marker glyphs live in `src/components/map/MarkerSprite.tsx`). |

New primitives (WP6 owns; exact APIs in §3.12): `Kbd`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`,
`CopyButton`, `Callout`, `Chip` (alias of Button variant chip for filter rows), `RadioCards`,
`Toaster` + `toast()`, `Spinner`, `Skeleton`, `VisuallyHidden`, `LiveRegion`.

### 2.7 Card tiers

- **Tier 1 panel** (`panel` utility): `bg-bg-1`, `border-line`, `rounded-lg`, inset top highlight.
  Content containers. No hover.
- **Tier 2 link card**: tier 1 + hover `border-line-hi bg-bg-2`, arrow icon translates 2 px
  up-right, a 2 px accent top rule scales 0→100 % width over 200 ms (`transform-origin: left`);
  `focus-within` identical to hover. Used for the home exit cards and the dev hub cards.
- **Tier 3 live card**: tier 1 + `hud-corners` + `shadow-panel` + `bg-bg-1/90 backdrop-blur`.
  Used for the hero map frame, the admin live server card, the create/join form panel.
- **Note block** (SHARED / HEALS ITSELF / NOT REAL): `border-l-2 border-accent pl-4`, no fill.
- **Callout**: `border-l-[3px]`, tone `note` (accent, `bg-accent-soft`), `warning` (warn),
  `danger` (danger); body 15 px.

### 2.8 Logo mark (WP6 replaces `LogoMark`, `public/icon.svg`, adds `src/app/apple-icon.tsx`)

Original artwork, distinct from upstream's gear-arrow and from any game iconography. 64-unit
grid: plate `rect x=4 y=4 w=56 h=56 rx=8 fill=var(--bg-1) stroke=var(--border-hi) 2`; chevron
`M16 40 L32 18 L48 40` stroke `var(--text-0)` 6, round caps/joins; a 10-unit-diameter accent
circle at (32, 40) with a 3-unit `bg-0` core (rally point in the notch); two 2-unit tick marks
at (12, 50) and (52, 50) in `text-2` (scale bar). Monochrome variant for favicon at 16/32: drop
ticks, chevron 7 units. Wordmark: `WARDOGS` + accent `.TECH`, tracking 0, chevron apex aligned to
cap height; header lockup 26 px mark + 20 px wordmark, 10 px gap. Ship `public/icon.svg`
(dark plate), `src/app/apple-icon.tsx` (180 px, amber plate, dark glyph), `src/app/icon.tsx`
(512 px, maskable-safe padding 20 %), `src/app/manifest.ts`. `src/lib/brand/mark.ts` exports
the path data (§3.11) so the OG renderer draws the same mark.

### 2.9 Responsive rules

Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Design from 360 px up. No horizontal
scroll on any route (e2e asserts `document.documentElement.scrollWidth <= innerWidth`). Gutters
≥ 16 px everywhere. Safe-area insets (`env(safe-area-inset-*)`) on fixed bars in the app and on
the sticky submit bar of forms. Only tables and code blocks may exceed the width, each inside
`overflow-x-auto`. Page zoom is never locked (`user-scalable` stays default); the map viewport
uses `touch-action: none` so pinch inside it zooms the map, not the page.

Marketing pages at 390 px: H1 44 px / 0.92, sub 17 px, primary CTA full-width h-12, the two
outline buttons side by side as a 2-col grid with 12 px mono labels; How-it-works stacks its
three step cards (16 px gap; no horizontal track — nothing but tables and code blocks may exceed
the width); exit cards stacked 16 px gap.

Header: sticky, 64 px (56 mobile), `bg-bg-0/80 backdrop-blur-[12px]`, bottom `border-line`
appears only after 8 px scroll (a sentinel + `IntersectionObserver` sets `data-scrolled`).
Mobile menu: full-height sheet with 20 px links and the primary CTA at the bottom. App routes
never render `SiteHeader`; they render the app top bar instead.

---

## 3. Shared contracts

### 3.0 Contract rules

- The files in this section are **contract files**. There are two kinds:
  - **Verbatim files** — content given in full: `src/lib/geo.ts` (§3.1), `src/lib/terrain/types.ts`
    (§3.2), `src/lib/map/types.ts` (§3.3), `src/lib/map/keys.ts` and `src/lib/map/teams.ts` (§3.4),
    `src/lib/realtime/transport.ts` (§3.5), `src/config/maps.ts` (§3.7), `src/lib/admin-sim/types.ts`
    (§3.8), `src/lib/brand/mark.ts` (§3.11), and the byte copies `src/content/openapi.json` /
    `src/content/ServerSettings.ini`. **Create-if-missing:** a builder whose package imports one of
    these may create it with the exact content from this spec (or the exact scratchpad bytes for the
    two copies). Only the owner edits it afterwards. Two builders creating the same file with
    identical content is not a conflict; a differing byte is, and the spec text wins at merge.
  - **API files** — signatures only (`reduce.ts`, `ids.ts`, `schema.ts`, `roster.ts`, `parse.ts`,
    `validate.ts`, the primitives in §3.12, `DocsShell` in §3.15, …). **Owner-only.** A consumer
    never creates a stub of an API file in the shared tree; it codes against the signature and,
    until the owner's module is merged (§8.1), uses a local test double inside its own tree
    (`vi.mock("@/lib/openapi/parse", …)` in its tests; a `*.stub.ts` under its own component folder
    for local development, deleted in Phase 2).
- The TypeScript in this section is final. Copy it verbatim. Do not rename, reorder or "improve"
  a contract; if you believe one is wrong, finish your package against it and state the proposed
  change in your report.
- All ids are strings from `newId()` (§3.4). All timestamps are `Date.now()` ms. All map
  geometry is normalised `[0, 1]` on the square map (upstream convention).
- Every contract module is pure (no DOM, no React) unless it says otherwise, and unit-tested.
- **Relay-reachable modules use relative imports only** — no `@/` alias, no DOM, React or Next
  imports — because `tsc -p server/tsconfig.json` compiles them for the relay without alias
  rewriting (§3.6, §7.7). The set: `src/lib/geo.ts`, `src/lib/terrain/types.ts`,
  `src/lib/map/{types,keys,teams,ids,reduce,schema}.ts`, `src/lib/realtime/{transport,schema}.ts`,
  `src/lib/room/{code,schema}.ts`, `src/config/site.ts` (already alias-free), `server/**`. The
  relay CI job (§7.5) fails on an alias import anywhere in that set.

### 3.1 `src/lib/geo.ts` (WP1)

```ts
/** Normalised map space: x, y in [0, 1], origin top-left, square map. */
export interface Point {
  x: number;
  y: number;
}
/** Axis-aligned box in map space; `rot` is radians about the centre (used by terrain blocks). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export const pt = (x: number, y: number): Point => ({ x, y });
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clampPoint = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
/** Compass bearing from a to b in degrees [0, 360), 0 = north (up), clockwise. */
export const bearingDeg = (a: Point, b: Point): number => {
  const deg = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
};
/** Snap the direction a→b to the nearest `stepDeg` multiple, preserving length. */
export const snapAngle = (a: Point, b: Point, stepDeg: number): Point => {
  const len = distance(a, b);
  const brg = Math.round(bearingDeg(a, b) / stepDeg) * stepDeg;
  const rad = (brg * Math.PI) / 180;
  return { x: a.x + Math.sin(rad) * len, y: a.y - Math.cos(rad) * len };
};
export const pointsEqual = (a: Point, b: Point, eps = 1e-9): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
```

### 3.2 `src/lib/terrain/types.ts` (WP2) — relay-reachable, relative imports only

```ts
import type { Point, Rect } from "../geo";

export const MAP_IDS = ["zestafona", "bakurani", "ozeti"] as const;
export type MapId = (typeof MAP_IDS)[number];

export const CONTROL_ZONE_IDS = ["default", "small-factory", "water-treatment", "houses", "none"] as const;
export type ControlZoneId = (typeof CONTROL_ZONE_IDS)[number];
export type ZoneAnchorId = Exclude<ControlZoneId, "none">;

export const CONTROL_ZONE_LABEL: Record<ControlZoneId, string> = {
  default: "Default",
  "small-factory": "Small Factory",
  "water-treatment": "Water Treatment",
  houses: "Houses",
  none: "None",
};

export type Biome = "river-valley" | "highland" | "coastal";

export type SettlementKind = "town" | "village" | "industry" | "water-works" | "port" | "quarry";
export interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
  center: Point;
  blocks: Rect[];
}

export type PoiKind = "town" | "industry" | "water" | "landmark" | "objective";
export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  at: Point;
}

export interface ControlZone {
  id: ZoneAnchorId;
  name: string;
  center: Point;
  /** Fraction of map width. Default zone 0.075; others 0.06. */
  radius: number;
  /** 12–20 vertices, roughly circular, deterministic from the seed. */
  polygon: Point[];
}

export interface TerrainSpec {
  seed: number;
  /** Heightfield resolution per side (default 256). */
  res: number;
  biome: Biome;
  /** Fixed zone anchors from src/config/maps.ts; the generator builds matching features here. */
  anchors: Record<ZoneAnchorId, Point>;
  /** Invented place names to assign to settlements/POIs in order. */
  names: string[];
}

export interface Contour {
  level: number;
  /** Every 5th contour is an index contour (drawn heavier). */
  index: boolean;
  path: Point[];
}
export type RoadKind = "main" | "track" | "rail";
export interface Road {
  kind: RoadKind;
  path: Point[];
}

export interface TerrainModel {
  spec: TerrainSpec;
  res: number;
  /** res*res heights in [0, 1], row-major. */
  height: Float32Array;
  /** Sea level for coastal biome, else null. */
  sea: number | null;
  contours: Contour[];
  /** Closed polygons: lakes, sea. */
  water: Point[][];
  rivers: Point[][];
  roads: Road[];
  settlements: Settlement[];
  /** Closed polygons for woodland stipple. */
  woods: Point[][];
  /** Closed polygons for field patchwork. */
  fields: Point[][];
  pois: Poi[];
  zones: ControlZone[];
}

export interface MapDef {
  id: MapId;
  name: string;
  seed: number;
  biome: Biome;
  /** Approximate width of the map in metres; used by the measure tool. */
  widthMetres: number;
  anchors: Record<ZoneAnchorId, Point>;
  names: string[];
  /** One line shown in the create-page map card. */
  blurb: string;
}
```

### 3.3 `src/lib/map/types.ts` (WP1) — FROZEN

```ts
import type { Team } from "../../config/site";
import type { Point } from "../geo";
import type { ControlZoneId, MapId } from "../terrain/types";

export type { Point, Team, MapId, ControlZoneId };

/**
 * Opaque per-browser client id: "wd_" + 12 base32 chars, minted once per browser and kept in
 * localStorage (`wardogs:identity`, §5.4). Every tab of one browser shares it: one person is one
 * roster member, and a second tab is the same member. Ordering by string compare is part of the
 * LWW tie-break (Rev).
 */
export type ClientId = string & { readonly __brand: "ClientId" };
export const asClientId = (s: string): ClientId => s as ClientId;

/** Base pixel size of map space. screenX = worldX * MAP_PX * scale + tx (same for y). */
export const MAP_PX = 2048;
export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export const TOOLS = [
  "select", "pen", "arrow", "line", "circle", "rect", "text", "measure", "marker", "request", "ping",
] as const;
export type Tool = (typeof TOOLS)[number];

export const INK_COLORS = ["blue", "red", "green", "yellow", "white", "black"] as const;
export type InkColor = (typeof INK_COLORS)[number];
export const INK_HEX: Record<InkColor, string> = {
  blue: "#5fb8ff",
  red: "#ff4d4d",
  green: "#46c46e",
  yellow: "#e8d26a",
  white: "#f1ebdd",
  black: "#141311",
};
export const INK_LABEL: Record<InkColor, string> = {
  blue: "Blue", red: "Red", green: "Green", yellow: "Yellow", white: "White", black: "Black",
};

export type MarkerGroup = "friendly" | "enemy" | "mark";
export const MARKER_KINDS = [
  "fob", "rally", "lz", "obj", "enemy-fob", "enemy-troops", "danger", "pin",
] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];
export const MARKER_META: Record<
  MarkerKind,
  { group: MarkerGroup; label: string; short: string; hotkey: string }
> = {
  fob: { group: "friendly", label: "Forward operating base", short: "FOB", hotkey: "1" },
  rally: { group: "friendly", label: "Rally point", short: "RALLY", hotkey: "2" },
  lz: { group: "friendly", label: "Landing zone", short: "LZ", hotkey: "3" },
  obj: { group: "friendly", label: "Objective", short: "OBJ", hotkey: "4" },
  "enemy-fob": { group: "enemy", label: "Enemy FOB", short: "FOB", hotkey: "5" },
  "enemy-troops": { group: "enemy", label: "Enemy troops", short: "TROOPS", hotkey: "6" },
  danger: { group: "mark", label: "Danger area", short: "DANGER", hotkey: "7" },
  pin: { group: "mark", label: "Pin", short: "PIN", hotkey: "8" },
};

/** "team" is the shared team layer; squads get their own. */
export type LayerId = "team" | `squad:${string}`;

export const FOCUSES = ["infantry", "medic", "recon", "support", "driver", "pilot"] as const;
export type Focus = (typeof FOCUSES)[number];
export const FOCUS_LABEL: Record<Focus, string> = {
  infantry: "Infantry", medic: "Medic", recon: "Recon", support: "Support", driver: "Driver", pilot: "Pilot",
};

export type Role = "commander" | "co-commander" | "member";

interface NodeBase {
  id: string;
  layer: LayerId;
  author: ClientId;
  authorName: string;
  createdAt: number;
}
export interface Stroke extends NodeBase {
  t: "stroke";
  color: InkColor;
  /** Fraction of map width. Default 0.003. */
  width: number;
  /** 2..MAX_STROKE_POINTS points (simplified on commit). */
  points: Point[];
}
export type ShapeKind = "arrow" | "line" | "circle" | "rect";
/** line/arrow: a→b. circle: a = centre, b = a point on the radius. rect: opposite corners. */
export interface Shape extends NodeBase {
  t: "shape";
  shape: ShapeKind;
  color: InkColor;
  a: Point;
  b: Point;
}
export interface Marker extends NodeBase {
  t: "marker";
  kind: MarkerKind;
  at: Point;
  /** User label ≤ MAX_LABEL_CHARS, may be "". Default label is MARKER_META[kind].short. */
  label: string;
  /** Danger area radius as a fraction of map width; null for every other kind. */
  radius: number | null;
  /** Enemy faction for the "enemy" group (one of the two non-friendly teams); null for every other kind. */
  team: Team | null;
}
export interface TextLabel extends NodeBase {
  t: "text";
  at: Point;
  /** ≤ MAX_TEXT_CHARS chars, ≤ MAX_TEXT_LINES lines. */
  text: string;
  color: InkColor;
  size: "sm" | "md" | "lg";
}
export interface Measurement extends NodeBase {
  t: "measure";
  a: Point;
  b: Point;
  color: InkColor;
}
export type MapNode = Stroke | Shape | Marker | TextLabel | Measurement;
export type NodeType = MapNode["t"];

/** Keys that do not apply to a node's type are ignored by the reducer. */
export type NodePatch = Partial<{
  at: Point;
  a: Point;
  b: Point;
  label: string;
  text: string;
  color: InkColor;
  radius: number | null;
  size: TextLabel["size"];
  layer: LayerId;
  points: Point[];
  team: Team | null;
}>;

export const REQUEST_KINDS = ["fuel", "medical", "ammo", "other"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  fuel: "Fuel", medical: "Medical", ammo: "Ammo", other: "Other",
};
export type RequestStatus = "open" | "claimed" | "delivered";
export type RequestPriority = "normal" | "urgent";
export interface SupplyRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  priority: RequestPriority;
  by: ClientId;
  byName: string;
  claimedBy: ClientId | null;
  claimedByName: string | null;
  createdAt: number;
  claimedAt: number | null;
  deliveredAt: number | null;
  /** Seconds promised by the claimer at claimedAt; null = none given. */
  etaSec: number | null;
  /** Map location; null = no location. */
  at: Point | null;
  /** ≤ MAX_NOTE_CHARS. */
  note: string;
  layer: LayerId;
}
export type RequestPatch = Partial<
  Pick<SupplyRequest, "status" | "priority" | "claimedBy" | "claimedByName" | "claimedAt" | "deliveredAt" | "etaSec" | "at" | "note" | "kind">
>;

export interface RosterMember {
  id: ClientId;
  callsign: string;
  role: Role;
  focus: Focus | null;
  squad?: string;
  /**
   * Persisted flag, not the truth: set true by the member itself on boot, set false by the
   * single-writer after ONLINE_TTL_MS without presence (§5.5). The UI and every roster rule read
   * `isOnline(member, presence, now)` (§3.4), never this field directly.
   */
  online: boolean;
  ink: InkColor;
  /** Only consulted when settings.drawAccess === "request". Commanders always draw. */
  canDraw: boolean;
  drawRequested: boolean;
  joinedAt: number;
  lastSeen: number;
}
export type RosterPatch = Partial<Omit<RosterMember, "id">>;

export type DrawAccess = "everyone" | "request";
export type MapSource =
  | { kind: "builtin" }
  | {
      kind: "upload";
      /** SHA-256 hex of the *shared* JPEG bytes (the 1024 px variant, §5.7). Receivers verify against it. */
      hash: string;
      /** Dimensions of the shared variant: square after letterboxing, w === h ≤ 1024. */
      w: number;
      h: number;
      /** Always "image/jpeg" in v1 (the shared variant's type). */
      mime: string;
      /** Original file name, trimmed to ≤ 64 chars. */
      name: string;
    };
export interface RoomSettings {
  team: Team;
  map: MapId;
  controlZone: ControlZoneId;
  squadMode: boolean;
  /** Squad names when squadMode; default DEFAULT_SQUADS. Each 2–16 chars, unique, ≤ MAX_SQUADS. No rename in v1: remove + add. */
  squads: string[];
  drawAccess: DrawAccess;
  mapSource: MapSource;
}

/** Last-writer-wins revision. Ordering: seq, then actor (string compare). Equal = the same op. */
export interface Rev {
  seq: number;
  actor: ClientId;
}

export interface RoomState {
  v: 1;
  code: string;
  createdAt: number;
  settings: RoomSettings;
  nodes: Record<string, MapNode>;
  /**
   * Derived canonical z-order: every node id sorted by (createdAt asc, id asc). The reducer
   * recomputes it whenever `nodes` changes (`canonicalOrder`); nothing else writes it.
   */
  order: string[];
  requests: Record<string, SupplyRequest>;
  roster: Record<string, RosterMember>;
  /**
   * Rev per key (src/lib/map/keys.ts). Entity keys — node id | request id | `roster:${clientId}` —
   * hold the rev of the op that created or last replaced the entity. Field keys —
   * `${entityKey}:${field}` — hold the rev of the last applied patch to that field.
   * `settings:${field}` holds the rev of each settings field.
   */
  revs: Record<string, Rev>;
  /** Removed entity keys (nodes, requests, roster) with the rev that removed them. Compacted to MAX_TOMBSTONES on save. */
  tombstones: Record<string, Rev>;
  /** Highest seq seen (Lamport clock). */
  seq: number;
}

export interface OpMeta {
  id: string;
  ts: number;
  actor: ClientId;
  seq: number;
}
export type OpBody =
  | { t: "node.add"; nodes: MapNode[] }                       // 1..MAX_NODES_PER_OP nodes
  | { t: "node.update"; id: string; patch: NodePatch }
  | { t: "node.remove"; ids: string[] }                       // 1..MAX_NODES_PER_OP ids
  | { t: "layer.clear"; layer: LayerId; types: NodeType[] | null }
  | { t: "request.add"; request: SupplyRequest }
  | { t: "request.update"; id: string; patch: RequestPatch }
  | { t: "request.remove"; id: string }
  | { t: "roster.upsert"; member: RosterMember }
  | { t: "roster.update"; id: ClientId; patch: RosterPatch }
  | { t: "roster.remove"; id: ClientId }
  | { t: "settings.update"; patch: Partial<RoomSettings> };
export type Op = OpMeta & OpBody;
export type OpType = OpBody["t"];

/** Transient. Never persisted, never an op. */
export interface Ping {
  id: string;
  at: Point;
  by: ClientId;
  byName: string;
  color: InkColor;
  ts: number;
  commander: boolean;
}
export interface Presence {
  client: ClientId;
  callsign: string;
  /** Local receipt time on the receiver's clock (§5.5); the value on the wire is ignored. */
  seenAt: number;
  cursor: Point | null;
}

export interface Identity {
  client: ClientId;
  callsign: string;
  focus: Focus | null;
  ink: InkColor;
}

export type SyncStatus = "local" | "connecting" | "live" | "reconnecting" | "offline";

/** The only persistence / export / seed format. */
export interface RoomSnapshot {
  v: 1;
  state: RoomState;
  savedAt: number;
}
export interface RecentRoom {
  code: string;
  team: Team;
  map: MapId;
  controlZone: ControlZoneId;
  role: Role;
  updatedAt: number;
}

export const DEFAULT_STROKE_WIDTH = 0.003;
export const DEFAULT_DANGER_RADIUS = 0.04;
export const DEFAULT_SQUADS = ["Alpha", "Bravo", "Charlie"];
export const DEMO_ROOM_CODE = "DEMO";
export const MAX_NODES = 4000;
export const MAX_NODES_PER_OP = 200;
export const MAX_TOMBSTONES = 2000;
export const MAX_STATE_BYTES = 600_000;
export const MAX_STROKE_POINTS = 2000;
export const MAX_TEXT_CHARS = 80;
export const MAX_TEXT_LINES = 3;
export const MAX_LABEL_CHARS = 32;
export const MAX_NOTE_CHARS = 60;
export const MAX_SQUADS = 8;
export const SQUAD_NAME_LENGTH: readonly [number, number] = [2, 16];
export const ONLINE_TTL_MS = 60_000;
export const IDLE_AFTER_MS = 90_000;
export const PEER_TTL_MS = 30_000;
```

### 3.4 Map engine API (WP1) — `src/lib/map/*`

`src/lib/map/ids.ts`
```ts
export function newId(): string;                 // 16 chars, base32 alphabet (same as room codes), crypto RNG with Math.random fallback
export function newClientId(): ClientId;         // "wd_" + 12 base32 chars; minted once per browser (§5.4)
export function seededIds(seed: number): () => string;  // deterministic ids for scenarios/tests (mulberry32 over the alphabet)
```

`src/lib/map/keys.ts` — **verbatim**:
```ts
/** Rev keys (§3.3 RoomState.revs). Node and request ids never contain ":" (base32), so keys cannot collide. */
export const nodeKey = (id: string): string => id;
export const requestKey = (id: string): string => id;
export const rosterKey = (client: string): string => `roster:${client}`;
export const fieldKey = (entityKey: string, field: string): string => `${entityKey}:${field}`;
export const settingKey = (field: string): string => `settings:${field}`;
export const isFieldKeyOf = (entityKey: string, key: string): boolean => key.startsWith(entityKey + ":");
```

`src/lib/map/teams.ts` — **verbatim**:
```ts
import { site, type Team } from "../../config/site";

export const TEAMS: readonly Team[] = site.game.teams;
/** The two non-friendly teams in site.game.teams order. */
export function enemyTeams(team: Team): [Team, Team] {
  const rest = TEAMS.filter((x) => x !== team);
  return [rest[0], rest[1]] as [Team, Team];
}
/** Which enemy token colours a faction: the first non-friendly team is enemy-a, the second enemy-b. */
export function enemyTone(team: Team, enemy: Team): "enemy-a" | "enemy-b" {
  return enemyTeams(team)[0] === enemy ? "enemy-a" : "enemy-b";
}
```

`src/lib/map/reduce.ts` — pure, structural sharing, never throws on valid input.
```ts
export function createRoomState(init: { code: string; settings: RoomSettings; createdAt: number; actor: ClientId }): RoomState; // seq = 1; every settings field gets rev {seq: 1, actor}
export function compareRev(a: Rev, b: Rev): number;             // seq asc, then actor asc; 0 only for the same op
export function isStale(state: RoomState, key: string, rev: Rev): boolean; // true if revs[key] or tombstones[key] >= rev
export function applyOp(state: RoomState, op: Op): RoomState;   // returns the SAME reference when nothing changed (seq is still bumped — see rules)
export function applyOps(state: RoomState, ops: Op[]): RoomState;
export function mergeStates(a: RoomState, b: RoomState): RoomState; // commutative, associative, idempotent; rules below
export function inverseOf(state: RoomState, op: Op): OpBody[] | null;  // computed against the state BEFORE the op; null when not invertible (roster.*, settings.update); batched ≤ MAX_NODES_PER_OP
export function nextSeq(state: RoomState, incoming?: number): number; // max(state.seq, incoming ?? 0) + 1
export function canonicalOrder(nodes: Record<string, MapNode>): string[]; // ids sorted by (createdAt asc, id asc)
```
Reducer rules (must all be unit-tested):
- Keys come from `keys.ts`. `revs[entityKey]` = rev of the op that created or last replaced the
  entity (`node.add`, `request.add`, `roster.upsert`). `revs[fieldKey(entityKey, field)]` = rev of
  the last applied patch to that field. `tombstones[entityKey]` = rev of the op that removed it.
  "Greater" means `compareRev(a, b) > 0`; an equal rev is stale (that is what dedupes a
  re-delivered op).
- **Add / upsert** (`node.add` per node, `request.add`, `roster.upsert`): applied iff rev >
  `revs[entityKey]` and rev > `tombstones[entityKey]`. When applied the entity is written whole,
  `revs[entityKey] = rev`, every `${entityKey}:*` field rev is deleted and the tombstone (if any)
  is deleted. This is how undo-of-delete resurrects a node.
- **Patch** (`node.update`, `request.update`, `roster.update`): requires the entity to exist,
  else the op is dropped. For each key of the patch that is valid for the entity (nodes: only
  the keys valid for `t` — stroke `color layer points`; shape `a b color layer`; marker `at label
  radius team layer`; text `at text color size layer`; measure `a b color layer`; other keys are
  dropped silently), the field is written iff rev > `revs[entityKey]` and rev >
  `revs[fieldKey]`; on write `revs[fieldKey] = rev`. A patch may apply partially. Concurrent
  patches to different fields both survive in any arrival order; concurrent patches to the same
  field resolve by rev. A patch that writes nothing returns the same state reference.
- **Remove** (`node.remove` per id, `layer.clear` per matching node, `request.remove`,
  `roster.remove`): applied iff rev > `revs[entityKey]` and rev > `tombstones[entityKey]`. When
  applied the entity is deleted, `tombstones[entityKey] = rev`, and `revs[entityKey]` plus every
  `${entityKey}:*` field rev are deleted. A remove is never blocked by a higher *field* rev:
  delete beats a concurrent move in either arrival order (the late patch finds no entity and is
  dropped; the early patch is wiped by the remove).
- **`settings.update`**: per field with `settingKey(field)`, the patch rule without an entity rev.
- `order = canonicalOrder(nodes)` whenever `nodes` changed; untouched otherwise. Nothing else
  ever writes `order`, so it can never hold duplicates and is identical on every replica that
  holds the same `nodes`.
- `state.seq = max(state.seq, op.seq)` always, even when the op is otherwise ignored (this is
  the one case where an "ignored" op returns a new reference: when `op.seq > state.seq`).
- **Causal delivery is assumed for patches.** An actor only emits a patch for an entity present
  in its own state, and every transport delivers one actor's ops in order (relay fan-out is one
  total order; BroadcastChannel is one browser; snapshots merge whole entities), so a patch never
  overtakes the add it depends on. A patch for a missing entity is dropped, and that is correct
  under this assumption. The convergence test (§7.1) generates causally valid histories — every
  patch's rev is greater than its entity's add rev and permutations keep each entity's add before
  its patches — and shuffles everything else: concurrent patches to the same and to different
  fields, removes racing patches, resurrecting adds, `layer.clear` racing adds.
- Node cap: after `node.add`, if `Object.keys(nodes).length > MAX_NODES` the oldest strokes by
  canonical order are dropped from the result without tombstones; the single-writer (§5.5)
  additionally emits a `node.remove` for them so every peer agrees.
- Body caps: `node.add` carries ≤ `MAX_NODES_PER_OP` nodes and `node.remove` ≤ `MAX_NODES_PER_OP`
  ids (`OpSchema` rejects more; `dispatch` returns null); `inverseOf` and `importPlan` batch.

`mergeStates(a, b)` — used on hello/sync by clients and by the relay ("Load plan → Merge" is `importPlan`, not a merge):
- Per entity key present on either side: let `ea`/`eb` be each side's `revs[entityKey]` (absent =
  none) and `ta`/`tb` each side's tombstone. The highest of the four decides: if it is a tombstone
  the entity is absent and the tombstone kept; otherwise the entity object comes from the side
  with the higher entity rev, and for every field key of that entity present on either side with
  a rev **greater than the winning entity rev**, the field value comes from the side with the
  higher field rev (field revs ≤ the entity rev belong to a replaced generation and are dropped
  with their values). Tombstones beaten by a surviving entity's higher entity rev are dropped.
- `settings`: per field by `settings:${field}` rev (createRoomState stamps every field, so two
  independently created states never tie — different actors).
- `createdAt = min`, `seq = max`, `code = a.code`, `v = 1`, `order = canonicalOrder(nodes)`.

`inverseOf(state, op)` (against the state before the op): `node.add` → `[node.remove ids]`;
`node.update` → `[node.update {previous values of the keys that actually changed}]`; `node.remove`
and `layer.clear` → `node.add` batches (≤ MAX_NODES_PER_OP) of the removed nodes as they were;
`request.add` → `[request.remove]`; `request.update` → `[request.update {previous}]`;
`request.remove` → `[request.add]`; `roster.*`, `settings.update` → `null`.

`src/lib/map/schema.ts` — zod v4 schemas (relay-reachable; relative imports): `PointSchema`
(finite numbers in [0, 1]), `MapNodeSchema` (discriminated union; stroke `points` 2..MAX_STROKE_POINTS,
`width` in (0, 0.05]; marker `label` ≤ MAX_LABEL_CHARS, `team` in `site.game.teams` or null; text
≤ MAX_TEXT_CHARS chars and ≤ MAX_TEXT_LINES − 1 newlines; `authorName` = CallsignSchema),
`SupplyRequestSchema` (`note` ≤ MAX_NOTE_CHARS), `RosterMemberSchema`, `RoomSettingsSchema`
(`squads`: 0..MAX_SQUADS unique strings of SQUAD_NAME_LENGTH), `RoomStateSchema` (`code`:
`RoomCodeSchema.or(z.literal(DEMO_ROOM_CODE))`; `nodes` ≤ MAX_NODES), `OpSchema` (discriminated on
`t`; `node.add` 1..MAX_NODES_PER_OP nodes, `node.remove` 1..MAX_NODES_PER_OP ids; patches use the
same caps as the entities), `RoomSnapshotSchema`, `CallsignSchema` (trimmed, 2–24 chars, no
control chars). Export `parseSnapshot(json: unknown): RoomSnapshot | null` (never throws; logs
once in dev) and `migrateSnapshot(raw: unknown): RoomSnapshot | null` (v1 only).

`src/lib/map/history.ts`
```ts
export interface HistoryEntry { op: Op; inverse: OpBody[] }
export interface History { undo: HistoryEntry[]; redo: HistoryEntry[] }
export function createHistory(): History;
export function pushHistory(h: History, entry: HistoryEntry, cap?: number): History; // cap 200, clears redo
export function popUndo(h: History): { history: History; entry: HistoryEntry | null };
export function popRedo(h: History): { history: History; entry: HistoryEntry | null };
```
Undo emits every body of `inverse` **as new ops** (fresh meta, one `dispatchMany`); redo re-emits
the original body as a new op. Shared state is never rewound.

`src/lib/map/viewport.ts`
```ts
export function worldToScreen(v: Viewport, p: Point): { x: number; y: number };
export function screenToWorld(v: Viewport, s: { x: number; y: number }): Point;
export function zoomAt(v: Viewport, s: { x: number; y: number }, factor: number, min?: number, max?: number): Viewport; // min 0.25, max 8
export function fitToBox(box: { w: number; h: number }, pad?: number): Viewport;   // scale so MAP_PX fits, centred
export function clampViewport(v: Viewport, box: { w: number; h: number }): Viewport; // keep ≥ 25 % of the map visible
export function panBy(v: Viewport, dx: number, dy: number): Viewport;
```

`src/lib/map/grid.ts` — 10×10 grid, columns A–J left→right, rows 1–10 top→bottom, keypad
sub-cells 1–9 laid out like a phone keypad rotated for maps (7 8 9 top row, 4 5 6 middle, 1 2 3
bottom; i.e. 1 = bottom-left).
```ts
export const GRID_COLS = "ABCDEFGHIJ";
export function gridRef(p: Point, sub?: boolean): string;    // "D7" | "D7-3"
export function gridCell(ref: string): { x0: number; y0: number; x1: number; y1: number } | null;
export function gridLines(): { cols: number[]; rows: number[] };   // 11 values each (0..1)
```

`src/lib/map/ink.ts`
```ts
export function strokeOutline(points: Point[], widthPx: number): number[][];  // perfect-freehand getStroke with size=widthPx, thinning 0.55, smoothing 0.6, streamline 0.5, simulatePressure true
export function outlineToPath(outline: number[][]): string;                    // "M … Z" with quadratic midpoints
export function simplify(points: Point[], tolerance: number): Point[];          // Ramer–Douglas–Peucker; tolerance 0.0008 on commit; result hard-capped to MAX_STROKE_POINTS by uniform decimation
```

`src/lib/map/tools.ts` — tool state machine, testable with synthetic samples.
```ts
export interface Sample { p: Point; t: number; pressure: number; shift: boolean; alt: boolean }
export type ToolPreview =
  | { t: "stroke"; points: Point[]; color: InkColor }
  | { t: "shape"; shape: ShapeKind; a: Point; b: Point; color: InkColor }
  | { t: "measure"; a: Point; b: Point; metres: number | null; bearing: number }
  | { t: "marker"; kind: MarkerKind; at: Point }
  | { t: "none" };
export interface ToolContext {
  tool: Tool; ink: InkColor; markerKind: MarkerKind; enemyTeam: Team; layer: LayerId;
  author: ClientId; authorName: string; widthMetres: number | null; now: () => number; id: () => string;
}
export interface ToolSession { preview: ToolPreview; down(s: Sample): ToolSession; move(s: Sample): ToolSession; up(s: Sample): { session: ToolSession; op: OpBody | null; commit?: MapNode }; cancel(): ToolSession }
export function startTool(ctx: ToolContext): ToolSession;
```
Rules: pen commits one `node.add` with a simplified stroke on `up` (min 2 points; a tap with the
pen = a 2-point dot). arrow/line/circle/rect commit on `up` when `distance(a, b) > 0.004`; Shift
snaps line/arrow/measure to 15° via `snapAngle`; Shift on rect/circle constrains to square/circle.
`measure` commits a `Measurement` node. `marker` commits on `down` (tap); an enemy-group marker
gets `team: ctx.enemyTeam`, every other kind `team: null`. `text`, `request`, `ping`, `select`
are handled in the UI (they need DOM input), not here.

`src/lib/map/requests.ts` — pure lifecycle.
```ts
export type RequestError = "not-open" | "not-claimed" | "not-yours" | "already-delivered";
export function createRequest(input: { id: string; kind: RequestKind; priority: RequestPriority; by: ClientId; byName: string; at: Point | null; note: string; layer: LayerId; now: number }): SupplyRequest;
export function claim(r: SupplyRequest, by: RosterMember, now: number, etaSec?: number | null): RequestPatch | RequestError;   // open → claimed
export function deliver(r: SupplyRequest, by: RosterMember, now: number): RequestPatch | RequestError;  // claimed → delivered; claimer or commander/co-commander
export function release(r: SupplyRequest, by: RosterMember): RequestPatch | RequestError;             // claimed → open; claimer or commander/co-commander
export function setEta(r: SupplyRequest, by: RosterMember, etaSec: number | null): RequestPatch | RequestError; // claimer only
export function canEdit(r: SupplyRequest, by: RosterMember): boolean;     // requester or commander/co-commander
export function ageState(r: SupplyRequest, now: number): "fresh" | "aging" | "stale";   // open: <60 s fresh, <120 s aging, else stale; others fresh
export function etaRemaining(r: SupplyRequest, now: number): number | null; // seconds, may be negative
export function suggestedFocus(kind: RequestKind): Focus[];               // fuel|ammo → ["pilot","driver"], medical → ["medic"], other → []
export function rankRequests(list: SupplyRequest[], me: RosterMember | null, now: number): SupplyRequest[]; // urgent first, then kinds matching my focus, then oldest first
export type RequestFilter = "all" | "open" | "mine" | "done";
export function filterRequests(list: SupplyRequest[], filter: RequestFilter, me: ClientId | null): SupplyRequest[]; // all = open + claimed; open = open only; mine = by me OR claimed by me (any status); done = delivered
export function shouldPrune(r: SupplyRequest, now: number): boolean;      // delivered more than 30 min ago
```

`src/lib/map/roster.ts` — `online` is **derived**; every rule below takes presence + now.
```ts
export function isOnline(m: RosterMember, presence: Presence | undefined, now: number): boolean; // presence within ONLINE_TTL_MS → true; presence older → false; no presence record at all → m.online (the persisted flag)
export function canDraw(m: RosterMember | null, s: RoomSettings): boolean;         // everyone → true; request → role !== "member" || m.canDraw
export function isCommand(m: RosterMember | null): boolean;                         // commander | co-commander
export function focusTally(roster: RosterMember[], presence: Record<string, Presence>, now: number): Record<Focus, number>; // isOnline members only
export function focusWarnings(t: Record<Focus, number>): string[];                  // ["No pilot in room", "No medic in room"]
export function visibleLayers(s: RoomSettings, m: RosterMember | null): LayerId[]; // squadMode off → ["team"]; command → all; member → ["team", `squad:${m.squad}`]
export function editableLayer(s: RoomSettings, m: RosterMember | null): LayerId;   // squadMode off or command → "team"; member → `squad:${m.squad ?? s.squads[0]}`
export function isIdle(lastActiveAt: number | undefined, now: number): boolean;    // no op / non-null cursor from that client within IDLE_AFTER_MS (the store keeps `activity[client]`, §5.1)
export function successor(roster: RosterMember[], presence: Record<string, Presence>, now: number, leaving: ClientId): RosterMember | null; // earliest-joined online co-commander, else earliest-joined online member, excluding `leaving`
export function singleWriter(roster: RosterMember[], presence: Record<string, Presence>, now: number): ClientId | null; // lowest client id among members with presence within PEER_TTL_MS (self included)
export function staleMembers(roster: RosterMember[], presence: Record<string, Presence>, now: number): RosterMember[]; // m.online === true and !isOnline(m) — what the single-writer flips to online:false
```

`src/lib/map/plan.ts` — export/import (pure; the PNG part is in `src/lib/map/export-png.ts`, browser-only).
```ts
export function planToText(state: RoomState, mapName: string, now: number): string; // Markdown for Discord: header line, FRIENDLY / ENEMY / MARKS lists with grid refs and labels (enemy lines carry the faction: `FOB "AUSTIN" · VALKYRA at F3`), OPEN REQUESTS with by/claimed/age
export function planToSnapshot(state: RoomState, now: number): RoomSnapshot;
export function importPlan(target: RoomState, incoming: RoomSnapshot, mode: "replace" | "merge", actor: ClientId, now: number): OpBody[]; // replace = layer.clear all + node.add batches; merge = node.add batches of nodes whose ids are new (ids re-minted on collision); every batch ≤ MAX_NODES_PER_OP
```
`src/lib/map/export-png.ts` (browser):
```ts
export function exportSvg(svgEl: SVGSVGElement): string;   // deep-clones the map SVG, removes every [data-export="skip"] element (cursor, ping, selection, foreignObject editors, help), returns XMLSerializer output. Relies on every map element carrying presentation attributes (§4.3.2); in dev, throws if any shape/text/use in the clone has a class attribute.
export function exportPng(svgEl: SVGSVGElement, terrain: HTMLCanvasElement | ImageBitmap, legend: { code: string; team: string; map: string; zone: string; date: string }, size?: number): Promise<Blob>; // draws terrain, then exportSvg() via Blob URL → Image, then a 56 px legend strip bottom-left in mono; default 2048 px. Text falls back to the system monospace inside the raster (web fonts are not embedded); accepted.
```

`src/lib/map/scenario.ts` (WP1) — the demo/hero scenario (§4.2). Everything here is deterministic
per **epoch index** so two visitors' local copies of a bot op are byte-identical and dedupe by rev.
```ts
export interface ScenarioEvent { at: number; kind: "op"; body: OpBody; actor: ClientId; actorName: string }
export interface ScenarioPing { at: number; kind: "ping"; ping: Omit<Ping, "id" | "ts"> }
export type ScenarioItem = ScenarioEvent | ScenarioPing;
export const DEMO_EPOCH_MS = 300_000;
export const DEMO_BOT_IDS: Record<"ossian" | "krieger" | "boston" | "rook", ClientId>;  // fixed literal ids in the ClientId format
export const DEMO_BOTS: readonly RosterMember[];              // Ossian (commander, infantry, yellow), Krieger (pilot, green), Boston (medic, blue), Rook (recon, red); online: true
export function epochStart(now: number): number;                // now - (now % DEMO_EPOCH_MS)
export function epochIndex(now: number): number;                // floor(now / DEMO_EPOCH_MS)
export function demoRelayRoom(now: number): string;             // `DEMO-${epochIndex(now)}` — the relay room; RoomState.code stays "DEMO"
export function demoSeedState(epochIndex: number): RoomState;   // code "DEMO", createdAt = epochIndex * DEMO_EPOCH_MS, Lonestar, zestafona, default zone, drawAccess everyone; built by applying the seed ops (ids from seededIds(epochIndex), actor = the authoring bot, seq 1..k) to createRoomState({actor: DEMO_BOT_IDS.ossian})
export const DEMO_TIMELINE: readonly ScenarioItem[];            // sorted by `at` (ms from epoch start), all < DEMO_EPOCH_MS
export function timelineOps(epochIndex: number): Op[];          // the "op" items of DEMO_TIMELINE stamped: id = seededIds(epochIndex * 7919 + 1)() in order, ts = epochIndex * DEMO_EPOCH_MS + at, actor = the item's actor, seq = 1000 + index
export function stateAt(now: number): { state: RoomState; nextIndex: number };  // demoSeedState(epochIndex(now)) + every timelineOps item with at <= now - epochStart(now)
export function botPresence(now: number): Presence[];           // the four bots with seenAt = now, cursor null (the director feeds these every 10 s so bots count as online)
export const HERO_TIMELINE: readonly ScenarioItem[];            // the seed plan appearing node by node over ~5 s, then 8 items at 2.5 s spacing; loops
export function heroFinalState(): RoomState;                    // demoSeedState(0) with every HERO_TIMELINE op applied (deterministic ids) — what HeroStatic renders and what the player shows under reduced motion
```

### 3.5 `src/lib/realtime/transport.ts` (WP1) — FROZEN (relay-reachable, relative imports only)

```ts
import type { ClientId, Identity, Op, Ping, Point, Presence, RoomState, SyncStatus } from "../map/types";

export type TransportKind = "broadcast" | "ws" | "memory";

/** Wire messages. Every frame is JSON of exactly one of these. `room` is the room code. */
export type WireMessage =
  | { k: "hello"; room: string; identity: Identity; seq: number; snapshot: RoomState | null }
  | { k: "op"; room: string; op: Op }
  | { k: "sync.request"; room: string; since: number }
  | { k: "sync.snapshot"; room: string; state: RoomState }
  | { k: "sync.ops"; room: string; ops: Op[] }
  | { k: "presence"; room: string; members: Presence[] }
  | { k: "bye"; room: string; client: ClientId }
  | { k: "ping"; room: string; ping: Ping }
  | { k: "cursor"; room: string; client: ClientId; at: Point | null }
  | { k: "map.request"; room: string; hash: string }
  | { k: "map.chunk"; room: string; hash: string; i: number; n: number; mime: string; w: number; h: number; data: string }
  | { k: "error"; room: string; code: "room-full" | "rate-limit" | "bad-frame" | "kicked"; message: string };

export type EphemeralMessage = Extract<WireMessage, { k: "ping" | "cursor" | "map.request" | "map.chunk" }>;
export type Unsubscribe = () => void;

export interface Transport {
  readonly kind: TransportKind;
  readonly status: SyncStatus;
  /** Connect and announce. `snapshot` is the caller's persisted state (may be null). Resolves when hello was sent (not when synced). */
  join(roomCode: string, identity: Identity, seq: number, snapshot: RoomState | null): Promise<void>;
  /** Broadcast an op to the room. Queued while reconnecting (cap 1000, oldest dropped). */
  send(op: Op): void;
  sendEphemeral(msg: EphemeralMessage): void;
  requestSnapshot(since: number): void;
  onOp(cb: (op: Op) => void): Unsubscribe;
  onSnapshot(cb: (state: RoomState) => void): Unsubscribe;
  onOps(cb: (ops: Op[]) => void): Unsubscribe;
  onPresence(cb: (members: Presence[]) => void): Unsubscribe;
  onEphemeral(cb: (msg: EphemeralMessage) => void): Unsubscribe;
  onStatus(cb: (status: SyncStatus) => void): Unsubscribe;
  onError(cb: (err: Extract<WireMessage, { k: "error" }>) => void): Unsubscribe;
  leave(): void;
}

export interface TransportOptions {
  /** Called by the broadcast transport to answer a peer's sync.request; ws leaves this to the relay. */
  getState: () => RoomState | null;
  /** Resolved by resolveRelayUrl() (§5.2); undefined → broadcast. */
  relayUrl?: string;
  /** Default 3000; on timeout fall back to broadcast (status "local"). */
  connectTimeoutMs?: number;
}
export interface MemoryBus {
  publish(from: object, msg: WireMessage): void;
  subscribe(self: object, cb: (msg: WireMessage) => void): Unsubscribe;
}
```

Factories (API, one per module; WP1):
```ts
// src/lib/realtime/index.ts
export function createTransport(opts: TransportOptions): Transport;   // ws when relayUrl is set (with the 3 s fallback), else broadcast
// src/lib/realtime/broadcast.ts
export function createBroadcastTransport(opts: TransportOptions): Transport;
// src/lib/realtime/ws.ts
export function createWsTransport(opts: TransportOptions & { relayUrl: string }): Transport;
// src/lib/realtime/memory.ts (tests)
export function createMemoryBus(): MemoryBus;
export function createMemoryTransport(bus: MemoryBus, opts: TransportOptions): Transport;
```

`src/lib/realtime/schema.ts` (relay-reachable, relative imports) exports `WireMessageSchema`
(zod, discriminated on `k`; `op` uses `OpSchema`, snapshots use `RoomStateSchema`) and the **one
table of frame limits** both sides use:

```ts
export const WIRE_LIMITS = {
  default: 65_536,           // op, sync.request, presence, bye, ping, cursor, map.request, error
  "map.chunk": 262_144,
  hello: 2_097_152,          // carries a snapshot
  "sync.snapshot": 2_097_152,
  "sync.ops": 2_097_152,     // up to 500 ops
  max: 2_097_152,
} as const;
export function wireLimit(kind: WireMessage["k"]): number;   // WIRE_LIMITS[kind] ?? WIRE_LIMITS.default
export function parseWire(raw: string, byteLength?: number): WireMessage | null;
```
`parseWire` returns null when `byteLength` (default `raw.length`) exceeds `WIRE_LIMITS.max`, when
JSON parsing or schema validation fails, or when `byteLength > wireLimit(msg.k)`. The relay passes
the raw frame's byte length; the client passes `raw.length` (UTF-16 units — an under-count on
multibyte text, accepted). Both client and relay validate every inbound frame; a bad frame is
dropped (relay: counted, socket closed after 20 bad frames). A `MAX_STATE_BYTES` (600 kB) state
serialises well under the 2 MB snapshot limit, so a room can always be joined.

Semantics shared by every transport: `sync.request {since}` asks for every op with `seq >= since`
(≥, not >, so same-seq ops from other actors are not skipped; duplicates dedupe by rev);
`presence[].seenAt` on the wire is ignored — receivers stamp their own `Date.now()` (§5.5);
`hello.snapshot` is surfaced to peers through `onSnapshot` (they `mergeStates`), so a returning
tab with newer local state propagates it without emitting an op.

Status semantics: broadcast transport → `"local"` always. ws → `"connecting"` until the socket
opens and hello is sent, then `"live"`; on close → `"reconnecting"` with backoff; after 10
consecutive failures → `"offline"` (still retries every 15 s). `"offline"` is shown as
RECONNECTING… in the UI with the attempt count in the tooltip.

### 3.6 Relay wire protocol (WP1, `server/relay.ts`)

- HTTP: `GET /healthz` → `200 {"ok":true,"rooms":n}`. Everything else 404.
- WebSocket upgrade on `GET /ws?room=<ROOM>`; `Origin` must be in `RELAY_ALLOWED_ORIGINS`
  (comma list; `*` allowed for dev; the Discord Activity origin `https://<clientId>.discordsays.com`
  must be listed for the Activity — README). `ROOM` is `RoomCodeSchema` or the demo pattern
  `/^DEMO-\d{1,9}$/` (§5.6); anything else → 400 before upgrade.
- Every frame is validated with `parseWire(raw, byteLength)`; a frame whose `room` is not the
  socket's room is dropped and counted as bad. First frame must be `hello` within 5 s.
- On hello: `room.state = mergeStates(room.state, hello.snapshot)` (when either exists), reply
  `sync.snapshot` with the merged state (if any), then broadcast `presence`. If `hello.seq <
  room.seq` and the ring holds every op with `seq >= hello.seq`, it may send `sync.ops` instead.
- `op`: validate; `room.state = applyOp(...)`; append to `room.ops` (ring of 500); fan out to
  every other socket in the room in arrival order (one total order per room).
- `sync.request {since}`: reply `sync.ops` (ops with `seq >= since`) if the ring covers them,
  else `sync.snapshot`.
- `ping`, `cursor`, `map.request`: fan out, never stored. `map.chunk`: fan out; the relay also
  caches the last uploaded map per room (≤ 1.5 MB assembled) to answer later `map.request`s.
- Presence: the relay tracks `{client, callsign, seenAt}` per socket, de-duplicates by `client`
  (two tabs of one browser are one member — the newest `seenAt` wins) and broadcasts `presence`
  on join/leave and every 15 s; `cursor` refreshes `seenAt`.
- `roster.remove` of client X (a kick): after fan-out the relay closes every socket whose hello
  identity is X with `error kicked`. Trust model: any member can emit it; there is no identity to
  enforce roles against, and the room code is the only secret (Terms and README say so).
- Limits — one table, in `WIRE_LIMITS` (§3.5) plus: 60 frames/s per socket (excess → `error
  rate-limit`, then close at 3 strikes); ≤ 64 sockets per room (`error room-full`); ≤ 2,000 rooms;
  room evicted after 6 h idle; state size ≤ `MAX_STATE_BYTES` after every op (older strokes
  dropped as in the reducer cap; a `node.remove` is fanned out for them so peers agree).
- Env: `RELAY_PORT` (falls back to `PORT`, then 8787), `RELAY_ALLOWED_ORIGINS`, `RELAY_MAX_ROOMS`,
  `RELAY_IDLE_HOURS`.
- Build: the relay imports the reducer and schemas through relative paths
  (`../src/lib/map/reduce`, `../src/lib/realtime/schema`, …). `server/tsconfig.json` (verbatim):
  ```json
  {
    "extends": "../tsconfig.json",
    "compilerOptions": {
      "module": "node16", "moduleResolution": "node16", "noEmit": false, "rootDir": "..",
      "outDir": "dist", "incremental": false, "plugins": [], "paths": {}, "allowJs": false, "types": ["node"]
    },
    "include": ["./relay.ts"]
  }
  ```
  tsc follows the relay's imports, so exactly the relay-reachable modules (§3.0) are compiled —
  CommonJS output (`package.json` has no `"type": "module"`) under `server/dist/server/relay.js`
  and `server/dist/src/…`; `"start:relay": "node server/dist/server/relay.js"`. `"paths": {}`
  turns any `@/` import in a reached module into a compile error, which is the enforcement of the
  relative-import rule. `server/relay.test.ts` is not part of that program; it runs under vitest
  with `// @vitest-environment node` at the top of the file.

### 3.7 Terrain API (WP2) — `src/lib/terrain/*` and `src/config/maps.ts`

`src/lib/terrain/rng.ts`
```ts
export function hashString(s: string): number;          // FNV-1a 32-bit, unsigned
export function mulberry32(seed: number): () => number; // [0,1)
```
`src/lib/terrain/noise.ts`
```ts
export function valueNoise2D(seed: number): (x: number, y: number) => number;   // [0,1], smooth
export function fbm(seed: number, octaves?: number, lacunarity?: number, gain?: number): (x: number, y: number) => number;
```
`src/lib/terrain/generate.ts`
```ts
export function generateTerrain(spec: TerrainSpec): TerrainModel;   // deterministic; ≤ 120 ms at res 256 on a laptop
export function mapModel(id: MapId): TerrainModel;                   // memoised per map (module-level Map)
export function specFor(def: MapDef): TerrainSpec;
```
`src/lib/terrain/draw-svg.ts` (string-only; safe in the OG runtime)
```ts
export interface SvgOptions {
  size: number; labels?: boolean; grid?: boolean; zone?: ControlZoneId;
  crop?: { x: number; y: number; w: number; h: number }; background?: boolean;
  /** "thumb" (default when size ≤ 400): contours from a res-64 downsample, RDP 0.002, no woods stipple, no field patchwork, no labels. "full": RDP 0.0008, everything. */
  detail?: "thumb" | "full";
}
export function terrainToSvg(model: TerrainModel, opts: SvgOptions): string;     // complete <svg …> string, viewBox 0 0 size size; ≤ 40 kB at "thumb", ≤ 150 kB at "full" size 1024 (asserted for all three maps)
export function terrainToDataUri(model: TerrainModel, opts: SvgOptions): string;  // "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) — OG renderer only, never in server HTML
export function biomePalette(biome: Biome): { ground: string; low: string; high: string; water: string; road: string; block: string; wood: string; field: string; contour: string; label: string }; // ground relative luminance 0.15–0.19 for every biome (§2.3)
```
`src/lib/terrain/url.ts` (WP2, pure)
```ts
export type TerrainSize = 320 | 640 | 1024;
export interface TerrainUrlOptions { size?: TerrainSize; zone?: ControlZoneId; grid?: boolean; labels?: boolean }
export function terrainUrl(map: MapId, opts?: TerrainUrlOptions): string;  // `/terrain/${map}.svg?size=1024&zone=none&grid=0&labels=1&v=${site.version}` (defaults: 1024, none, 0, 1)
```
`src/app/terrain/[file]/route.ts` (WP2) — `GET /terrain/<mapId>.svg`: `file` must match
`/^(zestafona|bakurani|ozeti)\.svg$/` and the query is validated with zod (`size` ∈ {320, 640,
1024}, `zone` ∈ `CONTROL_ZONE_IDS`, `grid`/`labels` ∈ {0, 1}); anything else → 404. Responds
`image/svg+xml; charset=utf-8` with `Cache-Control: public, max-age=31536000, immutable` (the URL
carries `v=site.version`, so a new deploy busts it). The handler is dynamic (it reads the query);
`mapModel` is memoised per server instance and generation is ≤ 120 ms, so cold hits are cheap and
warm hits are CDN cache hits. This is how every server-rendered map (`MapPreview`, the create
thumbnails, the hero) gets its terrain **by URL** — never as an inline data URI in HTML.
`src/lib/terrain/draw-canvas.ts` (browser)
```ts
export function drawTerrain(ctx: CanvasRenderingContext2D, model: TerrainModel, size: number): void;  // same look as the SVG; hillshade from the heightfield
export function terrainBitmap(model: TerrainModel, size: number): Promise<ImageBitmap>;                // OffscreenCanvas when available, else a detached canvas; memoised by (map, size)
```

Visual contract for both renderers (identical output, checked by eye against each other):
base fill from `biomePalette(biome).ground`; hillshaded tone (light from NW, ±8 % luminance);
field patchwork at 10 % alpha; woods stipple 12 % alpha; contours 1 px at `contour` 10 % alpha,
index contours 18 %; rivers 6 px `water` at 80 %; lakes/sea filled `water`; main roads 3 px
`road` 60 % with a 1 px darker casing, tracks 1.5 px dashed, rail 2 px with 6/6 ticks;
settlement blocks filled `block` with a 0.5 px lighter edge; place names mono 10 px `label` at
70 % alpha (labels off in thumbnails ≤ 200 px); optional 10×10 grid (`rgba(255,255,255,0.08)`,
A–J on the top edge, 1–10 on the left edge, mono 9 px); optional control zone as a dashed
accent circle (2 px, 6/4 dash) plus a filled `accent/10` polygon and the zone name in a chip;
a 4 % dark vignette; desaturated overall so ink and markers pop.

Biomes: `river-valley` (Zestafona: broad valley, one river with tributary, farmland patchwork,
a town cluster and villages); `highland` (Bakurani: ridge lines with strong contours, a quarry,
a rail spur, sparse villages, dry palette); `coastal` (Ozeti: sea on the east edge with a bay,
a port with a breakwater, an industrial block, a coastal road, dunes). Anchored features: at
`anchors.small-factory` an `industry` settlement (4–7 large blocks); at `anchors.water-treatment`
a `water-works` settlement (3–5 circular tank glyphs beside water); at `anchors.houses` a
`village` (8–14 small blocks); at `anchors.default` the central `objective` POI (a crossroads
with a `town`). Each map gets 6–8 additional flavour POIs named from `names` in order.

`src/config/maps.ts` (WP2) — verbatim:
```ts
import type { MapDef, MapId } from "@/lib/terrain/types";

export const MAPS: Record<MapId, MapDef> = {
  zestafona: {
    id: "zestafona",
    name: "Zestafona",
    seed: 0x5a45_5354,
    biome: "river-valley",
    widthMetres: 2400,
    anchors: {
      default: { x: 0.5, y: 0.47 },
      "small-factory": { x: 0.3, y: 0.62 },
      "water-treatment": { x: 0.66, y: 0.28 },
      houses: { x: 0.72, y: 0.68 },
    },
    names: ["Verano", "Old Mill", "Kesler Farm", "North Bridge", "Tarn Cross", "Hollow Road", "Sedge Bend", "Rail Halt"],
    blurb: "Farmland, a river and a town in the middle. Open approaches.",
  },
  bakurani: {
    id: "bakurani",
    name: "Bakurani",
    seed: 0x4241_4b55,
    biome: "highland",
    widthMetres: 2000,
    anchors: {
      default: { x: 0.48, y: 0.52 },
      "small-factory": { x: 0.68, y: 0.36 },
      "water-treatment": { x: 0.26, y: 0.4 },
      houses: { x: 0.58, y: 0.74 },
    },
    names: ["Saddle", "Quarry Gate", "Pylon Ridge", "Dry Wash", "Kovar", "The Spur", "Shepherd's Rest", "High Cut"],
    blurb: "Ridges and a quarry. Long sightlines, hard cover.",
  },
  ozeti: {
    id: "ozeti",
    name: "Ozeti",
    seed: 0x4f5a_4554,
    biome: "coastal",
    widthMetres: 2200,
    anchors: {
      default: { x: 0.52, y: 0.5 },
      "small-factory": { x: 0.64, y: 0.62 },
      "water-treatment": { x: 0.34, y: 0.3 },
      houses: { x: 0.28, y: 0.66 },
    },
    names: ["Breakwater", "Cannery", "Fish Market", "Lighthouse Point", "Salt Flats", "Dune Road", "Ferry Slip", "Container Yard"],
    blurb: "A port, an industrial block and the sea on one side.",
  },
};
export const MAP_LIST: MapDef[] = [MAPS.zestafona, MAPS.bakurani, MAPS.ozeti];
/** Case-insensitive; accepts ids ("ozeti") and display names ("Ozeti"). */
export function mapById(id: string): MapDef | null {
  const key = id.trim().toLowerCase();
  return MAP_LIST.find((m) => m.id === key || m.name.toLowerCase() === key) ?? null;
}
```

### 3.8 Admin simulator API (WP4) — `src/lib/admin-sim/*`

`src/lib/admin-sim/types.ts` — **verbatim**
```ts
import type { Team } from "@/config/site";
import type { ControlZoneId, MapId } from "@/lib/terrain/types";

export const LIGHTINGS = ["Day Clear", "Day End Clear", "Dusk Overcast", "Night Clear"] as const;
export type Lighting = (typeof LIGHTINGS)[number];
export interface SimPlayer { steamId: string; name: string; team: Team; joinedAt: number; kills: number; deaths: number; cash: number; pingMs: number }
export interface SimBan { steamId: string; name: string; bannedAtUtc: string; bannedBy: string; reason: string; evidenceUrl: string | null; expiresAt: number }
export interface RotationEntry { map: MapId; experiences: string[]; lighting: Lighting; zoneAlternator: ControlZoneId; status: "now" | "next" | ""; denied: boolean }
export interface ScorePoint { t: number; scores: Record<Team, number> }
export interface MatchRecord { n: number; map: MapId; zone: ControlZoneId; lighting: Lighting; startedAt: number; endedAt: number; final: Record<Team, number>; winner: Team; timeline: ScorePoint[]; players: { steamId: string; name: string; team: Team; kills: number; deaths: number; seconds: number }[] }
export interface PlayerSession { steamId: string; name: string; from: number; to: number; matchN: number }
export interface AuditEntry { id: string; at: number; actor: string; mine: boolean; action: AdminCommand["t"]; target: string | null; result: "ok" | "refused"; detail: string; rcon: RconCall | null }
export interface RconCall { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body: unknown | null; contentType?: "application/json" | "text/plain" }
export interface SimSettings { scoreTick: number; rotationEnabled: boolean; rotationMode: "ordered" | "random" }
export interface SimState {
  seed: number; now: number; serverName: string; map: MapId; zone: ControlZoneId; mode: "King of the Hill"; lighting: Lighting;
  scores: Record<Team, number>; scoreCap: number; settings: SimSettings;
  players: SimPlayer[]; maxPlayers: number;
  match: { n: number; startedAt: number; endsAt: number };
  rotation: RotationEntry[]; rotationIndex: number;
  bans: SimBan[]; reserved: string[];
  history: MatchRecord[];          // most recent first, 72 h
  sessions: PlayerSession[];       // 72 h
  audit: AuditEntry[];             // most recent first
  broadcastLog: { at: number; text: string; to: string | null }[];
}
export type AdminCommand =
  | { t: "kick"; steamId: string; reason: string }
  | { t: "kill"; steamId: string }
  | { t: "ban"; steamId: string; reason: string; evidenceUrl: string | null; minutes: number }
  | { t: "unban"; steamId: string }
  | { t: "move"; steamId: string; team: Team }
  | { t: "whisper"; steamId: string; text: string }
  | { t: "broadcast"; text: string }
  | { t: "map.set"; map: MapId; zone: ControlZoneId; lighting: Lighting | null }
  | { t: "match.end" }
  | { t: "match.restart" }
  | { t: "lighting.set"; value: Lighting }
  | { t: "rotation.add"; entry: Omit<RotationEntry, "status" | "denied"> }
  | { t: "rotation.remove"; index: number }
  | { t: "rotation.move"; index: number; direction: "up" | "down" }
  | { t: "rotation.save" }
  | { t: "reserved.add"; steamId: string }
  | { t: "reserved.remove"; steamId: string }
  | { t: "settings.patch"; patch: Partial<SimSettings> }
  | { t: "reset" };
export interface TimedCommand { id: string; at: number; actor: string; cmd: AdminCommand }
```
`src/lib/admin-sim/engine.ts` (pure)
```ts
export const SIM_EPOCH = Date.UTC(2026, 8, 1, 4, 0, 0);   // 2026-09-01T04:00Z
export const MATCH_MS = 40 * 60_000;
export const DEFAULT_SEED = 0x5741_5244;                    // "WARD"
export function stateAt(seed: number, nowMs: number, commands: TimedCommand[], me: string): SimState;  // pure, O(players + commands + history)
export function toRcon(cmd: AdminCommand): RconCall | null; // exact method/path/body from openapi.json for the "What this sends" slide-over; null for "reset" (no endpoint — the audit row says "local only")
export function resetBoundary(nowMs: number): number;       // most recent 04:00Z ≤ now; commands before it are discarded
export function botName(seed: number, i: number): string;   // invented callsigns, never real names
```
Determinism rules: the base world is an analytic function of `nowMs` — match `n = floor((now − SIM_EPOCH) / MATCH_MS)`
unless a `match.end`/`match.restart` command at time T restarts the schedule from T; the map
rotates Zestafona → Bakurani → Ozeti per match (or by the visitor-edited rotation); scores are
monotone piecewise-linear curves with seeded breakpoints reaching a seeded final at match end
(winner 100, others 40–95); the roster is 13–40 bots with a seeded join/leave schedule per match;
history/sessions for the past 72 h are generated from the seed per match number. Commands are
perturbations: `kick` removes the player and re-adds them 90–300 s later (seeded); `ban` removes
until `expiresAt` (default 60 min); `move` changes team until the next match; `whisper`/`broadcast`
append to `broadcastLog`; `map.set` overrides until the next match; `lighting.set` persists until
the next rotation entry; `reset` discards all commands. Every command produces an `AuditEntry`
with `mine = actor === me`. Commands before `resetBoundary(now)` are ignored ("everything visitors
wrote resets at 04:00Z").

`src/lib/admin-sim/http.ts` (pure) — the in-browser RCON endpoint the API console targets.
```ts
export interface SimRequest { method: string; path: string; query?: Record<string, string>; headers?: Record<string, string>; body?: string | null }
export interface SimResponse { status: number; headers: Record<string, string>; body: string; ms: number }
export function handleRcon(req: SimRequest, ctx: { state: SimState; push: (cmd: AdminCommand) => void; configText: string; validate: (text: string) => unknown }): SimResponse;
```
Implements all 35 operations in `src/content/openapi.json` with response bodies shaped exactly
like the spec's schemas (`Status`, `Players`, `Capabilities`, `Bans`, `ReservedSlots`, `Audit`,
`Rotation`, `Catalog`, `Sponsor`, `Config`, `ConfigResult`, `Ok`, `Error`). Missing/invalid
bearer token → 401 `{ error: { code: "unauthorized", … } }` (any non-empty token is accepted;
the console shows "Any token works against the simulator"). Unknown route → 404 `Error`.

### 3.9 OpenAPI parser (WP4) — `src/lib/openapi/parse.ts`

```ts
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
export interface SchemaNode { type: string; properties?: Record<string, SchemaNode>; items?: SchemaNode; required?: string[]; enum?: string[]; nullable?: boolean; description?: string; format?: string; minimum?: number; maximum?: number; default?: unknown }
export interface Param { name: string; in: "path" | "query" | "header"; required: boolean; schema: SchemaNode; description?: string }
export interface Endpoint { id: string; method: HttpMethod; path: string; tag: string; summary: string; description?: string; params: Param[]; body: { contentType: string; schema: SchemaNode; required: boolean } | null; responses: { status: string; description: string; schema: SchemaNode | null }[]; auth: boolean; write: boolean }
export function parseSpec(spec: unknown): { info: { title: string; version: string; updated: string }; servers: { url: string; description: string }[]; tags: string[]; endpoints: Endpoint[] };
export function exampleFor(schema: SchemaNode): unknown;                  // deterministic example body from a schema
export function toCurl(e: Endpoint, base: string, token: string, values: Record<string, unknown>, body: unknown): string;
export function toFetch(e: Endpoint, base: string, token: string, values: Record<string, unknown>, body: unknown): string;
export function toPowerShell(e: Endpoint, base: string, token: string, values: Record<string, unknown>, body: unknown): string;
export function fillPath(path: string, values: Record<string, unknown>): string;
```

### 3.10 Config validator (WP5) — `src/lib/config-ini/validate.ts`

```ts
export interface IniIssue { line: number | null; level: "error" | "warning"; code: string; message: string; key?: string }
export interface IniValidation { ok: boolean; issues: IniIssue[]; sections: { name: string; keys: { key: string; value: string; line: number }[] }[]; stripped: string[]; warnings: string[] }
export function parseIni(text: string): IniValidation["sections"];
export function validateIni(text: string): IniValidation;   // unknown section/key → stripped (warning); out-of-range → error; BindAddress=0.0.0.0 with Password and no PasswordHash → error "network listener needs PasswordHash"; bEnabled=true with BindAddress 0.0.0.0 → warning "TLS cert and key required"; MinimumRequiredPlayers > MaxPlayers → warning; ScorePeriod outside 18–30 → error; RotationEntries parse check
export const INI_KEYS: { section: string; key: string; default: string; applies: string; description: string; type: "bool" | "int" | "string" | "list"; range?: [number, number] }[];
```

### 3.11 Brand mark data (WP6) — `src/lib/brand/mark.ts`

```ts
export const MARK_VIEWBOX = "0 0 64 64";
export const MARK_PLATE = { x: 4, y: 4, w: 56, h: 56, rx: 8 };
export const MARK_CHEVRON = "M16 40 L32 18 L48 40";
export const MARK_PIN = { cx: 32, cy: 40, r: 5, core: 1.5 };
export const MARK_TICKS: [number, number][] = [[12, 50], [52, 50]];

/** String SVG of the mark for OG images and icon routes (no React). Colours are literal strings. */
export function markSvg(opts: {
  size: number; plate: string; plateStroke: string; stroke: string; accent: string; core: string;
  ticks: string | null; chevronWidth?: number;
}): string {
  const { size, plate, plateStroke, stroke, accent, core, ticks, chevronWidth = 6 } = opts;
  const tickMarks = ticks
    ? MARK_TICKS.map(([x, y]) => `<rect x="${x - 1}" y="${y - 1}" width="2" height="2" fill="${ticks}"/>`).join("")
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">` +
    `<rect x="${MARK_PLATE.x}" y="${MARK_PLATE.y}" width="${MARK_PLATE.w}" height="${MARK_PLATE.h}" rx="${MARK_PLATE.rx}" fill="${plate}" stroke="${plateStroke}" stroke-width="2"/>` +
    `<path d="${MARK_CHEVRON}" fill="none" stroke="${stroke}" stroke-width="${chevronWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${MARK_PIN.cx}" cy="${MARK_PIN.cy}" r="${MARK_PIN.r}" fill="${accent}"/>` +
    `<circle cx="${MARK_PIN.cx}" cy="${MARK_PIN.cy}" r="${MARK_PIN.core}" fill="${core}"/>` +
    tickMarks +
    `</svg>`
  );
}
```
The whole file is verbatim (constants and function), so WP2 can create it under the
create-if-missing rule for its OG routes.

### 3.12 UI primitive APIs (WP6) — `src/components/ui/*`

```ts
// kbd.tsx
export function Kbd(props: { children: React.ReactNode; className?: string }): JSX.Element;  // mono 11px, 1px border, renders "⌘"/"Ctrl" via useModifierKey()
export function useModifierKey(): "⌘" | "Ctrl";   // "Ctrl" during SSR and the first client render; flips to "⌘" in a mount effect on Apple platforms, so server and client markup always match

// dialog.tsx — native <dialog>, showModal() (the top layer already makes the rest inert), focus first control (or initialFocusRef), restore focus on close, Esc closes
export function Dialog(props: { open: boolean; onClose: () => void; title: string; description?: string; size?: "sm" | "md" | "lg"; children: React.ReactNode; footer?: React.ReactNode; initialFocusRef?: React.RefObject<HTMLElement | null> }): JSX.Element;
export function ConfirmDialog(props: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: React.ReactNode; confirmLabel: string; tone?: "danger" | "primary"; reasonField?: { label: string; value: string; onChange: (v: string) => void; required?: boolean } }): JSX.Element;

// sheet.tsx — side="right" (desktop panel, 360px) | "bottom" (mobile; snap: "peek" 56px | "half" 50vh | "full" 90vh, tapping the handle cycles, vertical drag optional). role="dialog" when modal, else role="region".
export function Sheet(props: { open: boolean; onClose: () => void; side: "right" | "bottom"; title: string; modal?: boolean; snap?: "peek" | "half" | "full"; onSnap?: (s: "peek" | "half" | "full") => void; handleBadge?: number; children: React.ReactNode }): JSX.Element;

// tabs.tsx — WAI-ARIA tabs for in-page panels (request filters, Manage dialog), roving tabindex, arrow keys. Route-level navigation (the dashboard) is a <nav aria-label> of links with aria-current, never Tabs.
export function Tabs(props: { value: string; onChange: (v: string) => void; items: { value: string; label: React.ReactNode; badge?: number }[]; "aria-label": string; size?: "sm" | "md"; className?: string }): JSX.Element;
export function TabPanel(props: { value: string; active: string; children: React.ReactNode; className?: string }): JSX.Element;

// tooltip.tsx — wraps one focusable child; role="tooltip" element shown after 400ms hover / immediately on focus; aria-describedby
export function Tooltip(props: { label: string; side?: "top" | "right" | "bottom" | "left"; children: React.ReactElement }): JSX.Element;

// copy-button.tsx — icon swaps to Check for 2s, announces "Copied" via LiveRegion; falls back to a selectable input when navigator.clipboard is unavailable
export function CopyButton(props: { text: string; label?: string; size?: "sm" | "md"; variant?: "ghost" | "secondary" | "chip"; className?: string; onCopied?: () => void }): JSX.Element;

// callout.tsx
export function Callout(props: { tone?: "note" | "warning" | "danger"; title?: string; children: React.ReactNode; className?: string }): JSX.Element;

// radio-cards.tsx — role="radiogroup", arrow keys move selection
export function RadioCards<T extends string>(props: { name: string; value: T; onChange: (v: T) => void; options: { value: T; title: string; body: string; icon?: React.ReactNode }[]; columns?: 1 | 2; "aria-label": string }): JSX.Element;

// toast.tsx — zustand store; <Toaster/> mounted once in the root layout; its region is aria-live="off" and every toast calls announce() once, so LiveRegion is the only live region on the page
export function toast(message: string, opts?: { tone?: "default" | "ok" | "warn" | "danger"; action?: { label: string; onClick: () => void }; durationMs?: number }): void;
export function Toaster(): JSX.Element;

// live-region.tsx — one visually-hidden aria-live="polite" region; announce() coalesces messages 300ms apart
export function LiveRegion(): JSX.Element;
export function announce(message: string): void;

// misc
export function Spinner(props: { size?: number; className?: string }): JSX.Element;
export function Skeleton(props: { className?: string }): JSX.Element;
export function VisuallyHidden(props: { children: React.ReactNode; as?: "span" | "div" }): JSX.Element;
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element;
export function Field(props: { label: string; htmlFor: string; helper?: string; error?: string; trailing?: React.ReactNode; children: React.ReactNode }): JSX.Element;
export function CodeInput(props: { value: string; onChange: (v: string) => void; onSubmit?: () => void; error?: string; autoFocus?: boolean; id: string }): JSX.Element;  // 6 mono cells (`flex-1 min-w-0 max-w-12`, so six fit in 320 px), uppercase, paste support, auto-advance, Backspace moves back; Enter calls onSubmit when the value is a valid code OR a reserved code (`DEMO`, 4 chars)
```

### 3.13 Map UI exports consumed by other packages (WP3) — `src/components/map/*`

```ts
// MapPreview.tsx — server-renderable static scene (no hooks, no "use client"). Terrain is an
// <img src={terrainUrl(state.settings.map, { zone, size })}> (by URL, never a data URI) under the
// same React SVG layer components the live app uses; geometry from fitToBox so the live app can
// replace it in place. `priority` sets fetchPriority="high" on the terrain image (the LCP element).
export function MapPreview(props: { state: RoomState; size?: number; showGrid?: boolean; priority?: boolean; className?: string; title?: string }): JSX.Element;

// HeroFrame.tsx ("use client") — renders `children` (the server-rendered <HeroStatic/>) until the
// dynamically imported HeroPlayer chunk has loaded, then swaps it in place (same box, no CLS).
// Under prefers-reduced-motion, or when the frame is not in the viewport, it never loads the
// player. Owns `next/dynamic(() => import("./HeroPlayer"), { ssr: false })`.
export function HeroFrame(props: { children: React.ReactNode; className?: string }): JSX.Element;
// HeroPlayer.tsx ("use client", default export) — owns its state; plays HERO_TIMELINE on a loop;
// renders the live SVG layers; "Take over" overlay link to /demo. Never imported by a server component.
export default function HeroPlayer(props: { className?: string }): JSX.Element;
// HeroStatic.tsx — server component: the finished plan as <MapPreview priority/>, the LCP element and the no-JS fallback.
export function HeroStatic(props: { className?: string }): JSX.Element;

// MapAppLoader.tsx ("use client", default export) — the only module that dynamically imports
// MapApp: `const MapApp = dynamic(() => import("./MapApp"), { ssr: false, loading: () => null })`.
// Server pages render <MapAppLoader …>{staticShell}</MapAppLoader>; `children` stays visible until
// MapApp calls `onReady` in its first effect, then gets the `hidden` attribute (same box, no CLS).
// Reads nothing from the URL itself.
export default function MapAppLoader(props: MapAppProps & { children: React.ReactNode }): JSX.Element;
// MapApp.tsx ("use client", default export) — never imported by a server component.
export interface MapAppProps { mode: "room" | "demo" | "activity"; code: string; joinHint?: { team?: string; squad?: string }; activity?: { openExternal: (url: string) => void }; onReady?: () => void }
export default function MapApp(props: MapAppProps): JSX.Element;
```

### 3.14 Route map

| Route | Type | Group / layout | Metadata (title · description) | Robots |
|---|---|---|---|---|
| `/` | static | `(site)` — SiteHeader/SiteFooter, `vignette` | default title `wardogs.tech — the tactical map every Wardogs server needs` · site.description | index |
| `/?frame_id=…` | `redirects()` → `/activity` (query preserved; `has: [{ type: "query", key: "frame_id" }]`, `permanent: false`) — Discord opens the root of the URL mapping | — | — | — |
| `/create` | static shell, client form (reads `?t=`, `?map=`, `?zone=` from `window.location` after mount) | `(app)` chromeless | `Open a war room` · "Pick your team, map and control zone. Open a shared war room in one click." | index |
| `/join` | static shell, client form (reads `?code=` after mount) | `(app)` | `Join a war room` · "Enter a six-character code and your callsign." | index |
| `/room/[code]` | dynamic (`const { code } = await params`; client-rendered app in a static shell) | `(app)` | `War room` · "A shared tactical map. Open it in your Discord voice channel." | **noindex** |
| `/r/[code]` | redirect → `/room/[code]` (next.config `redirects()`, permanent) | — | — | — |
| `/demo` | static shell (server-rendered `MapPreview` of the seed plan) + client app | `(app)` | `The live demo` · "A shared map with people in it right now. No sign-in. Resets every five minutes." | index |
| `/demo/admin` | static | `(admin)` — `AdminStrip`, no SiteHeader | `Dashboard demo` · "Run a Wardogs server from one dashboard. An early build, open to anyone." | index |
| `/demo/admin/live`, `/rotation`, `/history`, `/bans`, `/audit` | static shells + client dashboard | `(admin)` with the dashboard nav | `Live · Dashboard demo` etc. | noindex |
| `/activity` | static shell + client (Discord SDK) | `(app)` | `Activity` | noindex |
| `/add` | dynamic (`const { to } = await searchParams`; `redirect()` when configured) | `(site)` | `Add to Discord` | noindex |
| `/dev` | static | `(site)` + docs shell (UNOFFICIAL strip) | `Run your server` · "Everything for running a Wardogs dedicated server in one place." | index |
| `/rcon-reference` | static | `(site)` docs | `Wardogs Server Reference (Unofficial)` · "The RCON HTTP API and ServerSettings.ini, every endpoint and key documented." | index |
| `/rcon-api` | static shell + client console (reads `?endpoint=` after mount) | `(site)` docs; route-specific CSP (§7.6) | `API Console` · "Browse every RCON endpoint with live examples. Try it against the in-browser simulator or your own server." | index |
| `/discord-help` | static | `(site)` docs | `Discord help` · "The map will not launch in a voice channel: the permission that causes it, temp channels, and the one-minute test." | index |
| `/map-guide` | static | `(site)` docs | `Map guide` · "How this site draws its maps, the coordinate system, grid references and custom uploads." | index |
| `/openapi.json` | route handler (GET) | — | `application/json`, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` | — |
| `/ServerSettings.ini` | route handler (GET) | — | `text/plain; charset=utf-8`, `Content-Disposition: attachment; filename="ServerSettings.ini"` | — |
| `/terrain/[file]` | route handler (GET; `<map>.svg`, §3.7) | — | `image/svg+xml`, immutable cache | — (robots disallow `/terrain/`) |
| `/terms` | static | `(site)` | `Terms of Service` | index |
| `/privacy` | static | `(site)` | `Privacy Policy` | index |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image`, `/twitter-image`, `/icon`, `/apple-icon` | metadata routes | — | §6 | — |
| not-found | static, outside every group | composes `SiteHeader`/`SiteFooter` itself | `Not found` | noindex |

Layouts:
- `src/app/layout.tsx` (WP6; root): fonts, `<Toaster/>`, `<LiveRegion/>`, JSON-LD WebSite. **No
  skip link here** — each group layout renders its own so app routes are not left with a dead
  `#main` target.
- `src/app/(site)/layout.tsx` (WP6): `Skip to content` → `#main`, SiteHeader, `<main id="main">`,
  SiteFooter, `vignette`.
- `src/app/(app)/layout.tsx` (WP3): chromeless. `Skip to map` → `#map`; `<main id="main"
  class="flex min-h-dvh flex-col">` — **no fixed height and no overflow rule**, because `/create`,
  `/join` and `/activity` are ordinary scrolling documents. `MapApp` owns `h-dvh overflow-hidden`
  on its own root. `export const viewport` adds `interactiveWidget: "resizes-content"`.
- `src/app/(admin)/layout.tsx` (WP4): `Skip to content` → `#main`, `AdminStrip`, `<main id="main"
  class="min-h-dvh">`; no SiteHeader/SiteFooter. Route groups `(app)` and `(admin)` both contain a
  `demo` segment; that is legal because no two files resolve to the same URL (`/demo` vs
  `/demo/admin/**`).
- Docs pages use `src/components/docs/DocsShell.tsx` (§3.15) inside `(site)`.
- `src/app/not-found.tsx` (WP6) sits outside every group and composes `SiteHeader`/`SiteFooter`.
- No `loading.tsx` anywhere: a `demo/loading.tsx` would also wrap `/demo/admin/*`, and every
  route already ships a static shell.

**Next 16 rules (build-breakers; apply everywhere):**
- `params` and `searchParams` are Promises: `const { code } = await params;`,
  `const { to } = await searchParams;` (typed via the global `PageProps<"/add">`).
- `next/dynamic(…, { ssr: false })` is legal only inside a `"use client"` file. Server pages
  import `MapAppLoader`, `HeroFrame` and `DashboardLoader` (§4.8), never `MapApp`, `HeroPlayer` or
  a dashboard panel.
- No client island on a statically prerendered page calls `useSearchParams` (it needs a
  `<Suspense>` boundary or the build fails with "Missing Suspense boundary"). The pattern is
  `useEffect(() => setParams(new URLSearchParams(window.location.search)), [])`; render the
  no-param state first.
- Route handlers that read the query are dynamic; set cache headers explicitly.
- Run `npx next typegen` after adding a route so `PageProps<"/…">` exists for it.

### 3.15 Docs shell API (WP5) — `src/components/docs/*` and `src/content/dev/types.ts`

```ts
// DocsShell.tsx (server component): the UNOFFICIAL strip, SiteHeader, the docs header row
// (eyebrow left; mono `Updated {updated} · v{version}` right), the three-column layout with the
// TOC (a small client scroll-spy island inside), and the docs footer line (§4.9).
export function DocsShell(props: {
  eyebrow: string; unofficialLine: string; title: string; intro?: React.ReactNode;
  toc: { id: string; title: string }[];
  /** Defaults: site.updated / site.version. API pages pass parseSpec(openapi).info.updated / .version so the header matches the content. */
  updated?: string; version?: string;
  children: React.ReactNode;
}): JSX.Element;
export function DocSection(props: { id: string; title: string; children: React.ReactNode }): JSX.Element; // <section aria-labelledby> with the h2 and its hover "#" anchor link
// CodeBlock.tsx (server component; the CopyButton inside is a client island)
export function CodeBlock(props: { code: string; lang?: string; filename?: string; wrap?: boolean; className?: string }): JSX.Element;
// EndpointTable.tsx ("use client"): the generated endpoint table on /rcon-reference; takes WP4's parsed endpoints as props
export function EndpointTable(props: { endpoints: Endpoint[] }): JSX.Element;

// src/content/dev/types.ts
export interface DocSectionData { id: string; title: string; body: React.ReactNode }
export interface Doc { slug: string; title: string; unofficialLine: string; eyebrow: string; intro: React.ReactNode; sections: DocSectionData[]; jsonLd: "TechArticle" }
```
WP4's `/rcon-api` page is a thin `(site)/rcon-api/page.tsx` written in Phase 2 that renders
`<DocsShell …><ApiConsole/></DocsShell>`; in Phase 1 WP4 builds and tests `ApiConsole` on its own.

---

## 4. Page-by-page spec

Conventions for this section: **Copy** blocks are final. `display` headlines are written in
sentence case here and rendered uppercase by the utility. "Eyebrow" = `eyebrow` utility.
Every page: one `<h1>`, landmarks (`header nav main footer`), all controls labelled, `focus-visible`
visible, no colour-only state. Every interactive element listed has a keyboard path.

### 4.1 Home `/` (WP6; imports `HeroFrame`/`HeroStatic` from WP3)

Layout: `(site)`. Sections in order:

**1. Hero** — contained, `<ContourBackdrop />` top-right (§2.5), `pt-16 lg:pt-24`. Two columns at `lg`:
`grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12`; below `lg` stack with the map first (aspect
4:3), copy centred as upstream mobile.

- Left: eyebrow `Discord Activity · Free · Fan-made`; H1 `display display-1`:
  **The tactical map for your Wardogs Discord**; lede: **Open it in a voice channel. Everyone in
  the call draws on the same map.**
- CTA stack: primary lg `Add to your server` (Discord glyph) → `/add`. Under it, a 14 px
  underlined link: `Not an admin? Add it to your own account instead.` → `/add?to=account`.
  Then two secondary buttons in a row: `Open a war room` (Map icon) → `/create`,
  `Join a war room →` → `/join`. Beside the join button an inline "Have a code?" form: a
  `CodeInput`-lite single `Input` (`aria-label="War room code"`, placeholder `ABC234`, mono,
  uppercase) with an icon submit; Enter navigates to `/room/<CODE>` when
  `isRoomCode(normalizeCode(v))` (pure regex from `src/lib/room/code.ts` — no zod on the home
  page, §7.3), to `/demo` for `DEMO`, otherwise shows the inline error `Codes are 6 letters or
  digits, never 0, O, 1 or I.`.
- When `site.discord.clientId` is empty (build-time): the primary CTA becomes `Try the live
  demo` → `/demo` and `Add to your server` becomes a secondary button with a `Setup required`
  Badge (tone warn) → `/add` (which renders the setup page).
- Rejoin card (client island `src/components/home/RecentRooms.tsx`, WP6; reads
  `listRecentRooms()` from `src/lib/storage/rooms.ts`, a zod-free module — §5.4): when local
  history exists, a tier-1 card
  under the CTAs: eyebrow `Rejoin`, rows `X5GM4Q · Lonestar · Zestafona · 12 min ago` → `/room/X5GM4Q`,
  max 3, with a `Forget` ghost icon button per row (confirm not needed). Hidden until hydrated
  (no layout shift: reserve nothing; it appears below the CTAs).
- Right: `<HeroFrame><HeroStatic /></HeroFrame>` inside a tier-3 frame: 16:10 aspect,
  `rounded-xl border-line-strong shadow-panel hud-corners` plus amber ground glow
  `shadow-[0_40px_120px_-40px_rgba(255,160,40,0.25)]`. `HeroStatic` is server-rendered (terrain
  `<img>` by URL with `fetchpriority="high"` — the LCP element); `HeroFrame` swaps in the lazily
  loaded `HeroPlayer` chunk in place, so the home page's first-load JS carries no terrain
  generator, reducer or scenario (§7.3).
  The frame's own chrome: a 32 px top bar (LogoMark 16, mono `WAR ROOM DEMO`, LIVE pip with
  `scanlines`), no rail, no panels. The scene draws the seed plan node by node over ~5 s, then
  loops eight scripted events every 2.5 s (a claim, a marker, a ping, an arrow, a delivery…).
  Overlay bottom-right: a secondary sm button `This is the real app — take over →` → `/demo`.
  Under `prefers-reduced-motion`: the finished plan, no animation. The frame is focusable
  (`tabindex=0`, `aria-label="Live preview of the shared map; press Enter to open the demo"`,
  Enter → `/demo`). `HeroStatic` renders on the server so the LCP element exists before hydration.

**2. How it works** — `id="how"`, `scroll-margin-top: 96px`. Eyebrow `How it works`; H2
`display display-2` **Three clicks to a shared map**. Three tier-1 step cards with a ghost
numeral (`display` 56 px at 10 % opacity, top-right):
- `01` **Add it to your server** — `One click on the button above. That is the setup.` Card
  media: a primary button mock `Add to your server` (non-interactive, `aria-hidden`).
- `02` **Press Start an Activity** — `The rocket button in a voice call.` Card media: an
  original illustration (inline SVG, our own drawing) of a voice-call toolbar with three round
  buttons, the middle one a rocket, and a tooltip `Start an Activity`. Not a Discord screenshot.
- `03` **Pick wardogs.tech** — `Everyone in the call lands in the same room.` Card media: the
  app's own top bar mock (`WAR ROOM ABC234 · LIVE · 4 in room`).
At 390 px the three cards stack (§2.9).

**3. Exit cards** — three tier-2 link cards (eyebrow, lucide icon, `display display-3` title,
body, arrow top-right); copy as upstream:
- eyebrow `Just looking` · Eye icon · **The live demo** · `A shared map with people in it right
  now. No sign-in.` → `/demo`
- eyebrow `Run a server` · BookOpen · **Docs for server owners** · `The RCON reference, the
  config guide and an API console. Public, no account.` → `/dev`
- eyebrow `Coming soon` · ShieldCheck · **Server admin in the same Discord** · `Live players,
  match history, bans with evidence. In closed testing; click around the preview.`
  → `/demo/admin`

**4. FAQ** — contained, `max-w-3xl`. Eyebrow `Questions`; H2 **Before you add it**. Five
`<details>` items (native disclosure, summary styled Barlow 600 17 px, chevron rotates):
1. **Do my squadmates need to install anything?** — `No. One admin adds it to the server once.
   Everyone else presses Start an Activity in the voice call, or opens the link in a browser.`
2. **Does it work outside Discord?** — `Yes. Open a war room here, copy the link, paste it
   anywhere. The Discord Activity is the convenient way in, not the only one.`
3. **Do you store our plans?** — `Plans live in your browser and, if a relay is configured,
   in the relay's memory while the room is active. There is no account and no database. Export
   a PNG or a plan file if you want to keep one.`
4. **Which maps?** — `Zestafona, Bakurani and Ozeti as schematic maps drawn by the site, with
   the control zones in place. Commanders can upload their own map image.`
5. **Is it free?** — `Yes. Fan-made, no ads, no sign-up. Not affiliated with Bulkhead or Team17.`
FAQ JSON-LD (§6.4) mirrors these exactly.

Footer (WP6, `SiteFooter`): 1 px accent top rule at 30 % opacity; lockup + `v{site.version}`
left; `Fan-made. Not affiliated with Bulkhead or Team17.` centre in mono 12 px `text-fg-muted`
(never `fg-faint`); links right:
`Community Discord` (external), `GitHub` (external), `Terms`, `Privacy`.

States: no JS → hero shows `HeroStatic` and the code field still submits as a GET form to
`/join?code=` (progressive enhancement: the form's `action="/join"`, `name="code"`). Errors: none.
A11y: hero frame described; FAQ uses native `<details>`; the three steps are a `role="list"`.

### 4.2 `/demo` (WP3)

Layout: `(app)` chromeless. **Server shell** (`src/app/(app)/demo/page.tsx`, static): the app
top bar with the `DEMO` code chip and a `LIVE DEMO` badge, the tool rail skeleton (nine grey
40 px squares), the panel headers `Requests` / `Roster`, and — as the map area itself —
`<MapPreview state={demoSeedState(0)} priority />`: the seed plan, server-rendered, terrain by
URL. That image is the LCP element and it is what paints with JavaScript disabled. `<noscript>`:
`The map needs JavaScript to be live. What you see is the seed plan; turn it on to draw with
everyone else.` The shell is the child of `<MapAppLoader mode="demo" code="DEMO">` (§3.13),
which mounts the live app in the same box and hides the shell once `MapApp` is ready; the live
app's first viewport is `fitToBox` of the same box, so the swap is in place (no CLS).

Demo semantics (all in `src/lib/map/scenario.ts` + `src/store/room.ts` demo mode):
- Room: `RoomState.code` is `DEMO`; Lonestar, Zestafona, Default zone, `drawAccess: "everyone"`,
  squad mode off. Everything is keyed by the **epoch index** `epochIndex(now)` (five-minute
  epochs on the wall clock): the seed is `demoSeedState(epochIndex)`, the relay room is
  `demoRelayRoom(now)` = `DEMO-<epochIndex>`, and bot ops carry deterministic meta
  (`timelineOps(epochIndex)`), so every visitor's local copy of a bot op is identical and the
  same op arriving over the relay is stale by rev — no double application, no drift.
- Seed plan (`demoSeedState`): friendly FOB at (0.18, 0.80) labelled `FOB DELTA`; Rally at
  (0.34, 0.60); LZ at (0.40, 0.52) labelled `LZ BRAVO`; OBJ at the zone centre (0.50, 0.47)
  labelled `DEFAULT`; enemy FOB (Valkyra) at (0.80, 0.22) labelled `AUSTIN`; enemy troops
  (Manticore) at (0.63, 0.36) labelled `CHICAGO`; Danger at (0.58, 0.41) radius 0.05 labelled
  `MG NEST`; a yellow arrow (0.30, 0.66)→(0.47, 0.50); two blue strokes along the west approach;
  text `Hold the ridge` (md, white) at (0.42, 0.30). Requests: Fuel open by Boston at the LZ;
  Medical open by Rook at (0.52, 0.49), urgent; Ammo claimed by Krieger (by Ossian) at the rally,
  ETA 60 s. Roster: Ossian (commander, infantry, yellow), Krieger (pilot, green), Boston (medic,
  blue), Rook (recon, red), all `online: true`, ids from `DEMO_BOT_IDS`.
- Bots act on `DEMO_TIMELINE` (offsets from `epochStart(now)`, so every visitor sees the same
  bots at the same moment): 8 s Krieger claims Fuel (ETA 60); 14 s Rook places enemy troops
  (Valkyra) at (0.70, 0.30) `2 squads`; 22 s Boston pings (0.44, 0.54); 30 s Ossian draws a
  yellow arrow (0.47, 0.50)→(0.60, 0.40); 45 s Krieger delivers Fuel; 60 s Boston adds urgent
  Medical at (0.52, 0.49); 75 s Rook moves the troops marker to (0.66, 0.33); 95 s Ossian adds
  text `Push at 2:00`; 120 s Krieger claims Medical (ETA 30); 140 s delivers it; 160 s Ossian
  pings the zone centre; 180 s Rook adds Danger at (0.75, 0.50) r 0.04 `Mortars`; 210 s Boston
  adds Ammo at the rally; 240 s Krieger claims; 270 s delivers. At 300 s the epoch rolls: the
  director leaves the old relay room, boots the next epoch's seed and joins `DEMO-<n+1>` — a
  fresh room for everyone, so the visitor's edits and other visitors' edits are gone by
  construction. Nothing is "reset" on the relay; the old room simply idles out.
- The visitor joins as **member** (`drawAccess` is `everyone`, so they draw and place markers
  and requests at once) with the callsign from `wardogs:identity` (or `Operator XXXX` generated
  once). No Manage: the commander is Ossian, a bot, and shared settings (map, zone, clear
  everything, kicks) are not up for grabs in a room shared with strangers. The bots have presence
  (`botPresence(now)`, fed by the director every 10 s) so the roster shows them online; the
  single-writer's housekeeping is **off** in demo mode (no successor promotion, no pruning).
- Top bar centre shows `DEMO · resets in 4:32` (mono, ticking) and a ghost sm button
  `Clear mine` (tooltip `Removes everything you added. Bots and other visitors are untouched.`):
  emits `node.remove` for every node I authored and `request.remove` for my requests, in
  batches — honest and visible to everyone, unlike a local rewind that the next sync would undo.
- Bot ops enter through `ingest()` like remote ops, so they animate as remote edits and
  announce via the live region (`Krieger claimed Fuel`).
- Sync: the demo room uses the normal transport with the relay room `demoRelayRoom(now)`, so
  two tabs (LOCAL) or two devices (relay) share visitor edits until the epoch rolls. The
  BroadcastChannel name is the relay room name too (`wardogs:DEMO-<n>`), so LOCAL tabs roll the
  same way.
- Persistence: the demo never writes `wardogs:room:DEMO`.
- Desktop: a sticky bar above the bottom-right controls, `Like it? Open your own war room →` →
  `/create?map=zestafona&zone=default`. Under 768 px it is a dismissible chip in the top bar
  (`Open yours →`, dismissal in `wardogs:prefs.demoChipDismissed`), never a bar over the map.
- The demo is the one place the schematic-map note is always visible in the bottom-left:
  `Schematic map — layout is approximate.`

Testing hooks: `window.__wardogs = { now: () => number }` is consulted by the demo clock and the
epoch maths so Playwright can fake time with `page.clock` (`demo.spec` calls
`page.clock.setFixedTime(epochStart)` **before** navigating, then `runFor`); the store exposes
`useRoomStore.getState()` in non-production builds.

### 4.3 War room `/room/[code]` (WP3) — the map app

Route: `src/app/(app)/room/[code]/page.tsx` — `const { code } = await params;` validated with
`RoomCodeSchema` (uppercased); `DEMO` → `redirect("/demo")`; invalid → `notFound()`. Server shell
as in 4.2 but with a `Skeleton` map area (the plan lives client-side) and the real code in the
chip, wrapped in `<MapAppLoader mode="room" code={code}>`. `joinHint` (`?t=`, `?s=`) is read by
`MapApp` from `window.location` after mount, not from `searchParams`.

#### 4.3.1 Boot sequence (`src/store/room.ts` + `MapApp`)

1. Load `wardogs:identity` (the client id is minted on first use and never changes; the
   callsign may be empty). No callsign → **Join dialog** (native `<dialog>`, cannot be
   dismissed): title `Join war room {CODE}`, callsign `Input` (placeholder generated
   `Operator 41E3`, "dice" button regenerates), focus grid (six chips, optional), squad select
   when the room's settings (if known) have `squadMode`, primary `Join`. Saves identity.
2. Load `wardogs:room:<CODE>` → `hydrate(snapshot)` (or start with `null`).
3. `createTransport({ relayUrl: resolveRelayUrl(), getState })` → `join(room, identity, seq,
   snapshot)`; status → pill. `room` is the code, or `demoRelayRoom(now)` in demo mode.
4. If no local state after 1,500 ms and no snapshot arrived: **empty state** (§4.3.9).
5. On snapshot: `state = mergeStates(local, remote)`. Then announce self: if `roster[me]`
   exists → `roster.update { online: true, callsign, focus, ink }` (keeps role, `canDraw`,
   `drawRequested`, `squad`); else `roster.upsert` (role `member`; the creator is already
   `commander` from `/create`). If `settings.squadMode` and `me.squad` is unset → a small
   squad-pick Dialog listing `settings.squads` before the first edit (the joiner's squad may
   only be known once sync reveals `squadMode`).
6. Persist on every change (debounced 500 ms) + update `wardogs:rooms` index.
7. On `pagehide`: `transport.leave()` (`bye`) — **no roster op**. `online` is derived from
   presence (§5.5), so another tab of the same browser keeps the member online, and a crashed
   tab is flipped to `online: false` by the single-writer after 60 s.
8. `ingest` watches for `roster.remove` of `me.client`: the store sets `kicked = true`, the UI
   shows the `You were removed from this room` Dialog (§4.3.5) and leaves the transport.

#### 4.3.2 Layout (≥ 768 px)

```
┌ TopBar 48px ──────────────────────────────────────────────────────────────┐
│ [Mark] WAR ROOM [X5GM4Q ⧉] [COPY LINK ⌘C] [MANAGE]   ZESTAFONA · DEFAULT   [LIVE · 4] [Brief] [Ossian ▾] [CMD] │
├ Rail 80 ┬ Map (flex-1, bg-bg-0) ───────────────────────────┬ Panels 320 ─┤
│   V     │                                                  │ REQUESTS 3  │
│   P     │                                                  │ ALL OPEN…   │
│   …     │            <svg role=application>                │ cards…      │
│   M     │                                                  ├─────────────┤
│  ↶ ↷    │                                                  │ ROSTER 5    │
│ INK ●●● │                                     [+][−][0][⛶] │ tallies     │
│ FRIENDLY│                                     [#][◎][▤]    │ COMMANDER   │
│ ENEMY … │ v0.2.0 · Schematic   [🔊][OUR DISCORD][CONTROLS & HELP] │ TEAM     │
└─────────┴──────────────────────────────────────────────────┴─────────────┘
```
Panels column is collapsible (`HIDE ≫` in the Requests header; a `≪ PANELS` tab reopens it);
the rail is never hidden on desktop except in Brief mode.

**TopBar** (`hud-corners` on the bar): LogoMark 22 → `/` (in activity mode a plain image, §4.7);
mono `WAR ROOM`; code chip (mono 14, `bg-bg-2`, copy icon; click copies the code; flashes
COPIED); `COPY LINK` chip button with kbd hint (`⌘C`) copies `${site.url}/join?code=CODE`;
`MANAGE` (command roles only) opens the Manage dialog; centre `ZESTAFONA · DEFAULT` (map · zone;
`CUSTOM MAP` when uploaded); right: **sync pill** (see below), `Brief` toggle (icon button,
`aria-pressed`), callsign menu button (`Ossian ▾`: Change callsign, Change focus, Ink colour,
Leave room), role badge `CMD` (accent) / `CO-CMD` (accent outline) / none.

Collapse order as the bar narrows (container queries on the bar): 1) kbd hints go below
1100 px; 2) the `WAR ROOM` label goes below 1000 px; 3) the centre text goes below 900 px — map ·
zone move into the code chip's tooltip; 4) the callsign collapses to a 28 px initial avatar below
820 px. Nothing wraps and the bar never scrolls.

Sync pill states (Badge with a 6 px dot):
- `LIVE · 4 in room` — tone ok, dot `animate-pulse-slow` + `scanlines`; tooltip `Connected to the relay. Everyone with the code sees this map.`
- `LOCAL · this browser` — tone warn; tooltip `No relay configured. Tabs in this browser share the map; other devices do not. Set NEXT_PUBLIC_RELAY_URL to go live.`
- `RECONNECTING…` — tone danger, blinking dot; tooltip `Relay connection dropped. Your edits are queued (n) and will send when it returns.`
- `CONNECTING…` — tone muted, first 3 s only.

**Rail** (80 px wide; `role="toolbar" aria-label="Drawing tools" aria-orientation="vertical"`,
roving tabindex, Home/End; `overflow-y-auto scrollbar-thin` so it scrolls on short viewports;
the version label is `sticky bottom-0`): one column of 40 px icon Buttons, groups separated by
1 px dividers — `select V`, `pen P`, `arrow A`, `line L`, `circle C`, `rect R`, `text T` |
`measure M` | `undo ⌘Z`, `redo ⌘⇧Z`. Each tool has `aria-pressed`, `aria-keyshortcuts`, a
`Tooltip` (`Pen — P`) and the hotkey in mono 9 px bottom-right. Then `INK` (label-mono) with six
swatches in a 3×2 grid — 40 px hit areas around a 20 px visual disc (`role="radiogroup"
aria-label="Ink colour"`, each `aria-label="Blue"` etc., selected = 2 px `text-0` ring offset
2 px). Then three palettes of 36 px two-column tiles (glyph + mono 9 px short label; selecting a
tile sets `tool = "marker"` + `markerKind`, `aria-pressed`): `FRIENDLY` (header with a dot in the
team colour and the team name as sub-label; tiles FOB RALLY LZ OBJ, all drawn in `friendly`
blue), `ENEMY` (header with a two-chip faction toggle — the `enemyTeams(team)` names, coloured
`enemy-a` / `enemy-b`, `role="radiogroup" aria-label="Enemy faction"`, sets `enemyTeam` in the
store; tiles FOB TROOPS drawn in the selected faction's tone), `MARK` (`warn`; tiles DANGER PIN).
Bottom of the rail: mono `v{site.version}`.

When `canDraw()` is false the drawing tools and palettes render disabled with a lock glyph and
one `Ask to draw` chip under the rail (§4.3.7).

**Map surface**: `<svg id="map" role="application" aria-label="Tactical map, Zestafona"
tabindex="0" aria-describedby="map-help">` filling the area; `touch-action: none`; a `<canvas>`
behind it for terrain (drawn once per map+size from `terrainBitmap`, redrawn on resize/zoom
bucket) and a `<canvas>` above for the in-progress stroke. Inside the SVG: `<defs>` holding the
`MarkerSprite` symbols (inside the map SVG itself, so `<use href="#m-fob">` survives
serialisation), then one world group `<g transform="matrix(scale 0 0 scale tx ty)">` (updated
via `ref` without React re-render) containing, in order: `GridLayer` (when on), `ZoneLayer`
(control zone ring + label chip), `StrokeLayer`, `ShapeLayer`, `MeasureLayer`, `MarkerLayer`
(markers + request pins), `TextLayer`, `PingLayer`, `CursorLayer` (peers' cursors as small
chevrons with callsign, throttled 20 Hz; hidden in Brief mode), `SelectionLayer`.

Two scaling classes. **World-scaled**: ink strokes, shapes, measure lines, text labels, the
danger radius disc, the zone ring. **Screen-constant** (as upstream): marker symbols and their
labels, request pins, ping rings, peer cursors, measure labels, grid labels, selection handles.
Every screen-constant element is a `<g data-screen style="transform: translate(Xpx, Ypx)
scale(var(--inv))">` with its anchor in map units, and `--inv` (`1 / scale`) is written on the
`<svg>` root by the same imperative path that writes the world matrix — one style write per
zoom, every marker follows, hit targets included. Markers are 32 px symbols at every zoom.

**Export contract**: every element inside the map SVG carries presentation attributes
(`fill`, `stroke`, `stroke-width`, `font-family`, `font-size`, `opacity`) — never a Tailwind
class for its look — because `exportSvg` (§3.4) serialises the DOM into an `<img>` where
stylesheets do not apply. Colour tokens are read into JS once (`INK_HEX`, the marker palette in
`MarkerSprite`) and written as attributes. Layers that must not export (`CursorLayer`,
`PingLayer`, `SelectionLayer`, the `foreignObject` rename editor, the help overlay) carry
`data-export="skip"`. `export-svg.test.tsx` renders the layers with a fixed state and asserts the
serialised string has no `class=` on `path|circle|rect|text|use|line|polygon`.

`#map-help` (visually hidden): `Arrow keys pan, plus and minus zoom, Enter places the selected
marker at the crosshair, Tab moves to the list of things on the map. Press question mark for
all shortcuts.` Squad layers not editable render at 60 % opacity.

**Zoom stack** (bottom-right, one panel, 40 px icon buttons with tooltips; hidden under 768 px —
pinch and the `More` sheet cover it): `+` zoom in, `−` zoom out, `0` fit, `F` fullscreen
(Fullscreen API on the app root; button toggles), `G` grid, `X` ping tool (`aria-pressed`),
layers (only in squad mode: popover with checkboxes per layer + `Focus my squad`).

**Bottom bar** (right): sound toggle (icon, `aria-pressed`, default muted — a short click on
new request when on, generated with `AudioContext`, no asset), `OUR DISCORD` chip (external; in
activity mode through `activity.openExternal`, §4.7), `CONTROLS & HELP` chip (`?`). Bottom-left: `v0.2.0`
and `Schematic map` (with an info tooltip `Layout is approximate. Commanders can upload a real
map under Manage.`).

#### 4.3.3 Interactions
- **Select (V)**: click a node → selected (handles: shape endpoints, danger radius handle,
  marker/text bounding box); drag moves it (`node.update`, one op on pointer-up, live preview via
  transform); double-click a marker → inline rename (`foreignObject` input, Enter commits, Esc
  cancels); double-click text → edit; `Delete`/`Backspace` removes; arrow keys nudge 1 % (Shift
  5 %); Esc deselects. Double-click precedence: on a node in select = edit/rename; on empty map
  in any tool = ping. Drag on empty map with select = pan. Space + drag = pan in any tool;
  middle button = pan; wheel = zoom at cursor (ctrl+wheel and trackpad pinch too); two-finger
  pinch/pan on touch.
- **Pen (P)**: freehand; `getCoalescedEvents`; transient canvas preview; commit on up.
- **Arrow/Line/Circle/Rect**: drag; Shift snaps/constrains; preview in SVG; commit on up.
- **Text (T)**: click → input at point; Enter commits (`node.add` text, size md); Shift+Enter
  newline (max 80 chars, 3 lines); Esc cancels.
- **Measure (M)**: drag; live label `1,240 m · 047°` (or `0.52 map · 047°` for uploads with no
  scale; `mapById` gives metres for built-ins); Shift snaps 15°; commit as Measurement node.
- **Marker (1–8)**: click places; the label defaults to the short name; Danger gets a radius
  handle; `Enter` on a focused map places at the crosshair (crosshair = viewport centre,
  moved by arrow keys when the map has focus and no node is selected).
- **Keyboard drawing** (every pointer tool has a keyboard path; the crosshair = viewport centre,
  moved by arrow keys, Shift 5 %): with arrow/line/circle/rect/measure active and the map
  focused, `Enter` sets point A at the crosshair, arrows move, `Enter` sets B and commits, `Esc`
  cancels; pen: `Enter` starts a stroke, each arrow press adds a point, `Enter` commits; text:
  `Enter` opens the text input at the crosshair; marker: `Enter` places; request placement:
  `Enter` places.
- **Ping**: double-click / double-tap on empty map in any tool; or `X` arms the ping tool (the
  next click/tap pings, `Enter` pings at the crosshair, `Esc` disarms — `X` never pings by
  itself, so it behaves the same whether or not the map has focus); `Shift+X` pings at the
  crosshair immediately. Emits `sendEphemeral({k:"ping"})`; renders a 4 s pulsing ring in the
  sender's ink colour with the callsign; commander pings are accent and 1.5×. Never persisted;
  own pings render locally at once. `Pings` preference (Controls & help) hides others' pings.
- **Undo/redo**: only the user's own ops (§3.4 history). Toast-free; the rail buttons disable
  when stacks are empty.
- **Copy link**: `${site.url}/join?code=CODE` → clipboard; `COPIED` flash + `announce("Link copied")`;
  fallback: a Dialog with a read-only selected input.
- **Grid (G)**: `GridLayer` 10×10 with A–J top edge, 1–10 left edge (labels stay ≥ 10 px on
  screen); at `scale ≥ 2` each cell shows a faint 3×3 sub-grid. Tooltips and cards show
  `gridRef` (`D7` / `D7-3`).
- **Fullscreen (F)**, **Fit (0)**, **Zoom (+/−)**, **Brief (B)**, **Help (?)**.

Keyboard map (also in Controls & help, with the platform modifier from `useModifierKey`):
`V` select · `P` pen · `A` arrow · `L` line · `C` circle · `R` rect · `T` text · `M` measure ·
`1–8` markers in palette order · `N` new request · `X` ping · `G` grid · `F` fullscreen ·
`0` fit · `+`/`=` and `−` zoom · `B` brief mode · `⌘/Ctrl+Z` undo · `⌘/Ctrl+Shift+Z` or `Ctrl+Y`
redo · `⌘/Ctrl+C` copy link (only when the map surface has focus, no node is selected and
`getSelection()` is empty — otherwise the browser's copy runs) · `⌘/Ctrl+Shift+E` export PNG ·
`Delete` remove
selection · `Esc` cancel placement / deselect / close · `?` help · `Space`+drag pan ·
`Shift`+drag snap. Shortcuts are ignored while typing in inputs. Touch: one finger = tool,
two fingers = pan/zoom, long-press (500 ms) = marker palette popover at that point, double-tap
= ping.

#### 4.3.4 Requests panel (`RequestsPanel.tsx`)
Header: Package icon, `REQUESTS`, count Badge (open + claimed), `+ New` chip (kbd `N`),
`HIDE ≫`. Filter `Tabs` size sm: `ALL · OPEN · MINE · DONE` (`filterRequests`; MINE = by me or
claimed by me; DONE = delivered). List `role="list"`, cards `role="listitem"`, ordered by
`rankRequests` for ALL/OPEN (urgent first, then my focus's kinds, then oldest first).

Card (min 64 px, 3 px left rule in state colour): row 1: kind icon (Fuel `Fuel`, Medical
`Cross`, Ammo `Package`, Other `Box` from lucide) + kind label (Barlow 600) + state text
(`OPEN` / `CLAIMED` / `DELIVERED` mono, coloured) + `URGENT` Badge (danger, pulses under
motion) + grid ref chip (`D7`, when `at`) + age timer (mono tabular, right; open → amber after
60 s, red after 120 s; tooltip absolute time). Row 2: `by Boston` · `claimed by Krieger` ·
`ETA 0:42` countdown (claimed) · note (truncated, full in tooltip). Row 3 actions:
open → `Claim` (primary sm); claimed → `Delivered` (primary sm) + `Release` (ghost sm; confirm
if claimed > 60 s) + ETA chips `30s 1m 2m 5m` (claimer only, `aria-label="Set ETA"`);
delivered → `Delete` (ghost, requester or command). Pencil (edit note/priority/kind, requester
or command), trash (requester or command). Hovering or focusing a card highlights its pin and
vice versa through a shared `highlightId` in the store and `data-request-id` attributes (no
`aria-describedby` between them — a pin is not a description of a card); clicking the grid ref
centres the map on it.
Hint line under an open card when nobody online has a matching focus: `No pilot in room` /
`No medic in room` (`suggestedFocus`).
Empty state: `No requests yet. Press N or + to ask for fuel, medical or ammo.` (ALL/OPEN);
`Nothing claimed by you.` (MINE); `Nothing delivered yet.` (DONE).

New request flow (`NewRequestDialog`): `+`/`N` → Dialog title `New request`: kind chips
`Fuel Medical Ammo Other` (keys 1–4 while open), priority toggle `Normal / Urgent`, note Input
(max 60), then `Place on map` (closes the dialog, cursor becomes a crosshair, next click places
and creates) or `No location` (creates immediately). Esc cancels placement. Mobile: the same
dialog from the `Request` FAB.

Pruning: delivered requests are removed 30 min after delivery by the single-writer (§5.5).
Announcements: `Fuel requested by Boston at D7`, `Fuel claimed by Krieger, ETA 1 minute`,
`Fuel delivered`, `Fuel released`.

#### 4.3.5 Roster panel (`RosterPanel.tsx`)
Header: Users icon, `ROSTER`, count Badge (online members), a `?` icon button opening the
"How focus and map access work" Dialog (copy in §4.4). Tally row: six chips `Infantry 6 ·
Medic 2 · Recon 1 · Support 0 · Driver 2 · Pilot 0` (zero → dimmed) + a warning line from
`focusWarnings` (`No pilot in room`). Draw requests badge (amber) when any `drawRequested`.

Sections: `COMMANDER n` (crown icon), `TEAM n` (or one section per squad in squad mode, plus
`TEAM` for command roles). Row (40 px): 8 px ink dot, callsign (`(you)` suffix), role icon
(crown / star), focus chip (click your own → change), idle dot (`isIdle(activity[id], now)`,
`title="Idle"`), offline rows (`!isOnline(m, presence[id], now)`) at 50 % with `offline` text,
and a `⋯` menu (command roles only; native
`<button aria-haspopup="menu">` + a `role="menu"` popover with arrow-key navigation):
`Make co-commander` / `Remove co-commander`, `Allow drawing` / `Revoke drawing` (only in
`request` mode), `Hand off command` (commander only; confirm), `Kick` (confirm; `roster.remove`;
the relay closes every socket of that client with `error kicked`, and the kicked client's store
sees the removal in `ingest` and shows a Dialog `You were removed from this room` → `/join`.
There is no identity behind a client id, so a kicked person can come back from another browser
profile; the Terms say so). Draw request rows show `Approve` / `Deny` chips inline.
Empty: `Only you so far. Copy the link and send it to your team.` (with a Copy link button).

#### 4.3.6 Manage dialog (command roles; `ManageDialog.tsx`, size lg, tabs)
- **Map**: three thumbnails (`<img src={terrainUrl(map, { size: 320, zone })}>`, 320 px square,
  `detail: "thumb"`), control zone chips (`Default Small Factory Water Treatment Houses None`),
  helper `Changing the map keeps your markers where they are; positions are relative.`
  **Upload your own map** (`UploadMap.tsx`): file input PNG/JPEG/WebP ≤ 8 MB. Pipeline:
  magic-byte sniff → `createImageBitmap` → letterbox to a square on a `bg-0` field → two
  variants: **full** (2048 px; PNG for PNG sources, else JPEG q0.9; the uploader's own display
  copy) and **shared** (1024 px JPEG q0.8, re-encoded at q0.7 then q0.6 until ≤ 1.5 MB). `hash`
  = SHA-256 hex of the **shared** bytes; `w = h = 1024`; `mime = "image/jpeg"`; `name` = the
  file name trimmed to 64 chars. Both variants go to IDB `wardogs/maps` under that hash
  (`{ shared, full, w, h, mime, name, at }`), then `settings.update { mapSource }` and the chunked
  `map.chunk` broadcast of the shared bytes (§5.7). Receivers verify SHA-256 of the assembled
  chunks against `hash` and store `{ shared, full: null, … }`. `Use built-in map` reverts. Peers
  that lack the blob show a `Commander's map not received — showing the schematic map` banner
  with `Request again`. Rejections are in the §4.3.9 table.
- **Squads**: `Run squads?` RadioCards (`One shared map` / `Squad mode`, copy from §4.4); squad
  list (add / remove only, max 8; names 2–16 chars, unique; **no rename in v1** — layers are
  keyed by name and a rename would orphan every node on `squad:<old>`; removing a squad that has
  nodes on its layer asks `Move its drawings to the team map or delete them?`) when on.
- **Access**: `Who can draw and use the map?` RadioCards (`Everyone` / `By request`).
- **Plan**: `Export PNG` (`exportPng`, downloads `wardogs-CODE-YYYYMMDD-HHMM.png`), `Copy plan
  as text` (`planToText` → clipboard, toast `Plan copied — paste it in Discord`), `Save plan
  (.json)` (`RoomSnapshot` download), `Load plan` (file input, `parseSnapshot`, then a
  ConfirmDialog `Replace the current plan or merge into it?` with `Replace` / `Merge`), `Clear
  ink`, `Clear markers`, `Clear everything` (each confirms; `layer.clear`).
- **Room**: link with CopyButton, `Never share your war room code with another team.` (warn
  Callout), `Leave room`.
Downloads are user-initiated `<a download>` clicks created at click time (works in-browser;
inside the Discord iframe they are inert — see the §4.3.9 table for the replacement dialog).

#### 4.3.7 Access rules
`canDraw(me, settings)` gates tools, palettes, requests creation (requests are allowed for
everyone — logistics is not drawing) and Manage (command only). In `request` mode a member's
greyed tool click shows `Ask to draw` → `roster.update { drawRequested: true }` → toast to the
asker `Asked. The commander will see it in the Roster.`; approval toasts `You can draw now`,
denial `The commander said not right now`. Command roles always draw. Commander leaving
(`!isOnline(commander, presence, now)` — no presence for `ONLINE_TTL_MS`; not in demo mode):
`singleWriter` emits `roster.update` promoting
`successor()` to commander and demoting the old one to member; the promoted client sees a
Dialog `You are now commander` with `OK` / `Decline` (Decline hands to the next successor).

#### 4.3.8 Mobile (< 768 px) and Brief mode

- Top bar 44 px: code chip, sync pill (dot + `LIVE`/`LOCAL`), the demo chip on `/demo`,
  callsign initial avatar (menu).
- Map fills the viewport (`h-dvh` minus bars). Rail hidden. **Bottom bar** 56 px
  (`role="toolbar"`, horizontal): `Select`, `Pen`, `Arrow`, `Marker` (opens the palette Sheet),
  `More` (Sheet with the remaining tools, ink, undo/redo, grid/fit/fullscreen, layers). The zoom
  stack is hidden — pinch zooms, `Fit` lives in `More`. **FABs** (48 px): `Ping` and `Request`.
  **Panels**: a bottom `Sheet` with Tabs `Requests n · Roster n`, snap `peek` by default (the
  56 px handle shows badge counts), tap cycles peek → half → full. Landscape phone (height ≤ 480):
  the rail returns on the left (compact, scrollable), panels as a right `Sheet` 280 px, FABs
  above the bottom bar.
- Positions and stacking (portrait, < 768 px; all `position: fixed`; `right`/`bottom` include
  `env(safe-area-inset-*)`):

| Element | Position | z-index |
|---|---|---|
| Map surface | `inset: 44px 0 56px 0` | 0 |
| Schematic note / version | bottom-left, `bottom: calc(56px + 56px + 8px)`; hidden when the sheet is above `peek` | 10 |
| Bottom toolbar | `bottom: 0`, full width, 56 px + safe area | 30 |
| Panels sheet (peek 56 px) | `bottom: 56px`; half/full raise it | 40 |
| FABs (`Request`, then `Ping` above it, 12 px apart) | `right: 12px`, `bottom: calc(56px + 56px + 12px)` (toolbar + sheet handle); they rise with the sheet up to `half`, then hide behind it | 50 |
| Demo chip | inside the top bar, never over the map | — |
| Toasts | top centre, under the top bar | 60 |
| Dialogs / modal sheets | top layer (`showModal`) | — |

  On a 640 px-tall phone the map keeps 640 − 44 − 56 − 56 = 484 px, and nothing but the two
  FABs overlaps it.
- **Brief mode** (`B`, top-bar toggle; default ON under 768 px for `member` role, remembered in
  `wardogs:prefs`): hides tools and panels; shows the map, the sync pill, `Ping` and `Request`
  FABs, and an `Exit brief` chip; drawing is disabled while in brief mode; selection/tooltips
  still work.

#### 4.3.9 Empty and error states

- Unknown room on this device, no snapshot after 1.5 s: full-map overlay Dialog (dismissible)
  `Nothing here yet` — `This browser has no plan for {CODE}. In LOCAL mode only tabs in this
  browser share a room; on a relay the plan arrives as soon as someone who has it is online.`
  Buttons: `Wait for the plan` (dismiss; keeps listening), `Start a fresh plan here` (creates
  state with self as commander, default settings from `joinHint` or Lonestar/Zestafona/Default).
- Relay `error room-full` → Dialog `This room is full (64)`; `kicked` → §4.3.5.
- Corrupt snapshot → quarantined to `wardogs:room:<CODE>:bad`, toast `Saved plan could not be read; starting fresh`.
- Storage quota exceeded → toast `Browser storage is full; this room will not persist` (still works).
- Offline (`navigator.onLine` false) with ws → pill `RECONNECTING…`.

Every other failure has a toast (tone, copy) or a dialog; nothing fails silently:

| Situation | Response |
|---|---|
| Upload: not PNG/JPEG/WebP by magic bytes (SVG included) | toast danger `That is not a PNG, JPEG or WebP image.` |
| Upload: > 8 MB | toast danger `Images up to 8 MB. Yours is 11.2 MB.` |
| Upload: `createImageBitmap` fails | toast danger `The image could not be decoded. Try exporting it again as PNG or JPEG.` |
| Upload: shared variant still > 1.5 MB after re-encoding | toast danger `Could not make a version small enough to share. Try a simpler image.` |
| Load plan: not JSON / fails `parseSnapshot` | toast danger `That file is not a wardogs plan.` |
| Load plan: drawn on another map | ConfirmDialog `This plan was drawn on Bakurani; you are on Zestafona. Load it anyway?` |
| Relay `error rate-limit` | toast warn `Slow down — the relay is dropping edits.`; the pill tooltip shows the strike count |
| Relay `error bad-frame` (our frame rejected) | logged; toast warn `An edit was rejected by the relay.` at most once a minute |
| Relay unreachable at boot (3 s) | toast warn `Relay unreachable — this browser only.`; pill LOCAL |
| Clipboard blocked (no `navigator.clipboard`, permission denied, or inside the Discord iframe) | Dialog `Copy this link` with a read-only selected input — COPY LINK, the code chip and Copy plan as text all fall back to it |
| Downloads inside the Discord iframe (`<a download>` is inert there) | Export PNG / Save plan open a Dialog `Downloads are blocked inside Discord` with `Open wardogs.tech in your browser` (`activity.openExternal` to `/join?code=`); `Copy plan as text` stays available |
| `Test connection` fails (API console) | inline danger Callout under the target fields: `No answer from https://host:7776 (network error). The listener must be reachable from this browser and answer CORS preflights — otherwise copy the snippet and run it from a terminal.` |
| Storage write fails mid-session | one toast `Browser storage is full; this room will not persist`, then silent |

#### 4.3.10 A11y specifics

`NodeList.tsx`: after the map surface in tab order, a compact **visible** list
(`role="listbox" aria-label="Things on the map"`) docked at the bottom of the panels column
(desktop) or inside the `More` sheet (mobile): collapsed to a one-line `Things on the map (14)`
disclosure by default and expanded automatically when it receives keyboard focus, so its options
can show the standard 2 px focus ring — `a11y.spec` demands a visible ring on every focusable
element, which a visually hidden list can never pass. Each option reads `Friendly LZ "LZ BRAVO"
at D7, placed by Boston` / `Enemy FOB · Valkyra "AUSTIN" at F3`; arrow keys move focus (selection
follows and the map centres), Shift+arrows nudge, Delete removes, Enter renames markers/text.
Requests and roster rows are list items; state changes go through `announce()`. Keyboard paths
for every pointer tool are in §4.3.3 (`Enter`/arrows at the crosshair). Dialogs use the `Dialog`
primitive. Ink swatches carry names. Skip links: the `(app)` layout renders exactly one,
`Skip to map` → `#map` (the root layout renders none). One live region: `LiveRegion`; the
`Toaster` is `aria-live="off"` and announces through it. Contrast of ink on terrain is a design
check (Pixel 7 screenshot review) plus the ground-luminance assertion in §2.3, not a per-pixel
assertion.

### 4.4 `/create` (WP3)

Layout `(app)`, page background `bg-grid bg-grid-masked`. Centred column `max-w-[640px]`:
lockup (`Logo` size lg, centred, links home) and H1 `display display-2` **Open your team's war
room**. The form is a tier-3 panel (`rounded-xl p-8 hud-corners`); on selection of a team the
form root sets `--team` and the panel top rule, the submit glow (`box-shadow 0 0 0 1px
color-mix(in srgb, var(--team) 40%, transparent)`) and the map thumbnail's zone ring take it.

Fields in order (labels are `label-mono`):
1. **Your team** — three 56 px buttons `Lonestar · Valkyra · Manticore` (`role="radiogroup"`),
   team colour as a 3 px top rule; selected fills 12 % of the team colour, name in the colour.
   Default Lonestar. `?t=` prefill accepted.
2. **Map** — three thumbnail cards in a fluid `grid-cols-3` (`<img src={terrainUrl(map, { size:
   320, zone, labels: false })}>`, square, `alt="Zestafona — farmland, a river and a town in the
   middle"`), name eyebrow bottom-left, `blurb` under it, 2 px accent ring when selected. Default
   Zestafona. `?map=` prefill. The images come from `/terrain/*` (cached, immutable), so a zone
   change after the first paint is a cache hit, and the page HTML carries no SVG.
3. **Control zone** — helper right-aligned `Change it any time under Manage`. Chips `Default ·
   Small Factory · Water Treatment · Houses · None`; default `Default`; the selected zone draws
   its ring on the selected thumbnail (thumbnail re-rendered with `zone`). `?zone=` prefill.
4. **Run squads?** — RadioCards 2-col: `One shared map` — `Everyone works on the same layer.
   Simple.` / `Squad mode` — `Each squad plans on its own layer. Only you and co-commanders mark
   the team map. Joiners are asked their squad.`
5. **Who can draw and use the map?** — RadioCards 2-col: `Everyone` — `Anyone in the room draws
   and places every marker.` / `By request` — `Only you and co-commanders. People ask from a
   greyed tool; you approve in the Roster.`
6. **Discord** — full-width `discord` variant button labelled for what it actually does:
   `Add to your Discord account` (Discord glyph) — v1 cannot complete a sign-in (no backend to
   exchange the OAuth code), so it is not called "Sign in". When `site.discord.clientId` is set
   it links to `discordInstallUrl("account")` with the helper `Adds the app to your account so it
   shows under Start an Activity. Sign-in comes later; you continue with a callsign.` When empty,
   the button is disabled with helper `Discord is not configured on this instance.` Divider `OR`
   (mono 11 px between 1 px `line-strong` rules).
7. **Type your callsign** — Input h-12, placeholder `e.g. Reaper`, dice button generates
   `Operator 41E3`, prefilled from `wardogs:identity`. `CallsignSchema` inline error
   `2 to 24 characters.`
8. **Start from a recent plan** (only when `listRecentRooms()` has entries for the chosen map):
   a select `None · X5GM4Q · Zestafona · 2 days ago …` — loads that room's nodes into the new room.
9. Submit: full-width lg primary `Open war room →`; below it, 13 px `text-fg-muted` with a
   ShieldAlert icon: `Never share your war room code with another team.`; link `How focus and
   map access work` opens a Dialog with:
   > **Focus** is what you are doing this match: Infantry, Medic, Recon, Support, Driver or
   > Pilot. It shows next to your name so a commander can see gaps, and requests that match
   > your focus float to the top of your list.
   > **Map access** is set by the commander. With *Everyone*, anyone in the room draws. With
   > *By request*, only the commander and co-commanders draw until they approve you; ask from
   > any greyed tool and they will see it in the Roster.

Submit: `newRoomCode()` (§5.3), `createRoomState({ code, settings, createdAt, actor:
identity.client })`, `roster.upsert` self as `commander` (`ink` from identity), save snapshot +
index, `router.push("/room/CODE")`. Loading state on the button. Prefills (`?t=`, `?map=`,
`?zone=`) are read from `window.location` in a mount effect (§3.14 Next 16 rules); the form
renders its defaults first. Mobile: fields stack, team 3-up at 44 px, thumbnails stay a fluid
`grid-cols-3` (≈ 96 px squares at 360 px), zone chips wrap, radio cards stack, the submit sits
in a sticky bottom bar (`bg-bg-0/90 backdrop-blur`, safe-area padding). No JS: the form posts
nothing; a `<noscript>` line says JavaScript is needed to open a room.

### 4.5 `/join` (WP3)

Same shell as `/create`; H1 **Join a war room**. Fields:
1. **War room code** — `CodeInput` (six mono cells `flex-1 min-w-0 max-w-12 h-14`, tracking
   0.3em, auto-uppercase, paste accepts `x5gm-4q` / `X5GM 4Q`, auto-advance, Backspace steps
   back, Enter submits a full code or the reserved `DEMO`); prefilled from `?code=` after mount;
   error under the cells `Codes are 6 letters or digits, never 0, O, 1 or I.` with a 2×4 px shake
   (off under reduced motion). `DEMO` → navigates to `/demo`.
2. **Add to your Discord account** (as in 4.4) · `OR` · **Type your callsign** (placeholder shows
   a generated `Operator 41E3`; dice button).
3. **Your focus** — helper `Change it any time from your name in the top bar`. 2×3 grid of
   44 px toggle buttons with lucide icons: Infantry `ChevronUp`, Medic `Plus`, Recon `Crosshair`,
   Support `Wrench`, Driver `Car`, Pilot `Plane`. Optional; `role="radiogroup"`.
4. Submit `Join war room →` → saves identity → `/room/CODE`.
5. **Rejoin** list (when history exists): tier-1 card, eyebrow `Rejoin`, rows as on Home.

### 4.6 `/add` (WP6)

`src/app/(site)/add/page.tsx` (async server component, `PageProps<"/add">`; `searchParams` is a
Promise in Next 16): `const { to: toParam } = await searchParams; const to = toParam === "account"
? "account" : "server"; const url = discordInstallUrl(to);` — if `url` → `redirect(url)`.
Otherwise render the setup page (this is what an unconfigured self-host shows):

Eyebrow `Setup required`; H1 **This instance has no Discord app configured**; lede `Point it at
your own Discord application and the Add buttons and the voice-channel Activity start working.
It takes about five minutes.`; ordered steps in a tier-1 panel:
1. `Create an application at discord.com/developers/applications.`
2. `Under Activities, enable Activities and add a URL mapping: prefix / → your site origin
   (for example https://wardogs.example.com). If you run a relay, add a second mapping:
   prefix /relay → the relay origin.`
3. `Under OAuth2, note the Client ID. Add applications.commands to the default install scopes.
   Enable both Guild Install and User Install.`
4. `Set NEXT_PUBLIC_DISCORD_CLIENT_ID=<client id> in the site's environment and redeploy. If you
   run a relay, set NEXT_PUBLIC_RELAY_URL too, and add https://<client id>.discordsays.com to the
   relay's RELAY_ALLOWED_ORIGINS.`
5. `In Discord, join a voice channel, press Start an Activity, pick your app.`
Callout note: `Members cannot launch it? That is almost always the Use Activities permission
on the voice channel. See the Discord help page.` → `/discord-help`. Buttons: `Try the live
demo` primary → `/demo`, `Read the docs` secondary → `/dev`.

### 4.7 `/activity` (WP3)

`src/app/(app)/activity/page.tsx` static shell (`Loading the war room for this call…`) +
client `ActivityShell`: dynamically imports `src/lib/discord/activity.ts`, which imports
`@discord/embedded-app-sdk` (never imported anywhere else).
```ts
// src/lib/realtime/discord-env.ts (WP1) — pure functions of window.location, no SDK import; safe in every bundle
export function isInsideDiscord(): boolean;                 // location.search has frame_id, or the hostname ends with discordsays.com
export function activityRelayUrl(): string;                 // `wss://${location.host}/relay` — through the /relay URL mapping; Discord's iframe CSP allows only the discordsays host
// src/lib/discord/activity.ts (WP3) — the only importer of @discord/embedded-app-sdk; loaded by ActivityShell alone
export interface ActivityContext { instanceId: string; channelId: string | null; guildId: string | null; openExternal: (url: string) => void }
export async function initActivity(clientId: string): Promise<ActivityContext | null>;  // new DiscordSDK(clientId); await ready(); null on failure or when not embedded; openExternal wraps sdk.commands.openExternalLink
// src/lib/room/code.ts
export function codeFromInstance(instanceId: string): string;  // 6 chars from hashString(instanceId) mapped onto the code alphabet; stable
```
`ActivityShell` hands the context to the app: `<MapAppLoader mode="activity" code={code}
activity={{ openExternal: ctx.openExternal }}>`; in activity mode every external link in the app
calls `activity.openExternal(url)` instead of navigating.
How Discord reaches us: the Activity's URL mapping `/` → the site origin, so Discord loads
`https://<clientId>.discordsays.com/?frame_id=…&instance_id=…` — **the site root**, not
`/activity`. `next.config.ts` `redirects()` therefore sends `/` with a `frame_id` query to
`/activity` (query preserved, `permanent: false`, §3.14), so the marketing page — which carries
`X-Frame-Options: DENY` — never renders inside Discord. Only `/activity` allows the Discord
frame ancestors; every other route stays un-frameable, so **in activity mode no internal
navigation happens**: the LogoMark is a plain image, `/join` / `/create` links and the demo chip
are hidden, `Leave room` reopens the Join dialog instead of routing, and external links
(`OUR DISCORD`, docs) go through `openExternal`. Every `router.push` in `MapApp` is gated on
`mode !== "activity"`.

Flow: outside Discord → `router.replace("/demo")` + toast `Open this inside a Discord voice
channel to share a room with the call. Here is the demo instead.` Inside Discord with a client
id → `code = codeFromInstance(instanceId)`; identity: the SDK's `authorize({identify})` is not
completed in v1 (no backend to exchange the code), so the Join dialog appears with copy
`Sign-in needs a server; use a callsign for now.`; then `<MapAppLoader mode="activity" code>`.
Inside Discord without a client id → an inline Callout `This instance has no Discord app
configured` with the /add steps.

Transport: `resolveRelayUrl()` (§5.2) returns `activityRelayUrl()` when `isInsideDiscord()` and
a relay is configured, so the socket goes to `wss://<clientId>.discordsays.com/relay/ws?room=…`
and Discord's proxy forwards `/relay/*` to the relay origin with the prefix stripped; the relay
must list `https://<clientId>.discordsays.com` in `RELAY_ALLOWED_ORIGINS` (README, §4.6 step 4).
Without a relay: BroadcastChannel (works across the Activity's iframes in one client).
`next.config.ts` keeps the `frame-ancestors` CSP for `/activity` and its `connect-src` adds
`https://discord.com https://*.discord.com wss://*.discord.gg https://*.discordsays.com
wss://*.discordsays.com` (§7.6). Clipboard and downloads inside the iframe: §4.3.9 table.

### 4.8 `/demo/admin` and the dashboard (WP4)

Layout: the `(admin)` route group (`src/app/(admin)/layout.tsx`, WP4-owned) with its own
`AdminStrip` header (48 px: lockup left, mono Badge `Proof of concept` right; on dashboard
routes also the visitor callsign chip and `Reset to 04:00Z snapshot`). No SiteHeader. Page is
`src/app/(admin)/demo/admin/page.tsx` (static) with a client island for the live card.

**Hero** (contained, `max-w-5xl`): H1 `display display-1` on three lines **Run a Wardogs
server from one dashboard**; amber `display display-3` sub-headline **An early build, open to
anyone. Click around and tell us what is wrong.**; body (max 60ch):
> wardogs.tech is building the admin dashboard the official console is not: live control,
> history that stays, ranks instead of a shared password. This is that dashboard, pointed at a
> simulated test server that plays King of the Hill around the clock. You open it as a visitor
> holding the admin role. Nothing you do here reaches a real server or a real player.

Buttons: primary `Open the dashboard →` → `/demo/admin/live`; mono `No sign-in · nothing to install`.

**Live server card** (tier 3, `hud-corners`, client island `LiveServerCard`, updates at 1 Hz
from `stateAt(DEFAULT_SEED, now, commands, me)`): header mono `● On the test server now ·
Wardogs Demo Server`; map name `display display-2`; `MODE King of the Hill` `LIGHT Day End
Clear` as mono key-value chips; scoreboard: three columns, 3 px top rule + 8 px dot in the team
colour, team eyebrow in the team colour, score `display` 48 px tabular (tween 400 ms), a 2 px
progress bar `score / scoreCap` under each; then a 4-up mono row: `PLAYERS 13/100` (with a
4 px capacity bar), `MATCH 1:01:06` (ticking, `aria-live="off"`), `MATCHES ON RECORD 106`,
`ROSTER 12` (distinct players seen today). Below: a 5-row roster preview table (team dot,
callsign, ping mono, session length) with striped rows `rgba(255,255,255,0.02)`. Mobile: score
tiles stay 3-up (values 32 px), metrics wrap 2×2.

**Feature cards** (tier 2, link to the matching tab; lucide `Radio`, `History`, `ShieldCheck`):
- eyebrow `Live` · **Run the match** · `Whisper a player, kick one, move them to another
  faction, or override the map. The scoreboard updates within seconds because the demo server
  answers the same RCON calls a real one does.` → `/demo/admin/live`
- eyebrow `History` · **Read three days back** · `Every match on record with its final board and
  how the score moved, every player's sessions and playtime, a leaderboard. The official console
  keeps none of this.` → `/demo/admin/history`
- eyebrow `Accountability` · **See who did what** · `You hold the admin role here. Every action
  you take lands in the audit trail under your visitor name, with the exact RCON call it would
  have sent.` → `/demo/admin/audit`

**Notes** (three note blocks): `Shared` — `Everyone who opens this link is on the same simulated
server: same clock, same seed. What you change is shared with the other tabs in this browser.`;
`Heals itself` — `Kicked players come back. Bans you
place expire in an hour. Rotation, config and everything visitors wrote reset at 04:00Z.`;
`Not real` — `A test server the app runs itself, in your browser. The roster is fictional. Real
communities would sign in with Discord and hold real ranks.` Second `Open the dashboard →` + mono
link `What wardogs.tech is` → `/`. Footer line: `wardogs.tech is unofficial and not affiliated
with Bulkhead or Team17. The map is drawn by this site; nothing here is game art.`

**Dashboard** (`src/app/(admin)/demo/admin/(dashboard)/layout.tsx` with a `<nav
aria-label="Dashboard">` of links `Live · Rotation · History · Bans · Audit` — `aria-current="page"`
on the active one, mono chips with the 1 px accent underline; not the `Tabs` primitive, which is
for in-page panels. Each tab route is a static shell + `DashboardLoader` (`"use client"`, owns the
`dynamic()` import of the panel bundle) + the client panel; `export const metadata.robots =
{ index: false }`). A persistent `Not real` Badge and the visitor callsign chip (`visitor
{callsign}` — the callsign from `wardogs:identity`, the same one used in war rooms; click to
change, saved back to the identity) sit in the strip. The simulation runs in one `setInterval`
1 Hz (paused when `document.hidden`); commands live in `localStorage wardogs:sim:<UTCDATE>` and
broadcast on `BroadcastChannel wardogs:sim` so tabs of this browser see each other's actions.
No relay sharing in v1 (§1): `TimedCommand` is not a wire kind and the relay applies only map ops.

- **Live** (`/demo/admin/live`): the live server card (compact) + `PlayersTable` (sortable by
  name/team/kills/deaths/ping; row actions menu: `Whisper`, `Kill`, `Move to Lonestar/Valkyra/
  Manticore`, `Kick…`, `Ban…`, `Reserve slot`); toolbar: `Broadcast…`, `Override map…` (map +
  zone + lighting), `Set lighting…`, `Restart match`, `End match` (confirm). Kick/Ban dialogs
  require a reason; Ban adds `Evidence URL` (optional, `https://` only) and duration chips
  `15m 1h 6h` (default 1 h, capped at 6 h in the demo).
- **Rotation**: list of entries with up/down buttons (and keyboard), `Add entry` (map, zone,
  lighting), `Remove`, `Save` (`rotation.save` → toast `Saved to ServerSettings.ini (simulated)`),
  settings `Rotation enabled`, `Mode Ordered/Random`, `Score tick 18–30`.
- **History**: matches grouped by day (72 h), each row map · zone · final board · winner ·
  duration; expanding shows the score timeline as a small inline SVG line chart (three team
  lines, 120×40, `aria-label` with the final scores) and the per-player board; a `Players`
  sub-tab with sessions and total playtime; a `Leaderboard` sub-tab (kills, K/D, playtime).
- **Bans**: table of active bans with remaining time countdown, reason, evidence link, `Unban`;
  `Ban a player…` (steamId or pick from roster).
- **Audit**: reverse-chronological entries `12:04:31 · visitor Operator 41E3 · KICK · Vanta ·
  ok · "team killing"`, `you` Badge on own entries, filter `All / Mine`; each row expands to the
  RCON call.

**"What this sends" slide-over** (right `Sheet`, non-modal): opened automatically after every
mutating action (and from any audit row): title `What this sends`, method Badge + path in mono,
body as a code block, `Copy as curl` / `fetch` / `PowerShell` (from `src/lib/openapi`), and a
line `Sent to the in-browser simulator. Point the API console at your own server to run it for real.`
→ `/rcon-api?endpoint=<id>`. A `Don't show automatically` checkbox (`wardogs:prefs.showRcon`).

States: no JS → the static hero and a `Skeleton` card. Empty history (never, generated).

### 4.9 Dev hub `/dev` and docs (WP5; `/rcon-api` is WP4)

**Docs shell** (`src/components/docs/DocsShell.tsx`, API in §3.15; used by /dev,
/rcon-reference, /discord-help, /map-guide, /rcon-api): the `UNOFFICIAL` strip at the very top
(32 px, `bg-bg-1`, mono `UNOFFICIAL` in accent + Barlow 13 px text, text per page), then the
normal `SiteHeader`, then a docs header row: lockup-less (SiteHeader has it) — instead a mono
eyebrow (`Dev hub`, `Unofficial · Community reference`, `Discord help`, `Map guide`) and
right-aligned mono `Updated {updated} · v{version}` — defaults `site.updated` / `site.version`;
`/rcon-reference` and `/rcon-api` pass `parseSpec(openapi).info.updated` / `.version` so the
header states the API content's own version (`v0.27`), not the site's. Three-column at `xl`: sticky left TOC 220 px
(mono 12 px, active item amber rule via `IntersectionObserver`), content 68ch, right "On this
page" 200 px (h3s); at `lg` two columns; below: content + a TOC `<details>` accordion at the
top. Headings: h1 `display display-2`; h2 `display display-3` with a hover `#` anchor link
(mono, accent); h3 Barlow 600 18 px. Body 16/1.65. Code: mono 13 px; blocks `bg-bg-0
border-line rounded-md` with a header bar (language/filename left, `CopyButton` chip right);
inline code `bg-bg-2 px-1.5 rounded-sm`. Tables full-bleed on mobile inside `overflow-x-auto`,
header row `label-mono`, zebra rows. Callouts per §2.7. Docs footer line: mono
`WARDOGS.TECH — {PAGE}` · `Home` · `Discord` · `Fan-made · Not affiliated with Bulkhead or Team17`.

Content lives in `src/content/dev/*.tsx` as typed `Doc` modules (`DocSectionData` / `Doc` from
`src/content/dev/types.ts`, §3.15); each page maps `doc.sections` onto `<DocSection>`.

**`/dev`** — UNOFFICIAL line `Community tools and references. Not affiliated with the Wardogs
developers.` H1 **Run your server**; lede `Everything for running a Wardogs dedicated server in
one place: the RCON API, an interactive console, the spec to build against, and a config file
to start from.` Six tier-2 cards (2-col at `md`), eyebrow · title · body · mono route:
- `Reference` **Server Reference** `The RCON HTTP API and the ServerSettings.ini config, every
  endpoint and key documented.` `/rcon-reference →`
- `Interactive` **API Console** `Browse every endpoint with live examples. Try it against the
  in-browser simulator or your own server.` `/rcon-api →`
- `Machine-readable` **OpenAPI Spec** `Generate a typed client in any language, or import it
  into Postman.` `/openapi.json →`
- `Download` **Config Template** `A commented starter ServerSettings.ini with every key at its
  default. Edit and drop it in.` `ServerSettings.ini ↓` (link to `/ServerSettings.ini`, `download`)
- `Troubleshooting` **Discord help** `The map will not launch in a voice channel: the permission
  that causes it, temp channels, and the one-minute test.` `/discord-help →`
- `Reference` **Map guide** `How this site draws its maps, the coordinate system, grid references
  and what a commander's uploaded map can be.` `/map-guide →`
Then **Config validator** (client island `ConfigValidator`): H2 **Validate a config**; textarea
(`Paste your ServerSettings.ini`), `Validate` button, results list from `validateIni` (errors
danger, warnings warn, stripped keys muted) mirroring what `POST /v1/config/validate` returns;
`Load the template` fills the textarea. Then the annotated template viewer (`<details>` per
section, each key row: key mono accent, default chip, applies-when chip, description).
Callout `Building something?` (`border-l-[3px] border-accent`): **Building something?** `The spec
gives you a client in any language, and the reference has a copy-paste block for Claude or
ChatGPT. Everything here is unofficial, so verify against your own server.`

**`/rcon-reference`** — port the upstream text **verbatim** from
`/tmp/claude-0/-home-user-War-dogs/61851c33-82db-5257-a90e-a5d704125fb0/scratchpad/devpages/rcon-reference.txt`
(sections 01 Overview … 10 Notes, the four stat chips `RCON API /v1 · 35 endpoints`, `Auth
Bearer token`, `Transport HTTP · TLS for remote`, `Config ServerSettings.ini`). Changes: the
endpoint table in 05 is generated from `parseSpec(openapi.json)` (filter chips `All / Read /
Write`, search box, columns Method · Path · Group · Access · Description, each row linking to
`/rcon-api?endpoint=<id>`); `↗ Open the interactive API console` links to `/rcon-api`; the
"One token, full access" block is a danger Callout; the AI prompt block (section 09) has one
`CopyButton` `Copy for Claude / ChatGPT` and is rendered from `src/content/dev/rcon-prompt.ts`
(the exact text from the capture); the download link goes to `/ServerSettings.ini`; the config
key table in 08 renders from `INI_KEYS` (§3.10) so the validator and the docs cannot drift.

**`/discord-help`** — UNOFFICIAL line `Fan-made community tool. Not affiliated with the Wardogs
developers.` H1 **It won't launch**. New **Start here** stepper (client island, state in
`sessionStorage wardogs:dh`) above the verbatim article:
- Q1 `Can you — an admin — launch it?` Yes/No. No → outcome **A**.
- Q2 `Can a non-admin launch it in a brand-new voice channel dragged to the very top of the
  server, outside every category?` Yes → Q3; No → outcome **C**.
- Q3 `Is the failing channel created by a bot (join-to-create, temp channels)?` Yes → outcome
  **B**; No → outcome **D**.
- **A** `Install it first.` → `An admin adds it with Add to your server; or, right now, three
  dots on the app card → Add to my apps.` links `/add` and section "Installing it, properly".
- **B** `Fix the hub, not the children.` → `Edit Channel → Permissions on the channel your bot
  clones from. Clear the Use Activities deny, delete a temp channel, let the bot make a fresh
  one.` link to "Temp voice channels".
- **C** `It is server-wide.` → `Server Settings → Apps → Activities, and Integrations →
  wardogs.tech → Manage.` link to "The test that finds it in one minute".
- **D** `It is that channel or its category.` → `Edit Channel → Permissions: set Use Activities
  to neutral or allow for @everyone and for their role. Check the category above it too.` link
  to "The answer, nine times out of ten".
Each outcome has `Copy this checklist for my mods` (plain-text version). `Start over` resets.
Then the article, verbatim from `devpages/discord-help.txt`: "The answer, nine times out of
ten", "Temp voice channels", "The test that finds it in one minute", "What you are looking at"
(table), "Installing it, properly" (table), "Things that are not the problem" (table), "Still
stuck" (→ `site.links.discord`). One edit: in "Things that are not the problem", replace
`Hundreds of servers are running war rooms right now.` with `A whole-app failure would affect
every server, not one.`

**`/map-guide`** — eyebrow `Reference · Maps`; UNOFFICIAL line `How this site draws its maps.
Code wins over docs if they disagree.` H1 **How this site draws a map**. Rewritten for this
codebase (the upstream page describes a tile pipeline we do not have). Sections:
1. **TL;DR** — stat chips `Maps 3 (zestafona, bakurani, ozeti)` · `Map space 2048 units` ·
   `Grid 10 × 10, A–J / 1–10` · `Custom upload cap 8 MB`. `Every built-in map is drawn by the
   site from a seed: no game art, no screenshots. The layout is schematic — approximate by
   design — and the control zones sit at fixed positions so callouts mean the same thing in
   every room.`
2. **Why procedural** — the no-game-art rule; the same seed gives the same map in the demo,
   the create page, the OG image and every room.
3. **Coordinate system** — `Everything drawn is stored as a normalised point {x, y} in [0, 1]
   on the square map, and widths as fractions of map width, so drawings line up at every zoom.
   Map space is 2048 units; the viewport is scale + translate.` (verbatim from the shared types).
4. **Grid references** — how `D7` and `D7-3` are read; the keypad layout.
5. **Control zones** — the four presets and where they are on each map (table from `MAPS`).
6. **Custom maps uploaded by a commander** — PNG/JPEG/WebP ≤ 8 MB, squared with letterboxing,
   kept in your browser (IndexedDB), shared to the room at ≤ 1.5 MB; `Scale is unknown for an
   uploaded map, so the measure tool reports map fractions.`; reverting.
7. **Adding a built-in map** — add a `MapDef` to `src/config/maps.ts`; anchors, names, biome.
8. **Reference** — constants table (`MAP_PX`, `DEFAULT_STROKE_WIDTH`, `DEFAULT_DANGER_RADIUS`,
   grid, `MAX_NODES`, `MAX_STATE_BYTES`, upload cap, demo reset 5 min).

**`/rcon-api`** (WP4) — docs shell, H1 **API Console**, lede `Every endpoint in the spec, with
a form, a live request preview and a response. Try it against the simulator in this tab, or
against your own server.` Client island `ConsoleLoader` (`"use client"`; owns the `dynamic()`
import of `ApiConsole` so the `(site)` first load stays inside budget; renders a `Skeleton` of the
console's two-column layout until the chunk lands) → `ApiConsole`:
- Target switch (segmented, top): `Demo simulator (in this tab)` (default) · `Your server`.
  "Your server" reveals `Base URL` (`https://host:7776`) and `Bearer token` inputs kept in
  `sessionStorage wardogs:console:target` (label `Sent only to the host you type. Kept for this
  tab only.`), `Test connection` (`GET /v1/status`; failure copy in §4.3.9), an always-visible
  note `Your listener must answer CORS preflights (Access-Control-Allow-Origin, -Headers:
  authorization, content-type) for a browser to call it. If it does not, copy the snippet and
  run it from a terminal.`, and an inline warning when the URL is `http://` and the page is
  `https:` (`A browser cannot call a plaintext listener from an HTTPS page. Use TLS, or call from
  a server.` → `/rcon-reference#02`). The route's CSP allows `connect-src 'self' https: wss:`
  (§7.6) so the call is not blocked by our own headers.
- Left nav (`role="navigation"` + `role="search"` box): endpoints grouped by tag with method
  badges; search filters by method/path/summary (case-insensitive substring, no dep).
- Main pane per endpoint (`?endpoint=<id>` deep link): summary, description, params form
  generated from schemas (string/number/enum/boolean, required marked, header params as
  inputs), body editor prefilled with `exampleFor(schema)` (JSON, or plain text for the two
  config endpoints), request preview updating live as `curl` / `fetch` / `PowerShell` tabs
  with CopyButtons, `Send` (primary; 10 s timeout for real servers), then a response panel:
  status Badge, timing, headers `<details>`, body as pretty JSON. Response schema rendered as a
  collapsible tree.
- Simulator target: requests go through `handleRcon` with the shared sim command log, so a
  kick here shows up on `/demo/admin/live`. A note `Any token works against the simulator.`
- `openapi.json` link and `Download spec`.

### 4.10 `/terms` and `/privacy` (WP6)

Layout `(site)`, prose column 68ch, H1 `display display-2`, `Updated {site.legalUpdated}` in
mono above it, h2 Barlow 600 20 px. Contact line uses `site.contactEmail` when set, else
`reach us on the community Discord` (linked). Copy is plain language and true for this codebase.

**Terms of Service**
> wardogs.tech is a community-built companion for the game Wardogs: a shared tactical map, war
> rooms for squads, a demo of a dashboard for people who run Wardogs servers, and a Discord app
> that opens the map inside a voice channel. Using any of it means you agree to these terms.

- **Who we are, and who we are not** — `wardogs.tech is unofficial. It is not made by, endorsed
  by or affiliated with Bulkhead, Team17 or anyone else behind Wardogs. Game names appear here
  so the tool is useful to players; the maps are schematic drawings made by this site, not game
  art. If a rights holder asks, anything of theirs comes down.`
- **Accounts** — `There are none. You type a callsign; it lives in your browser. If this
  instance has Discord sign-in configured, we receive only what Discord shows you on the consent
  screen, and we keep nothing on a server.`
- **War rooms** — `A war room is identified by its code. Anyone with the code can open it and,
  depending on the commander's settings, draw on it. There is no account behind a callsign, so
  the code is the only protection: anyone in a room can remove anyone else from it, and someone
  removed can come back with the code. Do not share a code with people who should not see the
  plan. Rooms are kept in the browsers of the people in them and, where a relay is configured,
  in that relay's memory while the room is active.`
- **What you post** — `Callsigns, drawings, markers, labels and request notes are yours and your
  team's. Do not post anything you have no right to share, anything that identifies a private
  person beyond their in-game presence, or anything that harasses, threatens or demeans someone.
  Uploaded map images must be yours to use.`
- **The demos** — `The live demo is a shared room: treat it as a room with other people in it. The
  dashboard demo is a simulation that runs in your browser; nothing you do there reaches a real
  server or a real player.`
- **Acceptable use** — `Do not use wardogs.tech to cheat, to attack or overload the service or a
  relay, to impersonate another person or community, or to scrape or resell anything here.`
- **Availability and warranty** — `This is a free tool built by players in their own time. It is
  provided as is, with no promise that it will be available, accurate or free of faults. Wardogs
  itself changes; the server reference can go out of date when it does. To the extent the law
  allows, wardogs.tech is not liable for any loss arising from its use or unavailability.`
- **Ending things** — `We can change or shut down any part of the service, and a relay can drop a
  room that breaks these terms. You can leave at any time by closing the tab and clearing your
  browser's site data.`
- **Changes** — `When these terms change, the date at the top changes with them. Continuing to
  use the service after that is acceptance of the new terms.`
- **Contact** — `Questions, takedown requests and anything else: {contact}.` Link to Privacy.

**Privacy Policy**
> This page says what wardogs.tech keeps about you, why, for how long, and how to remove it. It
> is written to be read, not to cover us. The short version: there is no account and no
> database, and nothing is stored unless you choose to.

- **What stays in your browser** — `Your callsign, focus and ink colour; the war rooms you have
  opened and their plans; your preferences; any map image you upload; the actions you take in
  the dashboard demo. All of it is in this browser's storage. Clearing site data removes it.`
- **What a relay sees** — `If this instance runs a relay, it receives the room code, the
  callsigns and the drawings of the people in a room so it can pass them to each other. It keeps
  them in memory only, drops a room six hours after the last activity, and writes nothing to
  disk. It does not log IP addresses beyond what its host does by default.`
- **The Discord app** — `Inside a Discord voice channel the app reads the call's instance id to
  put everyone in the same room. It does not read your messages, your server list or your
  roles. If Discord sign-in is configured and you use it, Discord shows you exactly what is
  shared; we do not store it on a server.`
- **Cookies** — `None. No advertising, no analytics, no tracking.`
- **Who else sees data** — `The site is hosted on Vercel; a relay, when configured, runs where
  its operator puts it. Nobody buys, rents or is otherwise given your data.`
- **Removing your data** — `Clear this site's data in your browser. A relay forgets a room on its
  own within six hours of the last activity.`
- **Age** — `Discord requires its users to be at least 13, and so do we. We do not knowingly keep
  data about anyone younger.`
- **Changes and contact** — `When this policy changes, the date at the top changes with it.
  Questions and requests: {contact}. wardogs.tech is unofficial: not affiliated with Bulkhead,
  Team17 or Discord.` Link to Terms.

### 4.11 Not found (WP6, `src/app/not-found.tsx`)

Outside every route group (Next renders the root `not-found.tsx` without a group layout), so it
composes `SiteHeader` / `SiteFooter` itself and renders its own `Skip to content`. Eyebrow `404`;
H1 **Nothing at this position**; lede `The page you asked for is not on the map. If you were sent
a war room link, the code goes after /room/.`; a `CodeInput`-lite field (`Have a code?`,
`isRoomCode`) that navigates to `/room/CODE`; buttons `Try the live demo` → `/demo`, `Join a war
room` → `/join`, `Home` (ghost). Metadata `robots: noindex`.

---

## 5. Realtime and persistence

### 5.1 Store (`src/store/room.ts`, WP1) — the only place that mutates room state

```ts
export interface RoomStore {
  code: string | null;                            // RoomState.code ("DEMO" in demo mode)
  room: string | null;                            // transport room: the code, or demoRelayRoom(now)
  mode: "room" | "demo" | "activity";
  state: RoomState | null;
  me: Identity | null;
  sync: SyncStatus;
  peers: number;                                  // distinct client ids with presence within PEER_TTL_MS (self included)
  presence: Record<string, Presence>;             // seenAt = local receipt time (§5.5)
  activity: Record<string, number>;               // last op / non-null cursor per client → idle dot
  pings: Ping[];                                  // last 4 s
  history: History;
  queued: number;                                 // ops waiting for the relay
  kicked: boolean;
  storageOk: boolean;
  // UI (not persisted except via prefs)
  tool: Tool; ink: InkColor; markerKind: MarkerKind; enemyTeam: Team; selection: string | null; highlightId: string | null;
  brief: boolean; grid: boolean; showPings: boolean; sound: boolean;
  // actions
  boot(args: { code: string; mode: RoomStore["mode"]; identity: Identity; joinHint?: { team?: string; squad?: string }; room?: string; seed?: RoomState }): Promise<void>; // room = transport room override (demo), seed = initial state instead of the stored snapshot (demo)
  dispatch(body: OpBody, opts?: { undoable?: boolean }): Op | null;   // stamps meta, applies, persists, sends; null when the reducer ignored it, the body breaks a cap, or the permission table forbids it
  dispatchMany(bodies: OpBody[], opts?: { undoable?: boolean }): Op[]; // one history entry for the whole batch
  ingest(op: Op): void;                            // remote/bot ops; detects roster.remove of self (→ kicked)
  ingestPresence(members: Presence[]): void;       // transport onPresence and the demo director's botPresence(); stamps seenAt locally
  undo(): void; redo(): void;
  ping(at: Point): void;
  setTool(t: Tool): void; setInk(c: InkColor): void; setMarkerKind(k: MarkerKind): void; setEnemyTeam(t: Team): void;
  select(id: string | null): void; highlight(id: string | null): void;
  setBrief(b: boolean): void; setGrid(b: boolean): void; setShowPings(b: boolean): void; setSound(b: boolean): void;
  updateIdentity(patch: Partial<Identity>): void;  // also emits roster.update of self
  leave(): void;
}
export const useRoomStore: UseBoundStore<StoreApi<RoomStore>>;
export const selectNode: (id: string) => (s: RoomStore) => MapNode | undefined;   // per-id memoised selectors
export const selectMe: (s: RoomStore) => RosterMember | null;
```
Rules: components never call `useRoomStore.setState`; every mutation is `dispatch`. `dispatch`
stamps `{ id: newId(), ts: now, actor: me.client, seq: nextSeq(state) }`, applies with
`applyOp`, pushes `{op, inverse}` when `undoable` and `inverseOf` is non-null, persists
(debounced), `transport.send(op)`. `ingest` applies and re-renders only the affected entities
(zustand selectors with `shallow`). The world transform is written to a ref, never through
React state. `src/lib/map/boundaries.test.ts` scans `src/components/**` and fails if any file
contains `useRoomStore.setState`; importing from the `@/lib/map` barrel (including `applyOp`,
which `HeroPlayer` needs for its private replay state) is allowed.

Permission table — what `dispatch` lets each role emit; everything else returns `null` and the
UI never offers it:

| Op | member, `canDraw` | member, no `canDraw` (`request` mode) | co-commander | commander |
|---|---|---|---|---|
| `node.add` / `node.update` / `node.remove` on an editable layer; `layer.clear` of own squad layer | ✓ | ✗ | ✓ | ✓ |
| `layer.clear` of `team` or of every layer | ✗ | ✗ | ✓ | ✓ |
| `request.add`; `request.update` / `request.remove` per the `requests.ts` rules | ✓ | ✓ | ✓ | ✓ |
| `roster.update` of self (`online`, callsign, focus, ink, squad, `drawRequested`) | ✓ | ✓ | ✓ | ✓ |
| `roster.update` of others (`canDraw`, role ≤ co-commander); `roster.remove` (kick) | ✗ | ✗ | ✓ | ✓ |
| `roster.update` giving `commander` (hand-off) | ✗ | ✗ | ✗ | ✓ |
| `settings.update` | ✗ | ✗ | ✓ | ✓ |
| housekeeping (§5.5) while `singleWriter` | ✓ | ✓ | ✓ | ✓ |

Demo mode: the visitor is a member, Manage is hidden, housekeeping is off, and `enemyTeam`
defaults to `enemyTeams(settings.team)[0]` (every mode).

### 5.2 Transports

- **Relay URL resolution** (`resolveRelayUrl()` in `src/lib/realtime/index.ts`), in order:
  1) inside Discord (`isInsideDiscord()` from `src/lib/realtime/discord-env.ts`) with
  `NEXT_PUBLIC_RELAY_URL` set → `activityRelayUrl()` (§4.7); 2) `localStorage wardogs:relay` — a same-origin override for self-hosters and e2e
  (`"off"` forces LOCAL; any `ws(s)://` URL is used); 3) `NEXT_PUBLIC_RELAY_URL`; 4) `undefined`
  → broadcast. Never a query parameter: a crafted link could point a victim's plan at a hostile
  relay.
- **BroadcastChannel** (`createBroadcastTransport`): channel `wardogs:<ROOM>`; on `join` posts
  `hello` (with the local snapshot — peers surface it through `onSnapshot` and merge) and, after
  300 ms with no `sync.snapshot`, posts `sync.request`. **Every** peer that holds state
  (`getState() !== null`) answers a `sync.request` with `sync.snapshot` after a random 0–300 ms
  delay, cancelling if it sees another `sync.snapshot` for that room on the channel first. There
  is no election: all tabs of one browser share a client id, so ids cannot rank peers, and a
  duplicate snapshot is harmless (merge is idempotent). A requester with no state after 1,500 ms
  shows the empty state (§4.3.9) and keeps listening. `presence` posted every 10 s with `[self]`
  (receivers aggregate, expire after 30 s); `bye` on leave. No `storage`-event fallback:
  BroadcastChannel exists in every browser we support (Safari ≥ 15.4); where it is missing the
  factory returns the memory transport (this tab only) and the pill says LOCAL. Status is always
  `"local"`.
- **WebSocket** (`createWsTransport`): `new WebSocket(`${relayUrl.replace(/\/$/, "")}/ws?room=${room}`)`;
  on open send `hello` (with the local snapshot); reconnect with backoff `min(15000, 500 * 2^n)`
  + jitter ±20 %; heartbeat: the relay's `presence` every 15 s serves as the server heartbeat;
  the client sends `cursor` at most every 50 ms and at least every 20 s (with `at: null`); ops
  queue while not open (cap 1,000; drop oldest); after reconnect: `hello` → `sync.request
  {since: state.seq}` (ops with `seq >= since`) → flush the queue. `connectTimeoutMs` (3 s) not
  opened → switch to BroadcastChannel and status `"local"` with a toast `Relay unreachable —
  this browser only.`; a background retry every 30 s upgrades to ws when it succeeds (state
  merged via snapshot).
- **Memory** (`createMemoryTransport`): synchronous bus for unit tests and the convergence test.

### 5.3 Room codes (`src/lib/room/code.ts`, WP1)

Alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols; no 0/O/1/I). Two modules, so the home
page stays zod-free (§7.3):
- `src/lib/room/code.ts` (pure, relay-reachable): `CODE_ALPHABET`, `newRoomCode(): string`
  (6 symbols from `crypto.getRandomValues`), `normalizeCode(input: string): string` (uppercase,
  strip everything not in `[A-Z2-9]`), `isRoomCode(s: string): boolean`
  (`/^[A-HJ-NP-Z2-9]{6}$/`), `RESERVED_CODES = ["DEMO"] as const` (valid in routes and as
  `RoomState.code`, never generated), `isReservedCode(s)`, `codeFromInstance(instanceId)` (§4.7).
- `src/lib/room/schema.ts` (zod): `RoomCodeSchema = z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/))`
  and `AnyRoomCodeSchema = RoomCodeSchema.or(z.enum(RESERVED_CODES))`, used by `RoomStateSchema.code`
  and the `/room/[code]` route (`DEMO` there redirects to `/demo`).

Room links: `/room/<CODE>` (canonical), `/join?code=<CODE>` (what COPY LINK copies, so the
recipient gets the callsign/focus step), `/r/<CODE>` (301 → `/room/<CODE>`; `next.config.ts
redirects()`). Collision odds: 32^6 ≈ 1.07 × 10⁹ codes, a space shared with `codeFromInstance`;
n live rooms collide with probability ≈ n² / 2 × 10⁹ — 0.05 % at a thousand simultaneous rooms
— and a collision silently merges two teams' maps. Accepted at upstream's six-character parity
for a fan tool (Appendix C); eight characters is the escape hatch if it ever matters.

### 5.4 Storage (`src/lib/storage/*`, WP1)

All reads/writes wrapped in try/catch; a failure degrades to in-memory only and sets
`storageOk = false` (one toast).

| Key | Store | Shape | Notes |
|---|---|---|---|
| `wardogs:identity` | localStorage | `{ v:1, client, callsign, focus, ink }` | created on first use; `client` is per-browser and never changes (§3.3); hand-written guard, no zod (the home page imports this module) |
| `wardogs:prefs` | localStorage | `{ v:1, grid, showPings, sound, brief, lastTool, showRcon, demoChipDismissed }` | |
| `wardogs:room:<CODE>` | localStorage | `RoomSnapshot` | debounced 500 ms; `compactState()` before save keeps the newest `MAX_TOMBSTONES` (2,000) tombstones by rev and caps nodes at `MAX_NODES`; if the JSON exceeds `MAX_STATE_BYTES` (600 kB) the oldest strokes are removed and a toast says so. Five rooms × 600 kB stays inside a 5 MB quota |
| `wardogs:room:<CODE>:bad` | localStorage | raw string | quarantine for unparsable snapshots |
| `wardogs:rooms` | localStorage | `RecentRoom[]` (max **5**, newest first) | drives Rejoin cards and "Start from a recent plan"; forgetting a room also deletes its snapshot; `src/lib/storage/rooms.ts` is zod-free (hand-written guard) |
| `wardogs:relay` | localStorage | `string` | optional relay override (§5.2); never written by the app itself |
| `wardogs:sim:<YYYY-MM-DD>` | localStorage | `TimedCommand[]` | UTC date of the 04:00Z boundary; older keys deleted on load |
| `wardogs:dh` | sessionStorage | `{ step, answers }` | Discord help stepper |
| `wardogs:console:target` | sessionStorage | `{ mode, baseUrl, token }` | never localStorage |
| IDB `wardogs` / store `maps` | IndexedDB | key `hash` → `{ shared: Blob, full: Blob \| null, w, h, mime, name, at }` | uploaded maps (§4.3.6); `src/lib/storage/idb.ts` falls back to an in-memory `Map` when `indexedDB` is undefined (jsdom, SSR) — no setup shim needed |

The dashboard's visitor callsign is `wardogs:identity.callsign` — one callsign per browser,
shared with the war room; there is no separate `wardogs:sim:actor`.

API: `loadIdentity() / saveIdentity()`, `loadPrefs() / savePrefs()`, `loadRoom(code) / saveRoom(code, snapshot) / forgetRoom(code)`,
`listRecentRooms()`, `touchRecentRoom(r: RecentRoom)`, `loadRelayOverride()`, `putMap(hash, rec) / getMap(hash)`,
`compactState(state: RoomState): RoomState`.

### 5.5 Presence, idle, single-writer

`presence[client].seenAt` is stamped with the receiver's own `Date.now()` on any `presence`,
`cursor`, `op` or `hello` from that client (`bye` deletes the entry); the wire `seenAt` is
ignored, so clock skew between the relay and a client can never flip a room to idle or offline.
`activity[client]` = time of the last op or non-null cursor (the idle dot, `isIdle`, 90 s).
`peers` = distinct client ids seen within `PEER_TTL_MS` (30 s), self included. Online =
`isOnline()` (presence within `ONLINE_TTL_MS`, 60 s; the persisted flag only when no presence
record exists, §3.4).

**Single-writer rule**: housekeeping ops that every client could compute — prune delivered
requests after 30 min, prune strokes over `MAX_NODES`, promote a successor commander, expire
`drawRequested` after 10 min, and flip `online: false` on `staleMembers()` (flag still true, no
presence for 60 s) — are emitted only by `singleWriter(roster, presence, now)`, the lowest
client id among clients with presence in the last 30 s. Two tabs of one browser share that id
and may both emit; duplicates are harmless (LWW / idempotent), this just keeps the op stream
quiet. Housekeeping is off in demo mode (§4.2).

### 5.6 Demo seeding and reset

Covered in §4.2. Implementation: `useDemoDirector(store)` in `src/components/map/demo/`
computes `epochIndex(now)`, boots the store with `stateAt(now)` and the relay room
`demoRelayRoom(now)`, schedules the remaining `timelineOps` items with `setTimeout` (recomputed
on `visibilitychange`), feeds `botPresence(now)` into the store every 10 s, and at the epoch
boundary calls `store.leave()` then `store.boot` with the next epoch's seed and relay room — a
new room, so there is nothing to merge back and nothing to reset on the relay. The "resets in
m:ss" text ticks every second from the same clock. `window.__wardogs.now` is used when present
so e2e can fake time. Bots do not need to be "running" anywhere else: the timeline is the same
for everyone by construction. Between visitors there is no server-side state, and that is
stated in the demo's tooltip: `Bots are scripted on a shared clock. Your edits are shared with
tabs in this browser and, on a relay, with everyone — until the next reset.`

### 5.7 Uploaded maps over the wire

Chunks of 48 kB base64 of the **shared** variant (`map.chunk`, `n` total; `mime`/`w`/`h` as in
`mapSource`); receivers assemble by `hash`, verify that the SHA-256 (`crypto.subtle.digest`) of
the assembled bytes equals `mapSource.hash`, store `{ shared, full: null, … }` in IDB, then swap
the terrain layer for the image (letterboxed square, `MAP_PX` map space; the uploader draws its
`full` variant, everyone else the shared one — identical geometry, so drawings line up). A hash
mismatch discards the chunks and re-requests once. Missing blob on open → `map.request {hash}`;
any holder (a peer or the relay cache) answers. Uploaded maps have no metres: `widthMetres =
null` → measure shows map fractions.

---

## 6. SEO, metadata, OG images

### 6.1 Metadata
Root `layout.tsx` keeps the existing `metadata` (title template `%s · wardogs.tech`) and adds
`alternates: { canonical: "/" }`, `openGraph.images` = `/opengraph-image`, `twitter.images`,
`icons.apple = "/apple-icon"`, `manifest: "/manifest.webmanifest"`. Each page exports
`metadata` with `title`, `description`, `alternates.canonical` (route path; `metadataBase` is
`site.url`), and `robots: { index: false, follow: false }` on `/room/[code]`, `/activity`,
`/add`, `/demo/admin/(dashboard)/*`, not-found. `openGraph.images[0].alt` is set everywhere
(`og:image:alt`).

### 6.2 OG images (WP2 helper, thin route files owned by each route's package)
`src/lib/og/render.tsx`: `renderOg(preset: OgPreset): ImageResponse` (Node runtime,
`export const runtime = "nodejs"` in each route file). Fonts: `ImageResponse` (satori) cannot
read woff2, so WP2 commits TTFs of the two faces — `src/assets/fonts/SairaCondensed-ExtraBold.ttf`
and `Barlow-Medium.ttf` from the Google Fonts repository (OFL; licence file alongside) — and reads
them with literal paths, `fs.readFile(join(process.cwd(), "src/assets/fonts/…"))`, so Vercel's
file tracing bundles them. If the TTFs cannot be obtained in the build environment, WP2 reports
it and the routes render the text-free composition (mark, rules, terrain) rather than failing
the build. 1200×630, charcoal `#141311`, the two-scale grid as repeating linear gradients at
4 %, an optional terrain crop as an absolutely positioned `<img src={terrainToDataUri(model,
{ size: 630, detail: "thumb", labels: false, grid: false })}>` at 40 % opacity on the right
(labels off: nested SVG `<text>` has no fonts under resvg),
centred lockup (mark from `markSvg` 44 px + wordmark 40 px), headline in Saira 800 at up to
128 px / 0.9 (three lines max), amber Barlow 500 30 px strapline with 60 px amber rules either
side, and a 4 px amber bar on the bottom edge. Presets:

| Route file | Headline | Strapline | Terrain |
|---|---|---|---|
| `src/app/opengraph-image.tsx` (+ `twitter-image.tsx` re-export) | THE TACTICAL MAP / EVERY WARDOGS / SERVER NEEDS | DRAW THE PLAN. CALL THE DROP. EVERYONE SEES IT. | none |
| `src/app/(app)/demo/opengraph-image.tsx` | THE LIVE DEMO | A SHARED MAP. NO SIGN-IN. RESETS EVERY FIVE MINUTES. | zestafona crop |
| `src/app/(site)/dev/opengraph-image.tsx` | RUN YOUR SERVER | RCON · OPENAPI · CONFIG · DISCORD HELP | none |
| `src/app/(admin)/demo/admin/opengraph-image.tsx` | SERVER ADMIN / IN THE SAME DISCORD | LIVE PLAYERS. MATCH HISTORY. BANS WITH EVIDENCE. | bakurani crop |
| `src/app/(app)/room/[code]/opengraph-image.tsx` | JOIN THE WAR ROOM | OPEN THE LINK. TYPE A CALLSIGN. YOU ARE ON THE MAP. | ozeti crop — **the code is never rendered** |
| `src/app/(app)/create/…`, `join/…` | OPEN A WAR ROOM / JOIN A WAR ROOM | same as root | none |

E2E asserts each returns 200 `image/png`.

### 6.3 Sitemap, robots, manifest
`src/app/sitemap.ts`: `/` (1.0 weekly), `/demo` (0.8 daily), `/create`, `/join` (0.6 monthly),
`/dev`, `/rcon-reference`, `/rcon-api`, `/discord-help`, `/map-guide` (0.5 monthly),
`/demo/admin` (0.5), `/terms`, `/privacy` (0.2 yearly); `lastModified` = `site.updated`.
`src/app/robots.ts`: allow all; disallow `/room/`, `/r/`, `/activity`, `/add`, `/terrain/`,
`/demo/admin/live`, `/demo/admin/rotation`, `/demo/admin/history`, `/demo/admin/bans`,
`/demo/admin/audit`;
sitemap URL from `site.url`. `src/app/manifest.ts`: name `wardogs.tech`, short_name `Wardogs
map`, `display: "standalone"`, `background_color`/`theme_color: "#141311"`, `start_url: "/join"`,
icons `/icon` (512, `purpose: "any maskable"`) and `/icon.svg`.

### 6.4 JSON-LD (`src/components/site/json-ld.tsx`, WP6)
`<JsonLd data={…}>` serialises with `JSON.stringify` and escapes `<`, `>` and `&` as `\u003c`,
`\u003e`, `\u0026` so content can never close the script tag. Root layout:
`WebSite` (name, url, `potentialAction` none) + `SoftwareApplication` (name, `applicationCategory:
"GameApplication"`, `operatingSystem: "Web"`, `offers { price: 0, priceCurrency: "USD" }`,
`isAccessibleForFree: true`, `author { @type: "Organization", name: "wardogs.tech community" }`).
Home adds `FAQPage` with the five questions. Docs pages add `TechArticle` (headline,
dateModified = `site.updated`, author) and `BreadcrumbList` (Home › Dev hub › page).

---

## 7. Quality bar

### 7.1 Unit tests (vitest, jsdom)

Coverage target: ≥ 90 % of lines under `src/lib/**` and `server/**`. `@vitest/coverage-v8`
is not installed and no new dependencies are allowed, so this is a **review criterion**, not a
flag: every exported function in those trees has at least one test, and the reviewer spot-checks
with `npx vitest run --reporter=verbose`. Do not pass `--coverage` in CI.

Test infrastructure (WP6 owns the config files; the rules bind everyone): the global environment
is jsdom; node-only suites (`server/relay.test.ts`, anything that opens sockets) start with
`// @vitest-environment node`. `vitest.setup.ts` installs `node:crypto`'s `webcrypto` as
`globalThis.crypto` when `crypto.subtle` is missing (jsdom), so SHA-256 and `getRandomValues`
work in every suite. `BroadcastChannel` and `WebSocket` are mocked inside the transport tests
themselves; IndexedDB needs no shim (`idb.ts` falls back to memory). `eslint.config.mjs` and
`.prettierignore` ignore `server/dist/**`.

| Module | Tests (file) |
|---|---|
| `src/lib/geo.ts` | `geo.test.ts`: bearing north=0/east=90/south=180/west=270; snapAngle keeps length; clampPoint. |
| `src/lib/map/reduce.ts` | `reduce.test.ts`: applyOp idempotent (same op twice → same reference); stale op ignored; **concurrent partial patches** — A moves a marker (seq 10) while B renames it (seq 11, never saw A): both survive in either order; same-field patches resolve by rev in either order; delete beats move regardless of arrival order (patch-then-remove, remove-then-patch, remove → resurrect → late patch); re-add after delete with a higher rev resurrects and clears field revs; layer.clear with type filter racing an add; settings per-field LWW; `order` is canonical (equal for equal `nodes`, never a duplicate after a re-add); convergence: 200 causally valid random ops from 3 actors (§3.4) applied in 20 seeded permutations reach a deep-equal state; `mergeStates` commutative, associative, idempotent, and `mergeStates(a, applyOps(a, ops))` deep-equals `applyOps(a, ops)`; seq monotone; `inverseOf` batches at `MAX_NODES_PER_OP`. |
| `src/lib/map/history.ts` | undo emits inverse, redo re-emits; cap 200; redo cleared on new push. |
| `src/lib/map/inverseOf` | every invertible op type round-trips (apply op then inverse → deep-equal minus revs/seq). |
| `src/lib/map/schema.ts` | rejects malformed nodes/ops; parseSnapshot returns null, never throws; callsign/code schemas. |
| `src/lib/map/viewport.ts` | world↔screen round-trip; zoomAt keeps the cursor point fixed; clamp keeps ≥ 25 % visible; fit centres. |
| `src/lib/map/grid.ts` | gridRef corners (0,0)=A1, (0.999,0.999)=J10, sub-cells 1..9 layout; gridCell inverse. |
| `src/lib/map/ink.ts` | outline stable for fixed input (snapshot); simplify reduces points, keeps endpoints. |
| `src/lib/map/tools.ts` | pen: down/move/up → one node.add with ≥2 points; tap → 2-point dot; shapes below 0.004 → no op; shift snap 15°; measure metres = widthMetres × distance. |
| `src/lib/map/requests.ts` | every transition edge (open→claimed→delivered, release, not-yours, already-delivered), eta, ageState thresholds, filter MINE both ways, rankRequests order, shouldPrune 30 min. |
| `src/lib/map/roster.ts` | `isOnline` (fresh presence → true, stale presence → false, no record → the flag); canDraw matrix (2 modes × 3 roles × canDraw flag); tallies count online members only; warnings; visibleLayers/editableLayer; successor order skips offline members and `leaving`; singleWriter picks the lowest id with presence; `staleMembers`. `teams.ts`: `enemyTeams`/`enemyTone` for all three teams. |
| `src/lib/map/plan.ts` | planToText snapshot for the demo seed; importPlan replace/merge id re-minting. |
| `src/lib/map/scenario.ts` | timeline sorted and < epoch; stateAt(now) deterministic; seed state validates against RoomStateSchema; all points in [0,1]. |
| `src/lib/map/ids.ts`, `src/lib/room/code.ts` | alphabet, length, normalizeCode, codeFromInstance stable and valid, reserved codes. |
| `src/lib/realtime/*` | schema rejects bad frames and per-kind oversize (a 100 kB `op` fails, a 1 MB `sync.snapshot` passes, a 3 MB one fails); memory transport: two clients converge on ops and snapshot; ws transport: backoff schedule with fake timers, queue cap, `since` on reconnect (mock WebSocket), `resolveRelayUrl` precedence (override > env, `"off"`); broadcast (mock BroadcastChannel): a joiner with no state gets a snapshot from a holder, a second holder cancels its reply after seeing the first, `hello.snapshot` reaches `onSnapshot`. |
| `server/relay.test.ts` (`// @vitest-environment node`) | starts on port 0; two `ws` clients: hello → snapshot, op fan-out in one order, sync.request → sync.ops with `seq >= since`, presence on join/leave de-duplicated by client, rate-limit error, bad frame drop, wrong-room frame drop, a 1 MB hello accepted, room-full, origin rejection, `DEMO-<n>` accepted and `SIM` rejected, a kick closes every socket of that client, `/healthz`. |
| `src/lib/storage/*` | round-trips; quarantine on corrupt JSON; recent rooms cap 5 (forgetting one drops its snapshot); `compactState` keeps the newest 2,000 tombstones; idb put/get on the memory fallback; `identity.ts` and `rooms.ts` import no zod (source scan). |
| `src/lib/terrain/*` | same seed → deep-equal model; different seeds differ; every zone/POI/settlement inside [0,1]²; each anchor has a settlement of the right kind within 0.05; `terrainToSvg` returns a string starting with `<svg` that contains the zone name when `zone` given, is ≤ 40 kB at `thumb` and ≤ 150 kB at `full`/1024 for every map; every biome's `ground` has relative luminance 0.15–0.19; biome palettes are distinct; `terrainUrl` output. |
| `src/lib/admin-sim/*` | stateAt determinism (same inputs → deep-equal); kick removes then restores within 90–300 s; ban expiry; move persists until next match; match n increases monotonically; history length ≈ 72 h / 40 min; resetBoundary math; `toRcon` covers every command and returns null for `reset`; `handleRcon`: every openapi path responds 200 with a body that satisfies the spec's response schema (a small structural check built from `parseSpec`), 401 without token, 404 unknown. |
| `src/lib/openapi/parse.ts` | parses the real spec: 31 paths, 35 operations, every op tagged, every `$ref` resolved, `exampleFor` obeys required/enum, snippets contain method/path/token header. |
| `src/lib/config-ini/validate.ts` | parses the template with zero errors; unknown key → stripped; ScorePeriod 40 → error; BindAddress 0.0.0.0 + Password only → error; rotation entry parse; line numbers. |
| `src/lib/a11y/contrast.test.ts` | WCAG relative luminance: fg on bg-0/1/2 ≥ 7:1; fg-muted on bg-1 ≥ 4.5:1; accent-ink on accent ≥ 4.5:1; warn/ok/danger on bg-1 ≥ 3:1 (UI); accent on bg-1 ≥ 4.5:1; `danger-text` and `req-delivered-text` on bg-1 and bg-2 ≥ 4.5:1. |
| `src/lib/brand/mark.ts` | `markSvg` output is valid-looking SVG containing the chevron path. |
| `src/lib/map/boundaries.test.ts` | no `useRoomStore.setState` under `src/components/**`; no `@/` import inside the relay-reachable set (§3.0); no `zod` import reachable from the home page's client islands (`src/components/home/**`, `src/lib/storage/{identity,rooms}.ts`, `src/lib/room/code.ts`). |

Component tests (Testing Library): `RequestsPanel` (filters, Claim/Delivered/Release buttons
dispatch the right patches, hint line, announce called), `RosterPanel` (tallies, menu actions,
approve/deny), `ToolRail` (roving tabindex, arrow keys, hotkeys change tool, disabled state
under `request` mode), `Dialog` (focus trap, Esc, focus return), `CopyButton` (announces,
fallback), `CodeInput` (paste, auto-advance, uppercase, Enter on `DEMO`), `Tabs` (arrow keys),
`Sheet` (snap cycle), `NodeList` (expands on focus, options labelled with faction), `export-svg`
(the serialised map SVG has no `class=` on shapes and no `[data-export="skip"]` layers),
`LiveServerCard` (renders scores from a fixed state), `ApiConsole` (search filters, simulator
send renders a 200), `DiscordStepper` (all four outcomes reachable), `ConfigValidator` (renders
issues).

### 7.2 E2E (Playwright; projects `desktop` and `mobile` (Pixel 7); `tests/e2e/*.spec.ts`)
1. `home.spec`: hero text, CTAs, no console errors, LCP and CLS recorded as test annotations
   (soft; a hard failure only above 4,000 ms / 0.25 — shared runners are noisy) with the LCP
   element being the hero terrain image, OG route 200 `image/png`, FAQ toggles, code field →
   `/room/ABC234` and `demo` → `/demo`.
2. `room.spec`: `/create` → pick Valkyra/Bakurani/Houses → callsign → lands on `/room/[code]`;
   draw a pen stroke (mouse), place marker via `2` + click, rename it, undo, redo; reload →
   everything persists; COPY LINK writes the clipboard (granted permission); sync pill shows
   `LOCAL`.
3. `sync.spec` (desktop, WP1), two parts. **(a) LOCAL** — the room in a second page of the same
   context (same browser = same client id, so both pages are one roster member): place a marker
   in page A → visible in page B within 1 s (`expect.poll`); create a request in B, claim in A,
   deliver in B; close page B → the member stays online in A. **(b) RELAY** — two browser
   contexts against the relay Playwright starts (§7.5): each context sets `localStorage
   wardogs:relay = "ws://127.0.0.1:8787"` with `addInitScript`; A creates the room and, once B
   joins, shows `LIVE · 2 in room`; the roster shows both callsigns; a marker placed in A appears
   in B; kick from A → B sees the removed dialog; a third context with `"off"` shows `LOCAL`.
4. `demo.spec`: `page.clock.setFixedTime(epochStart)` **before** `goto("/demo")`; the seed plan
   is visible immediately (markers ≥ 8), the roster has 4 bots + you; `runFor(45_000)` → Fuel
   shows `DELIVERED`; `runFor` to the epoch boundary → state resets (visitor marker gone); `Clear
   mine` removes the visitor's marker and nothing else; desktop: the sticky bar links to
   `/create?map=`; mobile project: the demo chip sits in the top bar and dismisses.
5. `mobile.spec` (mobile project): join → `/room/[code]`; bottom bar present, rail absent;
   Request FAB → Fuel → place → card in the sheet; Ping FAB + tap → ring appears; no horizontal
   scroll on `/`, `/demo`, `/create`, `/join`, `/dev`, `/rcon-reference`, `/demo/admin`; touch
   targets on the bottom bar ≥ 44 px.
6. `keyboard.spec`: Tab to the toolbar, `P`, focus the map, `1`, `Enter` places a marker at the
   crosshair, Tab to the node list, `Delete` removes it; `?` opens help; Esc closes it and
   returns focus.
7. `admin.spec`: `/demo/admin/live` → kick a player (reason) → row disappears → audit shows
   `you` → `page.clock.runFor(300_000)` → player returns; ban → Bans tab shows countdown; the
   "What this sends" sheet shows `POST /v1/players/{steamId}/kick`.
8. `console.spec`: `/rcon-api` search `status` → select → Send (simulator) → 200 with
   `serverName`; Copy as curl contains `Authorization: Bearer`.
9. `docs.spec`: `/dev`, `/rcon-reference` (TOC scroll-spy highlights), `/discord-help` stepper
   reaches outcome D, `/map-guide`, `/openapi.json` is JSON with 31 paths, `/ServerSettings.ini`
   has the attachment header; config validator flags `ScorePeriod=40`.
10. `a11y.spec`: on every route run `src/lib/a11y/audit.ts` (`auditPage(): Issue[]` — buttons
    and links without accessible names, inputs without labels, images without alt, duplicate ids,
    missing `main`, `h1` count ≠ 1, positive tabindex) and expect zero issues; every focusable
    element on `/room/[code]` — the NodeList options included — shows a visible focus ring
    (computed `outline-style != none`).
11. `seo.spec`: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, canonical tags, noindex on
    `/room/X`, JSON-LD parses.
Same-context pages share BroadcastChannel; the relay half of `sync.spec` needs the relay
`webServer` entry in `playwright.config.ts` (§7.5). `NEXT_PUBLIC_SITE_URL` is baked in at build
time, so CI builds and tests with the same value (`http://127.0.0.1:3100`) and the COPY LINK and
canonical assertions expect it.

### 7.3 Performance budgets

Measured baseline first. The scaffold's `/` (Next 16.3 + React 19 under Turbopack, fonts,
header) ships **≈ 150 kB gzipped** of module scripts; the 39 kB `noModule` polyfill chunk is
not downloaded by modern browsers and is not counted; `_not-found` is ≈ 133 kB. Budgets are set
from that measurement, not from wishes, and `scripts/bundle-baseline.json` records the number
and the date it was taken:

- First-load JS per route (module scripts referenced by the prerendered HTML, gzip level 9):
  `(site)` routes ≤ 190 kB; `(app)` shells and `(admin)` pages ≤ 200 kB before their lazy chunk;
  the `MapApp` chunk graph (everything `MapAppLoader` pulls in) ≤ 140 kB; `HeroPlayer` ≤ 60 kB;
  `ApiConsole` and the dashboard panel bundle ≤ 90 kB each.
- `scripts/check-bundle.mjs` (WP6): Next 16 emits no per-route client manifest under Turbopack
  (`build-manifest.json` only lists root chunks), so the script reads every prerendered page
  under `.next/server/app/**/*.html`, collects the `<script src="/_next/static/…">` tags that
  lack `noModule`, gzips each referenced file once and sums per page. Lazy chunks are measured
  through the loader modules: each of `MapAppLoader`, `HeroFrame`, `DashboardLoader` and
  `ConsoleLoader` dynamically imports exactly one entry module, and every entry renders
  `data-bundle="wd:<name>"` (`wd:map-app`, `wd:hero`, `wd:dashboard`, `wd:console`) on its root
  element — a string literal that survives minification — so the script finds the entry chunk
  by that literal inside `.next/static/chunks/*.js` and sums it with the chunks it imports
  (parsed from the chunk's own `import()`/require references). It prints a table and fails CI
  over budget; budgets live at the top of the script.
- Keeping `(site)` small: no `zod` reachable from the home page (`isRoomCode` regex,
  hand-written storage guards — enforced by `boundaries.test.ts`); no terrain generator,
  reducer or scenario on first load (`HeroFrame` lazy-loads `HeroPlayer`); `motion` only through
  `LazyMotion` with `features={() => import("./motion-features").then((m) => m.default)}`
  (`domAnimation`), the `m` components and `strict` mode, imported only under
  `src/components/home/**` and `src/components/site/**`; `@discord/embedded-app-sdk` only under
  `src/lib/discord/**`; `perfect-freehand` only under `src/lib/map/ink.ts`; `ws` only under
  `server/**`.
- No raster assets in the marketing pages except OG (served by route). No `next/image` remote
  patterns needed.
- Terrain: `generateTerrain` ≤ 120 ms at res 256 (asserted loosely in a unit test: < 1 s);
  `terrainBitmap` memoised; the terrain canvas is not redrawn on pan; `/terrain/*` responses
  are immutable-cached and ≤ 150 kB (§3.7); server HTML never inlines terrain.
- Ink: a 5,000-point stroke never touches React state before pointer-up; the transient stroke
  draws on the overlay canvas in `requestAnimationFrame`.
- Web vitals: LCP < 2.0 s lab on `/` and `/demo`; CLS < 0.05; no long task > 200 ms during a
  scripted 2 s draw on `/demo`. CI records them (§7.2) and fails only past 4,000 ms / 0.25.
- Fonts: `next/font/local` has one `preload` flag per call, so the split is made consciously:
  `saira` (600/700/800) and `barlow` (400/500/600/700) preload as declared; `jetbrains` is
  `preload: false` (mono is below the fold on every marketing page and the app routes fetch it
  on first use). Latin subsets only. `adjustFontFallback` stays on.

### 7.4 Accessibility checklist (manual, `docs/accessibility.md`; automated parts in 7.1/7.2)
Landmarks on every route · one `h1` · skip link `Skip to content` (site, admin) / `Skip to map` (app)
· every icon button has `aria-label` · toolbar roving tabindex · `aria-pressed` on toggles ·
`aria-keyshortcuts` on tools · map `role="application"` with description · node list ·
dialogs are native `<dialog>` with focus return · sheets trap focus when modal · live region
for remote changes, rate-limited · timers `aria-live="off"` · colour never the only signal ·
ink colours named · ≥ 4.5:1 text (test) · ≥ 40 px targets (44 on mobile bars) · reduced
motion honoured (no ping pulse, no hero animation, no rise) · zoom not locked · no keyboard
traps · forms with labels, errors linked via `aria-describedby`, `aria-invalid` · focus visible
everywhere (2 px accent outline; primary buttons add a 1 px dark ring).

### 7.5 CI (`.github/workflows/ci.yml`, WP6)

```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
env:
  # One value for build and e2e: NEXT_PUBLIC_* is baked in at build time.
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100"
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test
      - run: npm run build:relay        # also enforces the relative-import rule (§3.0)
  build:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: node scripts/check-bundle.mjs
      - uses: actions/upload-artifact@v4
        with:
          name: next-build
          path: |
            .next
            !.next/cache
          retention-days: 1
          include-hidden-files: true
  e2e:
    runs-on: ubuntu-latest
    needs: build
    env: { PW_NO_BUILD: "1", CI: "true" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { name: next-build, path: .next }
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e                # playwright.config starts `next start` and the relay
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-traces, path: test-results }
  relay:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f server/Dockerfile -t wardogs-relay .
      - run: docker run -d -p 8787:8787 -e RELAY_ALLOWED_ORIGINS='*' --name relay wardogs-relay && sleep 3 && curl -fsS http://127.0.0.1:8787/healthz
```
`package.json` scripts added by WP6 in Phase 0: `"e2e:ci": "PW_NO_BUILD=1 playwright test"`,
`"build:relay": "tsc -p server/tsconfig.json"`, `"start:relay": "node server/dist/server/relay.js"`
(dev keeps `tsx watch server/relay.ts`), `"check:bundle": "node scripts/check-bundle.mjs"`.
`npm run check` stays typecheck + lint + unit. `playwright.config.ts` (WP6, Phase 0): `webServer`
becomes an array — the Next server as now, plus `{ command: "npx tsx server/relay.ts", port: 8787,
env: { RELAY_PORT: "8787", RELAY_ALLOWED_ORIGINS: "http://127.0.0.1:3100" }, reuseExistingServer:
!process.env.CI, timeout: 60_000 }` — so `sync.spec` (b) has a relay without a Docker daemon.

### 7.6 Security headers (`next.config.ts`, WP6)

Keep the existing split (`/((?!activity).*)` vs `/activity(.*)`) and add a third, more specific
entry for `/rcon-api(.*)`. Headers come from `securityHeaders(kind: "site" | "console" |
"activity", isProd: boolean)` in `next.config.ts`; the `Content-Security-Policy` header is
emitted **only when `NODE_ENV === "production"`** — Turbopack dev/HMR needs eval and inline
handlers, and a dev-time violation would blank the site for every builder — while every other
header applies in dev too. The e2e server runs a production build, so the CSP is exercised there.

All kinds: the existing `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, plus
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

- **site** (every route not below): `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy:
  same-origin`, CSP `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'
  'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <relay>
  https://discord.com https://*.discord.com; media-src 'self' blob:; worker-src 'self' blob:;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, where
  `<relay>` is the origin of `NEXT_PUBLIC_RELAY_URL` when set (`ws:` or `wss:` as given) — never
  a bare `ws:`/`wss:` wildcard in production. A `wardogs:relay` override pointing elsewhere is
  therefore blocked by CSP in production; that is intended (self-hosters set the env var).
- **console** (`/rcon-api`): the site CSP with `connect-src 'self' https: wss: <relay>` so the
  console can call a user's own listener (CORS on that listener is still required; §4.9).
- **activity** (`/activity`): the site CSP minus `frame-ancestors 'none'` and without
  `X-Frame-Options`, with the existing `frame-ancestors https://discord.com https://*.discord.com
  https://discordsays.com https://*.discordsays.com` and `connect-src 'self' https://discord.com
  https://*.discord.com wss://*.discord.gg https://*.discordsays.com wss://*.discordsays.com`.

No nonces, no `proxy.ts`. E2E asserts no CSP violation is logged on `/`, `/demo`, `/rcon-api`.
Input validation: every inbound wire frame, every stored snapshot, every route param and search
param goes through zod (or the hand-written guards named in §5.4 for the two zod-free modules);
uploaded images are magic-byte sniffed and decoded with `createImageBitmap`; SVG uploads are
rejected; text nodes render as SVG `<text>`, never HTML; callsigns are rendered as text.

### 7.7 Relay Docker (`server/Dockerfile`, `server/tsconfig.json`, `docker-compose.yml`, WP1)

Multi-stage `node:22-alpine`. Build stage: `npm ci` then `npm run build:relay` (tsc → `server/dist`,
holding `server/relay.js` plus the relay-reachable `src/lib/**` and `src/config/site.js`; §3.6).
Runtime stage: `WORKDIR /app`; copies `server/dist` and only the two runtime packages the relay
needs — `node_modules/ws` and `node_modules/zod`, neither of which has runtime dependencies —
runs as user `node`, `ENV NODE_ENV=production RELAY_PORT=8787`, `EXPOSE 8787`, `HEALTHCHECK CMD
wget -qO- http://127.0.0.1:8787/healthz || exit 1`, `CMD ["node", "server/dist/server/relay.js"]`.
`docker-compose.yml` runs the relay for `dev:all` parity. README documents deploying the relay
to any Docker host (Fly, Railway, a VPS), setting `NEXT_PUBLIC_RELAY_URL=wss://…` on Vercel, and
listing the site origin plus `https://<clientId>.discordsays.com` in `RELAY_ALLOWED_ORIGINS`.

---

## 8. Work packages

Six packages, built concurrently, **each in its own git worktree** (§8.1). Owned paths never
overlap. A builder touches only its owned paths and the verbatim contract files under the
create-if-missing rule (§3.0). Requests for changes to files owned by another package go in the
builder's report under "Requests to other packages" with the exact diff wanted.

### 8.1 Phase order (critical path)

**One git worktree per package.** From the scaffold commit on `main`: `git worktree add
../wd-<pkg> -b wp/<pkg>` for `core`, `terrain`, `map-ui`, `admin`, `docs`, `site`. Each package
works and runs its gates in its own worktree, where the only files are the scaffold, its owned
paths and the verbatim contract files — so root `tsc --noEmit`, `eslint .`, `vitest run` and
`next build` never see another package's half-written files, and `.next/types` typegen cannot
race. An integrator (the lead) merges `wp/*` into `main` in the order **WP6 → WP1 → WP2 → WP5 →
WP4 → WP3** at the end of Phase 1 and again after Phase 2. The only files two branches can both
add are verbatim contract files, which must be byte-identical (a differing byte is resolved to
the spec text). After each integration merge every package rebases its worktree onto `main`.

- **Phase 0 (first hour, every package):** write your verbatim contract files; install nothing;
  run `npx next typegen` after adding routes. WP6 additionally deletes the scaffold's
  `src/app/page.tsx` (it creates `(site)/page.tsx`; two files resolving to `/` fail the build)
  and lands the `globals.css` additions (§2.1, §2.3 text tokens, §2.5), the extended `Button`,
  the primitives in §3.12 as compiling components, the `package.json` scripts, the Playwright
  relay `webServer` entry and the vitest setup (§7.1, §7.5) before anything else, because every
  other package renders and tests with them. WP6's Phase 0 branch is merged first and the other
  five rebase onto it before they render anything.
- **Phase 1:** WP1 engine + store + transports + relay; WP2 terrain + maps + `/terrain` route +
  OG helper; WP6 site pages; WP4 simulator engine + OpenAPI parser + `ApiConsole` + dashboard
  panels; WP5 content modules + validator + `DocsShell`; WP3 map UI against the WP1/WP2
  contracts with the memory transport and a stub model inside its own tree. Consumers of API
  files use local test doubles (§3.0).
- **Integration merge 1** (WP6 → WP1 → WP2 → WP5 → WP4 → WP3), then everyone rebases.
- **Phase 2:** integration — WP3 wires the store/transport and the demo director; WP4 wires the
  console to the simulator and writes `(site)/rcon-api/page.tsx` on WP5's `DocsShell`; WP6 wires
  `HeroFrame`/`HeroStatic` into the home page; WP5 wires the endpoint table to `parseSpec`;
  every package deletes its stubs. E2E specs are owned by the package whose route they exercise
  (listed below) and run against the integrated build.
- **Integration merge 2**, then the whole-build DoD (§8.5) on `main`.
- **Done** for a package = in its worktree: `npm run check` and `npm run build` green; after
  merge 2: `npm run e2e` green for its specs; and its report filed
  (`docs/reports/<package>.md`: what shipped, deviations, requests to others).

### 8.2 Shared-file ownership

| File | Owner | Others |
|---|---|---|
| `src/app/globals.css` | WP6 | request additions with exact CSS in the report |
| `src/app/layout.tsx` | WP6 | — |
| `src/config/site.ts` | WP6 | request additions; do not add keys elsewhere |
| `next.config.ts` (headers, redirects) | WP6 | WP1 may request relay origin handling |
| `package.json` scripts | WP6 | WP1 requests the relay scripts (already listed in §7.5) — WP6 adds them in Phase 0 |
| `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.prettierignore` | WP6 | WP6 adds the webcrypto setup, the `server/dist` ignores and the relay `webServer` entry in Phase 0 (§7.1, §7.5); WP1 may request changes |
| Verbatim contract files (§3.0 list) | listed owner | create-if-missing with identical bytes, never edit |
| `src/app/page.tsx` (scaffold home) | WP6 | deleted by WP6 in Phase 0; nobody recreates it |
| `README.md`, `docs/architecture.md`, `docs/accessibility.md`, `CONTRIBUTING.md` | WP6 | packages contribute sections via report |
| `src/content/openapi.json`, `src/content/ServerSettings.ini` | WP5 (verbatim copies from the scratchpad paths) | WP4 may create them under create-if-missing |
| `docs/reports/<package>.md` | each package owns its own report (`core.md`, `terrain.md`, `map-ui.md`, `admin.md`, `docs.md`, `site.md`) | — |
| `docs/SPEC.md` | nobody | read-only during the build |

### 8.3 Packages

#### WP1 — Map engine, sync, storage, relay (`core`)

Owned paths: `src/lib/geo.ts`, `src/lib/map/**`, `src/lib/realtime/**`, `src/lib/room/**`,
`src/lib/storage/**`, `src/store/**`, `server/**` (relay, tests, `Dockerfile`, `tsconfig.json`),
`docker-compose.yml`, `tests/e2e/sync.spec.ts`.
Delivers: §3.1, §3.3, §3.4 (all modules incl. `keys`, `teams`, scenario, plan, export-png),
§3.5, §3.6, §5.1–5.7 (incl. `resolveRelayUrl` and `src/lib/realtime/discord-env.ts`), §7.7, the relay build (`build:relay` output
runs under plain `node`). Unit tests per §7.1. A `src/lib/map/index.ts` barrel.
Imports: `src/config/site.ts` (Team, `site.game.teams`), `src/lib/terrain/types.ts` (MapId,
ControlZoneId and the id lists for the schemas), `src/config/maps.ts` (`mapById` for metres in
tools/plan). All relay-reachable modules use relative imports (§3.0).
Depends on: nothing at runtime beyond contracts. Others depend on it heavily → land Phase 0
contracts first, reducer + store by mid Phase 1.
Spec sections: 3.0–3.6, 4.2 (scenario data), 5, 7.1 (engine rows), 7.2 spec 3, 7.7.

#### WP2 — Terrain, maps config, OG renderer (`terrain`)

Owned paths: `src/lib/terrain/**` (incl. `url.ts`), `src/config/maps.ts`, `src/lib/og/**`,
`src/app/terrain/**` (the `/terrain/[file]` route), `src/app/opengraph-image.tsx`,
`src/app/twitter-image.tsx`, `src/assets/fonts/**` (the OG TTFs + licence), `tests/e2e/og.spec.ts`.
Delivers: §3.2, §3.7 (incl. the SVG size budgets and `/terrain`), §6.2 helper + root OG routes,
biome tuning (visually checked at 320 px thumbnails, 1024 px canvas and 1200×630 OG; ground
luminance per §2.3), `drawTerrain`/`terrainBitmap`, `terrainToSvg`.
Imports: `src/lib/geo.ts`, `src/lib/brand/mark.ts` (OG mark) and `src/lib/brand/contours.ts`,
`src/config/site.ts` (`site.version` for `terrainUrl`).
Depends on: WP6's `mark.ts` (verbatim, create-if-missing).
Spec sections: 3.2, 3.7, 6.2, 7.1 (terrain rows), 7.3 (terrain budget).

#### WP3 — Map app UI, create/join, demo, activity (`map-ui`)

Owned paths: `src/components/map/**`, `src/app/(app)/layout.tsx`, `src/app/(app)/room/**`,
`src/app/(app)/demo/page.tsx`, `src/app/(app)/demo/opengraph-image.tsx`,
`src/app/(app)/create/**`, `src/app/(app)/join/**`, `src/app/(app)/activity/**`,
`src/lib/discord/**`, `src/lib/a11y/audit.ts`, `tests/e2e/room.spec.ts`,
`tests/e2e/demo.spec.ts`, `tests/e2e/mobile.spec.ts`, `tests/e2e/keyboard.spec.ts`.
(No `loading.tsx` — §3.14.)
Delivers: §3.13 (`MapPreview`, `HeroFrame`, `HeroPlayer`, `HeroStatic`, `MapAppLoader`,
`MapApp`), §4.2, §4.3 (all sub-sections), §4.4, §4.5, §4.7, the `(app)` layout with `Skip to
map`, `MarkerSprite`, `NodeList`, `GridLayer`, `ManageDialog`, `UploadMap`, mobile bottom
bar/sheets/FABs, `useDemoDirector`.
Imports: everything from WP1 (`@/lib/map`, `@/lib/realtime`, `@/lib/room`, `@/lib/storage`,
`@/store/room`), WP2 (`@/lib/terrain`, `@/config/maps`), WP6 primitives.
Depends on: WP1 store/transport and WP2 terrain for integration; builds every component against
the contracts with the memory transport and a stub model in Phase 1.
Spec sections: 3.13, 4.2–4.5, 4.7, 2.6–2.9 (app chrome), 5.6–5.7 (UI side), 7.2 specs 2, 4–6, 7.4.

#### WP4 — Admin simulator, dashboard, OpenAPI console (`admin`)

Owned paths: `src/lib/admin-sim/**`, `src/lib/openapi/**`, `src/components/admin/**`,
`src/components/console/**`, `src/app/(admin)/**` (the `(admin)` layout, `demo/admin/page.tsx`,
the `(dashboard)` layout, the five tab routes, `opengraph-image.tsx`), `src/app/(site)/rcon-api/**`
(written in Phase 2 on WP5's `DocsShell`), `tests/e2e/admin.spec.ts`, `tests/e2e/console.spec.ts`.
Delivers: §3.8, §3.9, §4.8, §4.9 `/rcon-api`, `DashboardLoader`, the sim `BroadcastChannel
wardogs:sim` bridge, "What this sends" sheet, inline SVG score charts.
Imports: `src/content/openapi.json` (WP5, byte copy, create-if-missing),
`src/lib/config-ini/validate.ts` (WP5 API — test double until merge 1) for the config endpoints,
`src/config/maps.ts` (WP2), WP6 primitives, `src/lib/og` (WP2) for its OG route,
`src/components/docs/DocsShell.tsx` (WP5, §3.15) for `/rcon-api` in Phase 2, `wardogs:identity`
via `src/lib/storage` (WP1) for the visitor callsign.
Depends on: WP5 `DocsShell` + `validateIni`, WP6 primitives, WP1 storage (all contract-shaped).
Spec sections: 3.8, 3.9, 4.8, 4.9 (console part), 7.1 (sim + openapi rows), 7.2 specs 7–8.

#### WP5 — Dev hub and docs content (`docs`)

Owned paths: `src/content/**` (dev docs modules, `types.ts`, `openapi.json`, `ServerSettings.ini`,
`rcon-prompt.ts`), `src/components/docs/**` (`DocsShell`, `DocSection`, `CodeBlock`, TOC,
`EndpointTable`, `DiscordStepper`, `ConfigValidator`, `IniViewer`), `src/lib/config-ini/**`,
`src/app/(site)/dev/**` (incl. `opengraph-image.tsx`), `src/app/(site)/rcon-reference/**`,
`src/app/(site)/discord-help/**`, `src/app/(site)/map-guide/**`, `src/app/openapi.json/route.ts`,
`src/app/ServerSettings.ini/route.ts`, `tests/e2e/docs.spec.ts`.
Delivers: §3.10, §3.15, §4.9 (all but `/rcon-api`), the route handlers, JSON-LD TechArticle usage.
Imports: `src/lib/openapi/parse.ts` (WP4 API — test double until merge 1) for the endpoint table
and the docs header version, WP6 primitives and `JsonLd`, `src/lib/og` (WP2) for the dev OG
route, `src/config/maps.ts` for the zone table.
Depends on: WP4 `parseSpec`, WP6.
Spec sections: 3.10, 3.15, 4.9, 6.4 (TechArticle), 7.1 (ini rows), 7.2 spec 9.

#### WP6 — Design system, site shell, home, add, legal, SEO plumbing, CI (`site`)

Owned paths: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (scaffold file;
**deleted in Phase 0**), `src/app/not-found.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`,
`src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/(site)/layout.tsx`,
`src/app/(site)/page.tsx`, `src/app/(site)/add/**`, `src/app/(site)/terms/**`,
`src/app/(site)/privacy/**`, `src/components/ui/**`, `src/components/site/**` (incl.
`contour-backdrop.tsx`, `json-ld.tsx`), `src/components/home/**`, `src/lib/brand/**` (`mark.ts`,
`contours.ts`), `src/lib/a11y/contrast.test.ts`, `src/lib/utils.ts`, `src/config/site.ts`,
`next.config.ts`, `package.json`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`,
`eslint.config.mjs`, `.prettierignore`, `.env.example`, `scripts/**` (`check-bundle.mjs`,
`bundle-baseline.json`), `.github/**`, `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`,
`docs/accessibility.md`, `docs/reports/README.md`, `public/**`, `tests/e2e/home.spec.ts`,
`tests/e2e/a11y.spec.ts`, `tests/e2e/seo.spec.ts`.
Delivers: §2 (all), §3.11, §3.12, §4.1, §4.6, §4.10, §4.11, §6.1, §6.3, §6.4, §7.3 bundle script
and baseline, §7.5, §7.6, the vitest webcrypto setup and Playwright relay entry (§7.1, §7.5),
`/r/:code` and the `/?frame_id` redirects, README with env vars (`NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_INVITE`, `NEXT_PUBLIC_GITHUB_URL`,
`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_RELAY_URL`, `RELAY_PORT`, `RELAY_ALLOWED_ORIGINS`),
Vercel + relay deploy docs, Discord Activity setup with the "Use Activities" note and the
`/relay` mapping, the kick trust model in README and Terms.
Imports: `HeroFrame`/`HeroStatic` (WP3), `listRecentRooms` (WP1, zod-free) and
`isRoomCode`/`normalizeCode` from `src/lib/room/code.ts` (WP1, pure) for the home code field and
Rejoin card, `markSvg` for icons.
Depends on: WP3 `HeroFrame`/`HeroStatic` for the final hero (Phase 2). Until WP3 lands, render
the tier-3 frame with a `Skeleton` inside; do not write a local stand-in for the map.
Spec sections: 2, 3.11, 3.12, 3.14, 4.1, 4.6, 4.10, 4.11, 6, 7.3, 7.5, 7.6.

### 8.4 Dependency graph

```
WP6 (primitives, tokens)  ──►  WP3, WP4, WP5 (render with them)
WP1 (types, reducer, store, transport) ──► WP3 (map app), WP6 (home code field / rejoin), WP4 (identity)
WP2 (terrain, maps, og, /terrain route) ──► WP3 (map, thumbnails), WP4/WP5 (OG routes, zone table)
WP4 (parseSpec) ──► WP5 (endpoint table)      WP5 (DocsShell, validateIni) ──► WP4 (console, config endpoints)
```
The WP4⇄WP5 cycle is broken by contracts: both sides are pure functions/components with exact
signatures in §3.9/§3.10/§4.9; build against the contract, integrate in Phase 2.

### 8.5 Definition of done (whole build)

On `main` after integration merge 2: `npm run check` green; `npm run build` green with the
bundle script passing; `npm run build:relay` green and `node server/dist/server/relay.js` serves
`/healthz`; `npm run e2e` green on both projects, including the relay half of `sync.spec`; every
route in §3.14 exists with its metadata; `/demo` paints the seed plan with JS disabled (the
server-rendered `MapPreview`) and is live with JS; a room survives reload; two tabs converge in
LOCAL mode and two browsers converge through the relay; the relay unit test passes; `docker
build -f server/Dockerfile .` succeeds; no file outside a package's owned paths was edited by
that package (reviewer diff check per `wp/*` branch); reports filed.

---

## Appendix A — Keyboard and gesture map (single source; render it in Controls & help)

| Key | Action | Context |
|---|---|---|
| `V` `P` `A` `L` `C` `R` `T` `M` | select, pen, arrow, line, circle, rect, text, measure | tools |
| `1`–`8` | FOB, Rally, LZ, OBJ, Enemy FOB, Enemy troops, Danger, Pin | markers (also 1–4 = kind inside the New request dialog) |
| `N` | new request | anywhere in the app |
| `X` | arm the ping tool (next click/tap pings; `Enter` pings at the crosshair; `Esc` disarms); `Shift+X` pings at the crosshair now | anywhere |
| `G` `F` `0` `+`/`=` `−` | grid, fullscreen, fit, zoom in, zoom out | view |
| `B` | brief mode | anywhere |
| `⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`, `Ctrl+Y` | undo, redo | own ops |
| `⌘/Ctrl+C` | copy room link | map focused, nothing selected, no text selection |
| `⌘/Ctrl+Shift+E` | export PNG | command roles |
| `Delete` / `Backspace` | remove selection | selection |
| Arrow keys | pan map / nudge selection 1 % (Shift 5 %) / move in node list | map focused |
| `Enter` | place the current marker at the crosshair / set point A then B for shapes, lines, measure / start and commit a pen stroke / open the text input / commit text / rename | map focused / editing |
| `Esc` | cancel placement, deselect, close dialog or sheet | anywhere |
| `?` | Controls & help | anywhere |
| `Space`+drag, middle-drag, wheel, `Ctrl`+wheel | pan, pan, zoom, zoom | pointer |
| `Shift`+drag | snap 15° / constrain square-circle | line, arrow, measure, rect, circle |
| One finger / two fingers / long-press / double-tap | tool / pan+zoom / marker palette / ping (on empty map) | touch |

## Appendix B — Marker glyphs (WP3 `MarkerSprite.tsx`; original artwork)

All glyphs are 32-unit `<symbol id="m-…">` elements in `<defs>` inside the map `<svg>`, with a
2-unit stroke, a filled backing shape for legibility on any terrain, and a label under them
(mono 10 px, uppercase, `text-0` with a dark halo); every glyph uses presentation attributes
only (§4.3.2 export contract) and sits in a screen-constant group (32 px at every zoom):
`fob` triangle-roof on a base (tent) in `friendly`; `rally` a flag in `rally`; `lz` a circle
with an H in `lz`; `obj` a double ring in `objective`; `enemy-fob` an inverted tent and
`enemy-troops` a diamond with two chevrons, both in the faction's tone — `enemy-a` or `enemy-b`
from `enemyTone(settings.team, marker.team)` — with the faction name in the label
(`AUSTIN · VALKYRA`); `danger` a warning triangle in `danger` with a translucent radius disc
(world-scaled); `pin` a teardrop in `warn`. **No marker is ever drawn in a team colour.**
Request pins are a crate glyph with the request number, coloured by state. Peer cursors are
small chevrons in the peer's ink colour with the callsign.

## Appendix C — Decisions log

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Persistence unit | Reduced `RoomState` with per-entity revs (LWW) | Op log with replay | Bounded memory on the relay and in localStorage; late-join is one snapshot; merge is entity-wise and testable. Ops remain the realtime unit. |
| Room route | `/room/[code]` + `/r/:code` redirect | `/r/[code]` only | Task requirement; upstream links keep working. |
| Hero | Live replay of the demo scenario, non-interactive, "take over" → /demo | Fully interactive hero | One map bundle on the home page, not two; keeps the (site) budget. |
| Grid | 10×10 A–J / 1–10 with keypad sub-cells | Upstream 8×5 | Square map; keypad sub-cells give the precision callouts need. |
| Keys | `R` = rect, `N` = new request, `X` = ping, `F` = fullscreen, `0` = fit | `R` = request, `P` = ping | No collisions; documented once. |
| Phases | Deferred | Build now | Scope; layer model supports it later. |
| CSP | Header CSP with `'unsafe-inline'`, no nonces | Nonce CSP via proxy.ts | Blank-site risk with Next inline scripts; still blocks third-party script injection. |
| Coverage | Review criterion; no `--coverage` flag | Enforced thresholds | `@vitest/coverage-v8` is not installed and no new deps are allowed. |
| Demo "other people" | Scripted bots on a shared wall-clock timeline | Real relay-only demo | Live the instant it loads with `npm run dev` alone; identical for everyone. |
| Admin sim time | Analytic state-at-time + command perturbations | Stepwise tick from epoch | O(1) per frame; deterministic across visitors and tabs. |
| Map guide | Rewritten for this codebase | Verbatim upstream pipeline doc | Must be true for the code it ships with. |
| Client id scope | Per browser (one person = one roster member) | Per tab | A second tab is the same person, not a ghost squadmate; the creator keeps `commander` when reopening in a new tab; the relay e2e uses two browser contexts instead. |
| Update ops | Per-field revs (`${entityKey}:${field}`) | Entity-level LWW for partial patches | Concurrent partial patches (move vs rename, claim vs note) converge in any order. |
| z-order | Derived canonical `(createdAt, id)` | Insertion-order list | Merge-invariant, permutation-invariant, no duplicates on re-add. |
| Tombstone compaction | Keep the newest 2,000 by rev | Drop older than 24 h | `Rev` carries no timestamp; count-based is deterministic. |
| Demo on a relay | Fresh room per epoch (`DEMO-<n>`), visitor is a member | In-place reset, visitor as co-commander | Nothing to merge back; strangers cannot switch the shared map. |
| Sim sharing | Same-browser BroadcastChannel only | Relay room `SIM` | Would need a new wire kind and a second reducer on the relay. |
| Terrain delivery | `/terrain/*` route, referenced by URL | Inline data URIs in HTML | HTML size, LCP, CDN caching. |
| Relay build | `tsc` node16 CommonJS + relative imports, slim image | `tsx` at runtime | No alias rewriting needed; image ships `ws` + `zod` only. |
| Bundle budgets | From the measured scaffold baseline (≈ 150 kB gz) | 120 kB | The Next 16 baseline alone is above 120 kB. |
| Build organisation | One worktree per package + integrator | One shared tree | Gates never see another package's half-written files. |
| Room code length | 6 (upstream parity) | 8 | Collision odds are acceptable at fan scale and documented (§5.3). |
| Frame limits | Per-kind table (`WIRE_LIMITS`), 2 MB for snapshots | Flat 64 kB | A room with a few hundred strokes must stay joinable. |

## Appendix D — Reference material for builders (read-only inputs)

- Upstream text for verbatim ports: `/tmp/claude-0/-home-user-War-dogs/61851c33-82db-5257-a90e-a5d704125fb0/scratchpad/devpages/rcon-reference.txt`,
  `…/devpages/discord-help.txt`, spec `…/devpages/openapi.json`, template `…/devpages/ServerSettings.ini`.
- Upstream UI reference (look, not pixels; never ship it): `…/scratchpad/ref/command.png`;
  page screenshots under `…/scratchpad/shots/`. The upstream OG composition `…/ref/og.png`
  informs §6.2; regenerate with our mark.
- Do not copy any image from the reference folders into the repo.

## Appendix E — Revision log

**1.1 (2026-09-11)** — after the critic's review:
- Reducer: per-field revs for `node.update` / `request.update` / `roster.update`; add/remove stay
  entity-level and clear field revs; `order` is derived canonical z-order; `mergeStates` defined
  field-wise; causal-delivery assumption stated; `inverseOf` batches (`MAX_NODES_PER_OP`);
  `createRoomState` takes `actor`; `Marker.team` and `enemyTeams()` for enemy factions.
- Wire: per-kind frame limits (`WIRE_LIMITS`), `sync.ops` is `seq >= since`, wire `seenAt`
  ignored, wrong-room frames dropped, demo relay room `DEMO-<epochIndex>`, `SIM` removed.
- Identity: client id stays per browser (decision logged); `online` derived from presence;
  `pagehide` sends only `bye`; single-writer flips stale members.
- Relay build: `tsc` node16 CommonJS with relative imports in relay-reachable modules; slim
  Docker image; relay started by Playwright for the e2e.
- Discord: `/?frame_id` → `/activity` redirect; no internal navigation in activity mode; relay
  through the `/relay` URL mapping; `discordsays.com` in CSP and `RELAY_ALLOWED_ORIGINS`.
- Next 16: `MapAppLoader` / `HeroFrame` / `DashboardLoader` own `dynamic()`; no `useSearchParams`
  on prerendered pages; `await searchParams`/`params`; no `loading.tsx`; scaffold `page.tsx`
  deleted by WP6; `(admin)` route group owned by WP4; `(app)` layout has no fixed height.
- Design: rail 80 px; markers screen-constant and always `friendly`/`enemy-a`/`enemy-b`;
  presentation attributes for export; `ContourBackdrop` component instead of a CSS utility;
  concrete `hud-corners`; text-colour tokens; H1 44 px at 390; steps stack on phones; mobile
  position/z-index table; states table; keyboard paths for every tool; visible NodeList; one
  live region; skip links per group.
- Terrain: `/terrain/[file]` route by URL, SVG size budgets, `detail` option, ground luminance.
- Storage: `MAX_STATE_BYTES` 600 kB, 5 recent rooms, count-based tombstone compaction, no
  `storage`-event fallback, idb memory fallback, `wardogs:relay` override, sim actor = identity.
- Quality bar: budgets from the measured baseline and a bundle script that reads prerendered
  HTML; one `NEXT_PUBLIC_SITE_URL` in CI; `.next/cache` excluded; soft LCP/CLS; `page.clock`
  pinned; CSP production-only with a `/rcon-api` connect-src; worktree-per-package build.
