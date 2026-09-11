# wardogs.tech clone — BUILD SPEC (authoritative)

Version 1.0 · 2026-09-11 · Lead architect spec. Builders work from this document only.
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
- Section 8 partitions the work into six packages with **owned paths**. You only create or edit
  files inside your package's owned paths, plus the contract files (see the create-if-missing
  rule in 8.2). Anything else is requested through your report.
- "Upstream" means https://wardogs.tech as captured on 2026-09-10 (v0.27). We reproduce its
  product, IA, brand and voice; we do not reproduce its code, its map art or its screenshots.

Terminology: **war room** = a shared map identified by a six-character code. **Node** = anything
drawn on the map (stroke, shape, marker, text, measurement). **Op** = one replayable state change.
**Relay** = the optional WebSocket server in `server/`. **LOCAL mode** = no relay configured; sync
is same-browser only via BroadcastChannel.

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
| Well-tested | Pure engine (op-log reducer, terrain, simulator, OpenAPI parser, ini validator) with ≥ 90 % line coverage; component tests for panels; Playwright journeys on desktop and Pixel 7 including two-tab convergence. |
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
- *Landing "stats band" with fake counts* — allowed only with build-time-true numbers (§4.1).

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
  --t-display-1: clamp(3rem, 7vw, 6.5rem);      /* hero H1 */
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
- App chrome is on an 8 px grid: top bar 48, rail 56, rail buttons 40, panel column 320,
  request card min-height 64, roster row 40, zoom-stack buttons 36, mobile bottom bar 56,
  FABs 48. Minimum touch target 40 px; 44 px for anything on the mobile bottom bar / FABs.

### 2.3 Colour usage rules

- Amber (`accent`) is for: primary CTAs, eyebrows, active tool, selected chips, the commander
  badge, control-zone rings, focus rings. Never for body text. Amber-on-amber-soft chips must
  use `text-accent` on `bg-accent-soft` only at ≥ 12 px mono uppercase.
- Team colours (`lonestar` blue, `valkyra` red, `manticore` green) mark **team identity only**:
  team pickers, the friendly marker group header, scoreboard columns, roster dots in the admin.
- Ink colours (`INK_HEX` in §3.1) are for map ink only. `friendly` and `info` share `#5fb8ff`;
  `info` is used only for POST method badges and info Badges, never near the map.
- Request state colours: `req-open` (text-0), `req-claimed` (accent), `req-delivered` (muted).
  Colour is never the only signal: state also appears as text and an icon.
- Semantic: `ok` = relay live dot, GET badges; `warn` = LOCAL pill, PUT badges, timers > 60 s;
  `danger` = destructive actions, DELETE badges, timers > 120 s, RECONNECTING pill.
- Discord blurple `#5865F2` appears only inside the Discord glyph, never as a fill for our
  buttons except the `discord` Button variant (sign-in / add buttons).
- Text contrast: `fg-muted` on `bg-1` ≥ 4.5:1 (it is 6.1:1); `fg-faint` is decorative only
  (labels that repeat visible information, version tags). Asserted in `src/lib/a11y/contrast.test.ts`.

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
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%);
}
@utility bg-contours { /* 6–8 closed contour rings, amber at 7 %, 1200x800 tile, top-right, no-repeat.
  The SVG is a build-time constant exported from src/lib/brand/contours.ts (WP6), inlined as a data URI. */ }
@utility hud-corners { position: relative; }  /* ::before/::after draw 10px L ticks, 1.5px, accent/60, at the four corners */
@utility vignette { /* radial-gradient(120% 80% at 50% -10%, rgba(255,160,40,0.06), transparent 60%) as an extra background layer */ }
@utility scanlines { background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px); }
```

Rules: any single surface uses **at most two** textures. `bg-contours` only behind the home
hero and page-title blocks. `hud-corners` only on the hero map frame, the admin live server
card, the war-room top bar and the create/join form panel. `scanlines` only inside the LIVE
pill. `vignette` on the `(site)` layout wrapper only, never on app routes. Never any texture
behind body text.

### 2.6 Component inventory

Existing primitives in `src/components/ui` (keep APIs, extend as listed; WP6 owns):

| Component | Keep | Add |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClasses` | variants `primary secondary ghost danger discord`, sizes `sm md lg` | variants `icon` (40×40, ghost; `active` → `bg-accent-soft text-accent` + 2 px left accent rule) and `chip` (h-8, mono 11 px 0.14em uppercase, `rounded-sm`; selected → `bg-accent text-accent-ink`); size `icon`; props `loading?: boolean` (label → three-dot mono pulse, width locked, `aria-busy`), `active?: boolean` (sets `aria-pressed`), `kbd?: string` (trailing `<Kbd>`); `focus-visible` on primary uses `outline-offset: 3px` plus `box-shadow: 0 0 0 1px var(--bg-0)`. md min-height 44 px on touch (`@media (pointer: coarse)`). |
| `Card`, `CardEyebrow`, `CardTitle`, `CardBody` | | `Card` prop `tier?: "panel" \| "link" \| "live"` (see 2.7); `LinkCard` (`href`, renders arrow top-right, whole card is the link). `CardTitle` uses `display display-3`. |
| `Container` | | max-width 1280, gutters 24/40/64. |
| `Badge` | tones | tone `team` with `team` prop (dot in team colour). |
| `Input`, `Label` | | `Textarea`, `Field` (label + control + helper/error, wires `aria-describedby`/`aria-invalid`), `CodeInput` (six mono cells, §4.5). |
| `Logo`, `LogoMark`, `Wordmark` | API | new mark geometry (2.8). |
| `icons.tsx` | Discord, GitHub | nothing (marker glyphs live in `src/components/map/MarkerSprite.tsx`). |

New primitives (WP6 owns; exact APIs in §3.8): `Kbd`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`,
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
the path data (§3.7) so the OG renderer draws the same mark.

### 2.9 Responsive rules

Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Design from 360 px up. No horizontal
scroll on any route (e2e asserts `document.documentElement.scrollWidth <= innerWidth`). Gutters
≥ 16 px everywhere. Safe-area insets (`env(safe-area-inset-*)`) on fixed bars in the app and on
the sticky submit bar of forms. Only tables and code blocks may exceed the width, each inside
`overflow-x-auto`. Page zoom is never locked (`user-scalable` stays default); the map viewport
uses `touch-action: none` so pinch inside it zooms the map, not the page.

Marketing pages at 390 px: H1 44 px / 0.92, sub 17 px, primary CTA full-width h-12, the two
outline buttons side by side as a 2-col grid with 12 px mono labels; How-it-works becomes a
horizontal snap-scroll track (cards 80vw, `scroll-snap-type: x mandatory`, 12 px gap, dot
indicators, still keyboard scrollable); exit cards stacked 16 px gap.

Header: sticky, 64 px (56 mobile), `bg-bg-0/80 backdrop-blur-[12px]`, bottom `border-line`
appears only after 8 px scroll (a sentinel + `IntersectionObserver` sets `data-scrolled`).
Mobile menu: full-height sheet with 20 px links and the primary CTA at the bottom. App routes
never render `SiteHeader`; they render the app top bar instead.

---

## 3. Shared contracts

### 3.0 Contract rules

- The files in this section are **contract files**. Their content is given verbatim (or as
  exact signatures where marked "API"). The owning package (§8) writes them first, byte-for-byte.
- **Create-if-missing rule:** any builder whose package imports a contract file that does not
  exist yet may create it with the exact content from this spec. Only the owner may edit it
  afterwards. Two builders creating the same file with identical content is not a conflict.
- All ids are strings from `newId()` (§3.4). All timestamps are `Date.now()` ms. All map
  geometry is normalised `[0, 1]` on the square map (upstream convention).
- Every contract module is pure (no DOM, no React) unless it says otherwise, and unit-tested.

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

### 3.2 `src/lib/terrain/types.ts` (WP2)

```ts
import type { Point, Rect } from "@/lib/geo";

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
import type { Team } from "@/config/site";
import type { Point } from "@/lib/geo";
import type { ControlZoneId, MapId } from "@/lib/terrain/types";

export type { Point, Team, MapId, ControlZoneId };

/** Opaque per-browser client id: "wd_" + 12 base32 chars (src/lib/storage/identity.ts). */
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
  /** User label, may be "". Default label is MARKER_META[kind].short. */
  label: string;
  /** Danger area radius as a fraction of map width; null for every other kind. */
  radius: number | null;
}
export interface TextLabel extends NodeBase {
  t: "text";
  at: Point;
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
  | { kind: "upload"; hash: string; w: number; h: number; mime: string; name: string };
export interface RoomSettings {
  team: Team;
  map: MapId;
  controlZone: ControlZoneId;
  squadMode: boolean;
  /** Squad names when squadMode; default ["Alpha", "Bravo", "Charlie"]. */
  squads: string[];
  drawAccess: DrawAccess;
  mapSource: MapSource;
}

/** Last-writer-wins revision. Ordering: seq, then actor (string compare). */
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
  /** z-order = insertion order of node ids. */
  order: string[];
  requests: Record<string, SupplyRequest>;
  roster: Record<string, RosterMember>;
  /** Rev per entity key: node id | request id | `roster:${clientId}` | `settings:${field}`. */
  revs: Record<string, Rev>;
  /** Removed entity keys (nodes, requests, roster) with the rev that removed them. */
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
  | { t: "node.add"; nodes: MapNode[] }
  | { t: "node.update"; id: string; patch: NodePatch }
  | { t: "node.remove"; ids: string[] }
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
export const MAX_STATE_BYTES = 1_500_000;
```

### 3.4 Map engine API (WP1) — `src/lib/map/*`

`src/lib/map/ids.ts`
```ts
export function newId(): string;                 // 16 chars, base32 alphabet (same as room codes), crypto RNG with Math.random fallback
export function newClientId(): ClientId;         // "wd_" + 12 base32 chars
export function seededIds(seed: number): () => string;  // deterministic ids for scenarios/tests
```

`src/lib/map/reduce.ts` — pure, structural sharing, never throws on valid input.
```ts
export function createRoomState(init: { code: string; settings: RoomSettings; createdAt: number }): RoomState;
export function compareRev(a: Rev, b: Rev): number;             // seq asc, then actor asc
export function isStale(state: RoomState, key: string, rev: Rev): boolean; // true if revs[key] or tombstones[key] >= rev
export function applyOp(state: RoomState, op: Op): RoomState;   // returns the SAME reference when the op is stale/ignored
export function applyOps(state: RoomState, ops: Op[]): RoomState;
export function mergeStates(a: RoomState, b: RoomState): RoomState; // entity-wise higher rev wins; tombstones beat lower-rev entities; order = a.order then new ids from b.order
export function inverseOf(state: RoomState, op: Op): OpBody | null;  // computed against the state BEFORE the op; null when not invertible (roster.*, settings.update)
export function nextSeq(state: RoomState, incoming?: number): number; // max(state.seq, incoming ?? 0) + 1
```
Reducer rules (must all be unit-tested):
- Entity keys: node id; request id; `roster:${id}`; `settings:${field}` (one rev per settings field).
- An op is applied to an entity only if its `{seq, actor}` is greater than both `revs[key]` and
  `tombstones[key]`; otherwise that entity is skipped. `node.add`/`node.remove`/`layer.clear`
  evaluate per node; an op that changes nothing returns the same state reference.
- `node.add` re-adds a tombstoned node if its rev is higher (this is how undo-of-delete works).
- `node.remove` and `layer.clear` write tombstones and delete from `nodes` and `order`.
- `node.update` applies only the patch keys valid for the node's `t`: stroke `color layer
  points`; shape `a b color layer`; marker `at label radius layer`; text `at text color size
  layer`; measure `a b color layer`. Other keys are dropped silently.
- `request.update` is a plain merge; the *rules* of the request lifecycle live in `requests.ts`.
- `roster.upsert` replaces the member; `roster.update` merges; `roster.remove` tombstones.
- `state.seq = max(state.seq, op.seq)` always, even when the op is ignored.
- Caps: after `node.add`, if `order.length > MAX_NODES` the oldest strokes are dropped from the
  result (no tombstone) — the store's single-writer (§5.6) additionally emits a `node.remove`.

`src/lib/map/schema.ts` — zod v4 schemas: `PointSchema`, `MapNodeSchema` (discriminated union),
`SupplyRequestSchema`, `RosterMemberSchema`, `RoomSettingsSchema`, `RoomStateSchema`,
`OpSchema` (discriminated on `t`), `RoomSnapshotSchema`, `CallsignSchema` (trimmed, 2–24 chars,
no control chars), `RoomCodeSchema` (§5.3). Export `parseSnapshot(json: unknown): RoomSnapshot | null`
(never throws; logs once in dev) and `migrateSnapshot(raw: unknown): RoomSnapshot | null` (v1 only).

`src/lib/map/history.ts`
```ts
export interface HistoryEntry { op: Op; inverse: OpBody }
export interface History { undo: HistoryEntry[]; redo: HistoryEntry[] }
export function createHistory(): History;
export function pushHistory(h: History, entry: HistoryEntry, cap?: number): History; // cap 200, clears redo
export function popUndo(h: History): { history: History; entry: HistoryEntry | null };
export function popRedo(h: History): { history: History; entry: HistoryEntry | null };
```
Undo emits the inverse **as a new op** (fresh meta); redo re-emits the original body as a new op.
Shared state is never rewound.

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
export function simplify(points: Point[], tolerance: number): Point[];          // Ramer–Douglas–Peucker; tolerance 0.0008 on commit
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
  tool: Tool; ink: InkColor; markerKind: MarkerKind; layer: LayerId;
  author: ClientId; authorName: string; widthMetres: number | null; now: () => number; id: () => string;
}
export interface ToolSession { preview: ToolPreview; down(s: Sample): ToolSession; move(s: Sample): ToolSession; up(s: Sample): { session: ToolSession; op: OpBody | null; commit?: MapNode }; cancel(): ToolSession }
export function startTool(ctx: ToolContext): ToolSession;
```
Rules: pen commits one `node.add` with a simplified stroke on `up` (min 2 points; a tap with the
pen = a 2-point dot). arrow/line/circle/rect commit on `up` when `distance(a, b) > 0.004`; Shift
snaps line/arrow/measure to 15° via `snapAngle`; Shift on rect/circle constrains to square/circle.
`measure` commits a `Measurement` node. `marker` commits on `down` (tap). `text`, `request`,
`ping`, `select` are handled in the UI (they need DOM input), not here.

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

`src/lib/map/roster.ts`
```ts
export function canDraw(m: RosterMember | null, s: RoomSettings): boolean;         // everyone → true; request → role !== "member" || m.canDraw
export function isCommand(m: RosterMember | null): boolean;                         // commander | co-commander
export function focusTally(roster: RosterMember[]): Record<Focus, number>;          // online members only
export function focusWarnings(t: Record<Focus, number>): string[];                  // ["No pilot in room", "No medic in room"]
export function visibleLayers(s: RoomSettings, m: RosterMember | null): LayerId[]; // squadMode off → ["team"]; command → all; member → ["team", `squad:${m.squad}`]
export function editableLayer(s: RoomSettings, m: RosterMember | null): LayerId;   // squadMode off or command → "team"; member → `squad:${m.squad ?? s.squads[0]}`
export function isIdle(m: RosterMember, presence: Presence | undefined, now: number): boolean; // no presence.seenAt within 90 s
export function successor(roster: RosterMember[], leaving: ClientId): RosterMember | null;   // earliest-joined online co-commander, else earliest-joined online member
export function singleWriter(roster: RosterMember[], presence: Record<string, Presence>, now: number): ClientId | null; // lowest client id among members with presence within 30 s
```

`src/lib/map/plan.ts` — export/import (pure; the PNG part is in `src/lib/map/export-png.ts`, browser-only).
```ts
export function planToText(state: RoomState, mapName: string, now: number): string; // Markdown for Discord: header line, FRIENDLY / ENEMY / MARKS lists with grid refs and labels, OPEN REQUESTS with by/claimed/age
export function planToSnapshot(state: RoomState, now: number): RoomSnapshot;
export function importPlan(target: RoomState, incoming: RoomSnapshot, mode: "replace" | "merge", actor: ClientId, now: number): OpBody[]; // replace = layer.clear all + node.add; merge = node.add of nodes whose ids are new (ids re-minted on collision)
```
`src/lib/map/export-png.ts` (browser):
`exportPng(svgEl: SVGSVGElement, terrain: HTMLCanvasElement | ImageBitmap, legend: { code: string; team: string; map: string; zone: string; date: string }, size?: number): Promise<Blob>` — draws terrain, then the serialised SVG (`XMLSerializer` → Blob URL → `Image`), then a 56 px legend strip bottom-left in mono; default 2048 px.

`src/lib/map/scenario.ts` (WP1) — the demo/hero scenario (§4.2):
```ts
export interface ScenarioEvent { at: number; kind: "op"; body: OpBody; actor: ClientId; actorName: string }
export interface ScenarioPing { at: number; kind: "ping"; ping: Omit<Ping, "id" | "ts"> }
export type ScenarioItem = ScenarioEvent | ScenarioPing;
export const DEMO_EPOCH_MS = 300_000;
export const DEMO_BOTS: readonly RosterMember[];              // Ossian (commander, infantry), Krieger (pilot), Boston (medic), Rook (recon)
export function demoSeedState(now: number): RoomState;          // code "DEMO", Lonestar, zestafona, default zone, the seed plan and 3 requests
export const DEMO_TIMELINE: readonly ScenarioItem[];            // sorted by `at` (ms from epoch start), all < DEMO_EPOCH_MS
export function epochStart(now: number): number;                // now - (now % DEMO_EPOCH_MS)
export function stateAt(now: number): { state: RoomState; nextIndex: number };  // seed + all ops with at <= now - epochStart
export const HERO_TIMELINE: readonly ScenarioItem[];            // the seed plan appearing node by node over ~5 s, then 8 items at 2.5 s spacing; loops
```

### 3.5 `src/lib/realtime/transport.ts` (WP1) — FROZEN

```ts
import type { ClientId, Identity, Op, Ping, Point, Presence, RoomState, SyncStatus } from "@/lib/map/types";

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
  /** NEXT_PUBLIC_RELAY_URL; undefined → broadcast. */
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

`src/lib/realtime/schema.ts` exports `WireMessageSchema` (zod, discriminated on `k`) and
`parseWire(raw: string, maxBytes: number): WireMessage | null`. Both client and relay validate
every inbound frame; a bad frame is dropped (relay: counted, socket closed after 20 bad frames).

Status semantics: broadcast transport → `"local"` always. ws → `"connecting"` until the socket
opens and hello is sent, then `"live"`; on close → `"reconnecting"` with backoff; after 10
consecutive failures → `"offline"` (still retries every 15 s). `"offline"` is shown as
RECONNECTING… in the UI with the attempt count in the tooltip.

### 3.6 Relay wire protocol (WP1, `server/relay.ts`)

- HTTP: `GET /healthz` → `200 {"ok":true,"rooms":n}`. Everything else 404.
- WebSocket upgrade on `GET /ws?room=<CODE>`; `Origin` must be in `RELAY_ALLOWED_ORIGINS`
  (comma list; `*` allowed for dev). Room code validated with `RoomCodeSchema` or `DEMO`.
- First frame must be `hello` within 5 s. On hello: `room.state = mergeStates(room.state, hello.snapshot)`
  (when either exists), reply `sync.snapshot` with the merged state (if any), then broadcast
  `presence`. If `hello.seq < room.seq` and the relay has the tail, it may send `sync.ops` instead.
- `op`: validate; `room.state = applyOp(...)`; append to `room.ops` (ring of 500); fan out to
  every other socket in the room.
- `sync.request {since}`: reply `sync.ops` if all ops after `since` are in the ring, else `sync.snapshot`.
- `ping`, `cursor`, `map.request`: fan out, never stored. `map.chunk`: fan out; the relay also
  caches the last uploaded map per room (≤ 1.5 MB assembled) to answer later `map.request`s.
- Presence: relay tracks `{client, callsign, seenAt}` per socket; broadcasts `presence` on
  join/leave and every 15 s; `cursor` refreshes `seenAt`.
- Limits: 60 frames/s per socket (excess → `error rate-limit`, then close at 3 strikes);
  frame ≤ 64 kB except `map.chunk` ≤ 256 kB; ≤ 64 sockets per room (`error room-full`);
  ≤ 2,000 rooms; room evicted after 6 h idle; state size ≤ `MAX_STATE_BYTES` (older strokes dropped).
- Env: `PORT` (8787), `RELAY_ALLOWED_ORIGINS`, `RELAY_MAX_ROOMS`, `RELAY_IDLE_HOURS`.
- Relay imports the reducer from `../src/lib/map/reduce.ts` and schemas from
  `../src/lib/realtime/schema.ts` (pure modules; compiled by `tsc -p server/tsconfig.json`).

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
export interface SvgOptions { size: number; labels?: boolean; grid?: boolean; zone?: ControlZoneId; crop?: { x: number; y: number; w: number; h: number }; background?: boolean }
export function terrainToSvg(model: TerrainModel, opts: SvgOptions): string;     // complete <svg …> string, viewBox 0 0 size size
export function terrainToDataUri(model: TerrainModel, opts: SvgOptions): string;  // "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
export function biomePalette(biome: Biome): { ground: string; low: string; high: string; water: string; road: string; block: string; wood: string; field: string; contour: string; label: string };
```
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

`src/lib/admin-sim/types.ts`
```ts
import type { Team } from "@/config/site";
import type { ControlZoneId, MapId } from "@/lib/terrain/types";

export type Lighting = "Day Clear" | "Day End Clear" | "Dusk Overcast" | "Night Clear";
export const LIGHTINGS: readonly Lighting[];
export interface SimPlayer { steamId: string; name: string; team: Team; joinedAt: number; kills: number; deaths: number; cash: number; pingMs: number }
export interface SimBan { steamId: string; name: string; bannedAtUtc: string; bannedBy: string; reason: string; evidenceUrl: string | null; expiresAt: number }
export interface RotationEntry { map: MapId; experiences: string[]; lighting: Lighting; zoneAlternator: ControlZoneId; status: "now" | "next" | ""; denied: boolean }
export interface ScorePoint { t: number; scores: Record<Team, number> }
export interface MatchRecord { n: number; map: MapId; zone: ControlZoneId; lighting: Lighting; startedAt: number; endedAt: number; final: Record<Team, number>; winner: Team; timeline: ScorePoint[]; players: { steamId: string; name: string; team: Team; kills: number; deaths: number; seconds: number }[] }
export interface PlayerSession { steamId: string; name: string; from: number; to: number; matchN: number }
export interface AuditEntry { id: string; at: number; actor: string; mine: boolean; action: AdminCommand["t"]; target: string | null; result: "ok" | "refused"; detail: string; rcon: RconCall }
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
export function toRcon(cmd: AdminCommand): RconCall;        // exact method/path/body from openapi.json for the "What this sends" slide-over
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
export function markSvg(opts: { size: number; plate: string; stroke: string; accent: string; core: string; ticks: string | null; chevronWidth?: number }): string;  // string SVG for OG images and icons
```

### 3.12 UI primitive APIs (WP6) — `src/components/ui/*`

```ts
// kbd.tsx
export function Kbd(props: { children: React.ReactNode; className?: string }): JSX.Element;  // mono 10px, 1px border, renders "⌘"/"Ctrl" via useModifierKey()
export function useModifierKey(): "⌘" | "Ctrl";

// dialog.tsx — native <dialog>, showModal(), focus first control, restore focus on close, Esc closes, `inert` on #app-root while open
export function Dialog(props: { open: boolean; onClose: () => void; title: string; description?: string; size?: "sm" | "md" | "lg"; children: React.ReactNode; footer?: React.ReactNode; initialFocusRef?: React.RefObject<HTMLElement | null> }): JSX.Element;
export function ConfirmDialog(props: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: React.ReactNode; confirmLabel: string; tone?: "danger" | "primary"; reasonField?: { label: string; value: string; onChange: (v: string) => void; required?: boolean } }): JSX.Element;

// sheet.tsx — side="right" (desktop panel, 360px) | "bottom" (mobile; snap: "peek" 56px | "half" 50vh | "full" 90vh, tapping the handle cycles, vertical drag optional). role="dialog" when modal, else role="region".
export function Sheet(props: { open: boolean; onClose: () => void; side: "right" | "bottom"; title: string; modal?: boolean; snap?: "peek" | "half" | "full"; onSnap?: (s: "peek" | "half" | "full") => void; handleBadge?: number; children: React.ReactNode }): JSX.Element;

// tabs.tsx — WAI-ARIA tabs, roving tabindex, arrow keys
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

// toast.tsx — zustand store; <Toaster/> mounted once per layout; region aria-live="polite"
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
export function CodeInput(props: { value: string; onChange: (v: string) => void; onSubmit?: () => void; error?: string; autoFocus?: boolean; id: string }): JSX.Element;  // 6 mono cells, uppercase, paste support, auto-advance, Backspace moves back
```

### 3.13 Map UI exports consumed by other packages (WP3) — `src/components/map/*`

```ts
// MapPreview.tsx — server-renderable static scene (no hooks). Renders terrain SVG (data URI <img> or inline) + node layers via the same React SVG components the live app uses.
export function MapPreview(props: { state: RoomState; model: TerrainModel; size?: number; showGrid?: boolean; className?: string; title?: string }): JSX.Element;

// HeroPlayer.tsx ("use client") — owns its state; plays HERO_TIMELINE on a loop; renders MapPreview; static finished plan under reduced motion; "Take over" overlay link to /demo.
export function HeroPlayer(props: { className?: string }): JSX.Element;
// HeroStatic.tsx — server component: the finished plan, rendered on the server as the LCP element and the no-JS fallback.
export function HeroStatic(props: { className?: string }): JSX.Element;

// MapApp.tsx (default export, "use client", dynamically imported by the (app) pages)
export default function MapApp(props: { mode: "room" | "demo" | "activity"; code: string; joinHint?: { team?: string; squad?: string } }): JSX.Element;
```

### 3.14 Route map

| Route | Type | Group / layout | Metadata (title · description) | Robots |
|---|---|---|---|---|
| `/` | static | `(site)` — SiteHeader/SiteFooter, `vignette` | default title `wardogs.tech — the tactical map every Wardogs server needs` · site.description | index |
| `/create` | static shell, client form | `(app)` chromeless | `Open a war room` · "Pick your team, map and control zone. Open a shared war room in one click." | index |
| `/join` | static shell, client form (reads `?code=`) | `(app)` | `Join a war room` · "Enter a six-character code and your callsign." | index |
| `/room/[code]` | dynamic (client-rendered app in a static shell) | `(app)` | `War room` · "A shared tactical map. Open it in your Discord voice channel." | **noindex** |
| `/r/[code]` | redirect → `/room/[code]` (next.config `redirects()`, permanent) | — | — | — |
| `/demo` | static shell + client app | `(app)` | `The live demo` · "A shared map with people in it right now. No sign-in. Resets every five minutes." | index |
| `/demo/admin` | static | `(app)` with the admin strip | `Dashboard demo` · "Run a Wardogs server from one dashboard. An early build, open to anyone." | index |
| `/demo/admin/live`, `/rotation`, `/history`, `/bans`, `/audit` | static shells + client dashboard | `(app)` admin layout with tabs | `Live · Dashboard demo` etc. | noindex |
| `/activity` | static shell + client (Discord SDK) | `(app)` | `Activity` | noindex |
| `/add` | dynamic (reads `?to=account`; `redirect()` when configured) | `(site)` | `Add to Discord` | noindex |
| `/dev` | static | `(site)` + docs shell (UNOFFICIAL strip) | `Run your server` · "Everything for running a Wardogs dedicated server in one place." | index |
| `/rcon-reference` | static | `(site)` docs | `Wardogs Server Reference (Unofficial)` · "The RCON HTTP API and ServerSettings.ini, every endpoint and key documented." | index |
| `/rcon-api` | static shell + client console | `(site)` docs | `API Console` · "Browse every RCON endpoint with live examples. Try it against the in-browser simulator or your own server." | index |
| `/discord-help` | static | `(site)` docs | `Discord help` · "The map will not launch in a voice channel: the permission that causes it, temp channels, and the one-minute test." | index |
| `/map-guide` | static | `(site)` docs | `Map guide` · "How this site draws its maps, the coordinate system, grid references and custom uploads." | index |
| `/openapi.json` | route handler (GET) | — | `application/json`, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` | — |
| `/ServerSettings.ini` | route handler (GET) | — | `text/plain; charset=utf-8`, `Content-Disposition: attachment; filename="ServerSettings.ini"` | — |
| `/terms` | static | `(site)` | `Terms of Service` | index |
| `/privacy` | static | `(site)` | `Privacy Policy` | index |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image`, `/twitter-image`, `/icon`, `/apple-icon` | metadata routes | — | §6 | — |
| not-found | static | `(site)` | `Not found` | noindex |

Layouts: `src/app/layout.tsx` (root: fonts, `<Toaster/>`, `<LiveRegion/>`, skip link, JSON-LD
WebSite); `src/app/(site)/layout.tsx` (SiteHeader, `<main id="main">`, SiteFooter, `vignette`);
`src/app/(app)/layout.tsx` (chromeless: `<main id="main" class="h-dvh">`, no header/footer;
`export const viewport` adds `interactiveWidget: "resizes-content"`). Docs pages use
`src/components/docs/DocsShell.tsx` inside `(site)`.

---

## 4. Page-by-page spec

Conventions for this section: **Copy** blocks are final. `display` headlines are written in
sentence case here and rendered uppercase by the utility. "Eyebrow" = `eyebrow` utility.
Every page: one `<h1>`, landmarks (`header nav main footer`), all controls labelled, `focus-visible`
visible, no colour-only state. Every interactive element listed has a keyboard path.

### 4.1 Home `/` (WP6; imports `HeroPlayer`/`HeroStatic` from WP3)

Layout: `(site)`. Sections in order:

**1. Hero** — contained, `bg-contours` top-right, `pt-16 lg:pt-24`. Two columns at `lg`:
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
  uppercase) with an icon submit; Enter navigates to `/room/<CODE>` after `RoomCodeSchema`
  validation (inline error `Codes are 6 letters or digits, never 0, O, 1 or I.`).
- When `site.discord.clientId` is empty (build-time): the primary CTA becomes `Try the live
  demo` → `/demo` and `Add to your server` becomes a secondary button with a `Setup required`
  Badge (tone warn) → `/add` (which renders the setup page).
- Rejoin card (client island `src/components/home/RecentRooms.tsx`, WP6; reads
  `listRecentRooms()` from `src/lib/storage/rooms.ts`): when local history exists, a tier-1 card
  under the CTAs: eyebrow `Rejoin`, rows `X5GM4Q · Lonestar · Zestafona · 12 min ago` → `/room/X5GM4Q`,
  max 3, with a `Forget` ghost icon button per row (confirm not needed). Hidden until hydrated
  (no layout shift: reserve nothing; it appears below the CTAs).
- Right: `<HeroPlayer>` inside a tier-3 frame: 16:10 aspect, `rounded-xl border-line-strong
  shadow-panel hud-corners` plus amber ground glow `shadow-[0_40px_120px_-40px_rgba(255,160,40,0.25)]`.
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
At 390 px: horizontal snap-scroll track (§2.9).

**3. Proof band** — full-bleed `bg-bg-1 bg-grid bg-grid-masked`, `border-y border-line`, 64 px
padding. Four stats set `display` 40 px with eyebrows, all computed from code at build time:
`Maps` **3** · `Marker types` **8** · `Sign-in needed` **0** · `Install size` **0 MB**
(sub-label `it is a web page`). No user counts, ever.

**4. Exit cards** — three tier-2 link cards (eyebrow, lucide icon, `display display-3` title,
body, arrow top-right):
- eyebrow `Just looking` · Eye icon · **The live demo** · `A shared map with people in it right
  now. No sign-in, works right now.` → `/demo`
- eyebrow `Run a server` · BookOpen · **Docs for server owners** · `The RCON reference, the
  config guide and an API console you can run against a simulator. Public, no account.` → `/dev`
- eyebrow `Coming soon` · ShieldCheck · **Server admin in the same Discord** · `Live players,
  match history, bans with evidence. In closed testing; click around the fully working preview.`
  → `/demo/admin`

**5. FAQ** — contained, `max-w-3xl`. Eyebrow `Questions`; H2 **Before you add it**. Five
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
left; `Fan-made. Not affiliated with Bulkhead or Team17.` centre in mono 12 px; links right:
`Community Discord` (external), `GitHub` (external), `Terms`, `Privacy`.

States: no JS → hero shows `HeroStatic` and the code field still submits as a GET form to
`/join?code=` (progressive enhancement: the form's `action="/join"`, `name="code"`). Errors: none.
A11y: hero frame described; FAQ uses native `<details>`; snap track is a `role="list"`.

### 4.2 `/demo` (WP3)

Layout: `(app)` chromeless. Server shell: the app top bar with `DEMO` code chip and a `LIVE
DEMO` badge, the tool rail skeleton (11 grey 40 px squares), the panel headers `Requests` /
`Roster`, a `Skeleton` map area, and `<noscript>`: `The map needs JavaScript. Turn it on to
draw with everyone else.` Then `next/dynamic(() => import("@/components/map/MapApp"), { ssr:
false, loading: MapSkeleton })` mounts `<MapApp mode="demo" code="DEMO" />`.

Demo semantics (all in `src/lib/map/scenario.ts` + `src/store/room.ts` demo mode):
- Room: code `DEMO`, Lonestar, Zestafona, Default zone, `drawAccess: "everyone"`, squad mode off.
- Seed plan (`demoSeedState`): friendly FOB at (0.18, 0.80) labelled `FOB DELTA`; Rally at
  (0.34, 0.60); LZ at (0.40, 0.52) labelled `LZ BRAVO`; OBJ at the zone centre (0.50, 0.47)
  labelled `DEFAULT`; enemy FOB at (0.80, 0.22); enemy troops at (0.63, 0.36); Danger at
  (0.58, 0.41) radius 0.05 labelled `MG NEST`; a yellow arrow (0.30, 0.66)→(0.47, 0.50); two
  blue strokes along the west approach; text `Hold the ridge` (md, white) at (0.42, 0.30).
  Requests: Fuel open by Boston at the LZ; Medical open by Rook at (0.52, 0.49), urgent; Ammo
  claimed by Krieger (by Ossian) at the rally, ETA 60 s. Roster: Ossian (commander, infantry,
  yellow), Krieger (pilot, green), Boston (medic, blue), Rook (recon, red), all `online`.
- Bots act on `DEMO_TIMELINE` (offsets from the shared 5-minute epoch `epochStart(now)`, so every
  visitor sees the same bots at the same moment): 8 s Krieger claims Fuel (ETA 60); 14 s Rook
  places enemy troops at (0.70, 0.30) `2 squads`; 22 s Boston pings (0.44, 0.54); 30 s Ossian
  draws a yellow arrow (0.47, 0.50)→(0.60, 0.40); 45 s Krieger delivers Fuel; 60 s Boston adds
  urgent Medical at (0.52, 0.49); 75 s Rook moves the troops marker to (0.66, 0.33); 95 s Ossian
  adds text `Push at 2:00`; 120 s Krieger claims Medical (ETA 30); 140 s delivers it; 160 s
  Ossian pings the zone centre; 180 s Rook adds Danger at (0.75, 0.50) r 0.04 `Mortars`; 210 s
  Boston adds Ammo at the rally; 240 s Krieger claims; 270 s delivers. At 300 s the epoch rolls:
  state resets to the seed and the visitor's edits are discarded.
- The visitor joins as co-commander with the auto-callsign from `wardogs:identity` (or
  `Operator XXXX` generated once), can draw immediately, and can open Manage.
- Top bar centre shows `DEMO · resets in 4:32` (mono, ticking) and a ghost sm button `Reset now`
  (rewinds this visitor to the seed; bots continue on the shared clock).
- Bot ops enter through `ingest()` like remote ops, so they animate as remote edits and
  announce via the live region (`Krieger claimed Fuel`).
- Sync: the demo room uses the normal transport (`DEMO` is a valid relay room), so two tabs or
  two devices with a relay share visitor edits until the reset.
- Persistence: the demo never writes `wardogs:room:DEMO`.
- Bottom sticky bar (above the mobile bottom bar): `Like it? Open your own war room →` → `/create?map=zestafona&zone=default`.
- The demo is the one place the schematic-map note is always visible in the bottom-left:
  `Schematic map — layout is approximate.`

Testing hooks: `window.__wardogs = { now: () => number }` is consulted by the demo clock so
Playwright can fake time with `page.clock`; the store exposes `useRoomStore.getState()` in
non-production builds.

### 4.3 War room `/room/[code]` (WP3) — the map app

Route: `src/app/(app)/room/[code]/page.tsx` validates `params.code` with `RoomCodeSchema`
(uppercased); invalid → `notFound()`. Server shell as in 4.2 with the real code in the chip;
`<MapApp mode="room" code={code} joinHint={{ team, squad }} />` (`?t=` and `?s=` search params).

#### 4.3.1 Boot sequence (`src/store/room.ts` + `MapApp`)
1. Load `wardogs:identity`; if missing or no callsign → **Join dialog** (native `<dialog>`,
   cannot be dismissed): title `Join war room {CODE}`, callsign `Input` (placeholder generated
   `Operator 41E3`, "dice" button regenerates), focus grid (six chips, optional), squad select
   when the room's settings (if known) have `squadMode`, primary `Join`. Saves identity.
2. Load `wardogs:room:<CODE>` → `hydrate(snapshot)` (or start with `null`).
3. `createTransport({ relayUrl: NEXT_PUBLIC_RELAY_URL, getState })` → `join(code, identity,
   seq, snapshot)`; status → pill.
4. If no local state after 1,500 ms and no snapshot arrived: **empty state** (§4.3.9).
5. On snapshot: `state = mergeStates(local, remote)`. Then `roster.upsert` self (role: existing
   role if present, else `member`; creator is already `commander` from `/create`), `online: true`.
6. Persist on every change (debounced 500 ms) + update `wardogs:rooms` index.
7. On `pagehide`/`beforeunload`: `roster.update { online: false }` then `transport.leave()`.

#### 4.3.2 Layout (≥ 768 px)
```
┌ TopBar 48px ──────────────────────────────────────────────────────────────┐
│ [Mark] WAR ROOM [X5GM4Q ⧉] [COPY LINK ⌘C] [MANAGE]   ZESTAFONA · DEFAULT   [LIVE · 4] [Brief] [Ossian ▾] [CMD] │
├ Rail 56 ┬ Map (flex-1, bg-bg-0) ───────────────────────────┬ Panels 320 ─┤
│ V P A L │                                                  │ REQUESTS 3  │
│ C R T   │            <svg role=application>                │ ALL OPEN…   │
│ ─ M ─   │                                                  │ cards…      │
│ ↶ ↷     │                                                  ├─────────────┤
│ INK ●●● │                                                  │ ROSTER 5    │
│ FRIENDLY│                                     [+][−][0][⛶] │ tallies     │
│ ENEMY   │                                     [#][◎][▤]    │ COMMANDER   │
│ MARK    │ v0.2.0 · Schematic   [🔊][OUR DISCORD][CONTROLS & HELP] │ TEAM     │
└─────────┴──────────────────────────────────────────────────┴─────────────┘
```
Panels column is collapsible (`HIDE ≫` in the Requests header; a `≪ PANELS` tab reopens it);
the rail is never hidden on desktop except in Brief mode.

**TopBar** (`hud-corners` on the bar): LogoMark 22 → `/`; mono `WAR ROOM`; code chip (mono 14,
`bg-bg-2`, copy icon; click copies the code; flashes COPIED); `COPY LINK` chip button with kbd
hint (`⌘C` when nothing is selected) copies `${site.url}/join?code=CODE`; `MANAGE` (command
roles only) opens the Manage dialog; centre `ZESTAFONA · DEFAULT` (map · zone; `CUSTOM MAP`
when uploaded); right: **sync pill** (see below), `Brief` toggle (icon button, `aria-pressed`),
callsign menu button (`Ossian ▾`: Change callsign, Change focus, Ink colour, Leave room), role
badge `CMD` (accent) / `CO-CMD` (accent outline) / none.

Sync pill states (Badge with a 6 px dot):
- `LIVE · 4 in room` — tone ok, dot `animate-pulse-slow` + `scanlines`; tooltip `Connected to the relay. Everyone with the code sees this map.`
- `LOCAL · this browser` — tone warn; tooltip `No relay configured. Tabs in this browser share the map; other devices do not. Set NEXT_PUBLIC_RELAY_URL to go live.`
- `RECONNECTING…` — tone danger, blinking dot; tooltip `Relay connection dropped. Your edits are queued (n) and will send when it returns.`
- `CONNECTING…` — tone muted, first 3 s only.

**Rail** (`role="toolbar" aria-label="Drawing tools" aria-orientation="vertical"`, roving
tabindex, Home/End): groups separated by 1 px dividers — `select V`, `pen P`, `arrow A`,
`line L`, `circle C`, `rect R`, `text T` | `measure M` | `undo ⌘Z`, `redo ⌘⇧Z`. Each tool is an
icon Button with `aria-pressed`, `aria-keyshortcuts`, a `Tooltip` (`Pen — P`) and the hotkey
in mono 9 px bottom-right. Then `INK` (label-mono) with six 20 px swatches in a 3×2 grid
(`role="radiogroup" aria-label="Ink colour"`, each `aria-label="Blue"` etc., selected = 2 px
`text-0` ring offset 2 px). Then `FRIENDLY` (header in the team colour, sub-label the team
name), `ENEMY` (`enemy-a`), `MARK` (`warn`): 2-column 44 px tiles with the glyph and mono 9 px
short label; selecting a tile sets `tool = "marker"` + `markerKind` (`aria-pressed`). Bottom of
the rail: mono `v{site.version}`.

When `canDraw()` is false the drawing tools and palettes render disabled with a lock glyph and
one `Ask to draw` chip under the rail (§4.3.7).

**Map surface**: `<svg role="application" aria-label="Tactical map, Zestafona" tabindex="0"
aria-describedby="map-help">` filling the area; `touch-action: none`; a `<canvas>` behind it for
terrain (drawn once per map+size from `terrainBitmap`, redrawn on resize/zoom bucket) and a
`<canvas>` above for the in-progress stroke. Inside the SVG one `<g transform="matrix(scale 0 0 scale tx ty)">`
(the world group, updated via `ref` without React re-render) containing, in order:
`GridLayer` (when on), `ZoneLayer` (control zone ring + label chip), `StrokeLayer`,
`ShapeLayer`, `MeasureLayer`, `MarkerLayer` (markers + request pins), `TextLayer`,
`PingLayer`, `CursorLayer` (peers' cursors as small chevrons with callsign, throttled 20 Hz;
hidden in Brief mode), `SelectionLayer`. Markers use `<use href="#m-fob">` from `MarkerSprite`.
`#map-help` (visually hidden): `Arrow keys pan, plus and minus zoom, Enter places the selected
marker at the crosshair, Tab moves to the list of things on the map. Press question mark for
all shortcuts.` Squad layers not editable render at 60 % opacity.

**Zoom stack** (bottom-right, one panel, 36 px icon buttons with tooltips): `+` zoom in,
`−` zoom out, `0` fit, `F` fullscreen (Fullscreen API on the app root; button toggles),
`G` grid, `X` ping tool (`aria-pressed`), layers (only in squad mode: popover with checkboxes
per layer + `Focus my squad`).

**Bottom bar** (right): sound toggle (icon, `aria-pressed`, default muted — a short click on
new request when on, generated with `AudioContext`, no asset), `OUR DISCORD` chip (external),
`CONTROLS & HELP` chip (`?`). Bottom-left: `v0.2.0` and `Schematic map` (with an info tooltip
`Layout is approximate. Commanders can upload a real map under Manage.`).

#### 4.3.3 Interactions
- **Select (V)**: click a node → selected (handles: shape endpoints, danger radius handle,
  marker/text bounding box); drag moves it (`node.update`, one op on pointer-up, live preview via
  transform); double-click a marker → inline rename (`foreignObject` input, Enter commits, Esc
  cancels); double-click text → edit; `Delete`/`Backspace` removes; arrow keys nudge 1 % (Shift
  5 %); Esc deselects. Drag on empty map with select = pan. Space + drag = pan in any tool;
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
- **Ping**: double-click / double-tap anywhere in any tool, or `X` then click, or `X` with the
  map focused (at the crosshair). Emits `sendEphemeral({k:"ping"})`; renders a 4 s pulsing
  ring in the sender's ink colour with the callsign; commander pings are accent and 1.5×. Never
  persisted; own pings render locally at once. `Pings` preference (Controls & help) hides
  others' pings.
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
`0` fit · `+ / −` zoom · `B` brief mode · `⌘/Ctrl+Z` undo · `⌘/Ctrl+Shift+Z` or `Ctrl+Y` redo ·
`⌘/Ctrl+C` copy link (nothing selected) · `⌘/Ctrl+Shift+E` export PNG · `Delete` remove
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
or command), trash (requester or command). Hovering a card highlights its pin and vice versa
(`aria-describedby` both ways); clicking the grid ref centres the map on it.
Hint line under an open card when nobody online has a matching focus: `No pilot in room` /
`No medic in room` (`suggestedFocus`).
Empty state: `No requests yet. Press N or + to ask for fuel, medical or ammo.` (ALL/OPEN);
`Nothing claimed by you.` (MINE); `Nothing delivered yet.` (DONE).

New request flow (`NewRequestDialog`): `+`/`N` → Dialog title `New request`: kind chips
`Fuel Medical Ammo Other` (keys 1–4 while open), priority toggle `Normal / Urgent`, note Input
(max 60), then `Place on map` (closes the dialog, cursor becomes a crosshair, next click places
and creates) or `No location` (creates immediately). Esc cancels placement. Mobile: the same
dialog from the `Request` FAB.

Pruning: delivered requests are removed 30 min after delivery by the single-writer (§5.6).
Announcements: `Fuel requested by Boston at D7`, `Fuel claimed by Krieger, ETA 1 minute`,
`Fuel delivered`, `Fuel released`.

#### 4.3.5 Roster panel (`RosterPanel.tsx`)
Header: Users icon, `ROSTER`, count Badge (online members), a `?` icon button opening the
"How focus and map access work" Dialog (copy in §4.4). Tally row: six chips `Infantry 6 ·
Medic 2 · Recon 1 · Support 0 · Driver 2 · Pilot 0` (zero → dimmed) + a warning line from
`focusWarnings` (`No pilot in room`). Draw requests badge (amber) when any `drawRequested`.

Sections: `COMMANDER n` (crown icon), `TEAM n` (or one section per squad in squad mode, plus
`TEAM` for command roles). Row (40 px): 8 px ink dot, callsign (`(you)` suffix), role icon
(crown / star), focus chip (click your own → change), idle dot (`isIdle`, `title="Idle"`),
offline rows at 50 % with `offline` text, and a `⋯` menu (command roles only; native
`<button aria-haspopup="menu">` + a `role="menu"` popover with arrow-key navigation):
`Make co-commander` / `Remove co-commander`, `Allow drawing` / `Revoke drawing` (only in
`request` mode), `Hand off command` (commander only; confirm), `Kick` (confirm; `roster.remove`;
relay closes that socket with `error kicked`; the kicked client shows a Dialog `You were
removed from this room` → `/join`). Draw request rows show `Approve` / `Deny` chips inline.
Empty: `Only you so far. Copy the link and send it to your team.` (with a Copy link button).

#### 4.3.6 Manage dialog (command roles; `ManageDialog.tsx`, size lg, tabs)
- **Map**: three thumbnails (`terrainToSvg` 320×200 via `MapPreview`-less `<img src=dataUri>`),
  control zone chips (`Default Small Factory Water Treatment Houses None`), helper
  `Changing the map keeps your markers where they are; positions are relative.`
  **Upload your own map**: file input PNG/JPEG/WebP ≤ 8 MB (magic-byte sniff, `createImageBitmap`,
  letterbox to square, downscale to 2048 for local and 1024 JPEG q0.8 ≤ 1.5 MB for sharing,
  SHA-256 hash, store in IDB `wardogs/maps`, `settings.update { mapSource }` then chunked
  `map.chunk` broadcast). `Use built-in map` reverts. Peers that lack the blob show a
  `Commander's map not received — showing the schematic map` banner with `Request again`.
- **Squads**: `Run squads?` RadioCards (`One shared map` / `Squad mode`, copy from §4.4); squad
  list (add/rename/remove, max 8) when on.
- **Access**: `Who can draw and use the map?` RadioCards (`Everyone` / `By request`).
- **Plan**: `Export PNG` (`exportPng`, downloads `wardogs-CODE-YYYYMMDD-HHMM.png`), `Copy plan
  as text` (`planToText` → clipboard, toast `Plan copied — paste it in Discord`), `Save plan
  (.json)` (`RoomSnapshot` download), `Load plan` (file input, `parseSnapshot`, then a
  ConfirmDialog `Replace the current plan or merge into it?` with `Replace` / `Merge`), `Clear
  ink`, `Clear markers`, `Clear everything` (each confirms; `layer.clear`).
- **Room**: link with CopyButton, `Never share your war room code with another team.` (warn
  Callout), `Leave room`.
Downloads are user-initiated `<a download>` clicks created at click time (works in-browser).

#### 4.3.7 Access rules
`canDraw(me, settings)` gates tools, palettes, requests creation (requests are allowed for
everyone — logistics is not drawing) and Manage (command only). In `request` mode a member's
greyed tool click shows `Ask to draw` → `roster.update { drawRequested: true }` → toast to the
asker `Asked. The commander will see it in the Roster.`; approval toasts `You can draw now`,
denial `The commander said not right now`. Command roles always draw. Commander leaving
(`online:false` or presence expired 60 s): `singleWriter` emits `roster.update` promoting
`successor()` to commander and demoting the old one to member; the promoted client sees a
Dialog `You are now commander` with `OK` / `Decline` (Decline hands to the next successor).

#### 4.3.8 Mobile (< 768 px) and Brief mode
- Top bar 44 px: code chip, sync pill (dot + `LIVE`/`LOCAL`), callsign initial avatar (menu).
- Map fills the viewport (`h-dvh` minus bars). Rail hidden. **Bottom bar** 56 px (`role="toolbar"`,
  horizontal): `Select`, `Pen`, `Arrow`, `Marker` (opens the palette Sheet), `More` (Sheet with
  the remaining tools, ink, undo/redo, grid/fit/fullscreen). **FABs** (48 px, bottom-right above
  the bar, `safe-area` padded): `Ping` and `Request`. **Panels**: a bottom `Sheet` with Tabs
  `Requests n · Roster n`, snap `peek` by default (handle shows badge counts), tap cycles
  peek → half → full. Landscape phone (height ≤ 480): the rail returns on the left (compact,
  scrollable), panels as a right `Sheet` 280 px.
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

#### 4.3.10 A11y specifics
`NodeList.tsx`: after the map surface in tab order, a visually hidden but focusable
`role="listbox" aria-label="Things on the map"` listing every visible node as
`Friendly LZ "LZ BRAVO" at D7, placed by Boston`; arrow keys move focus (selection follows and
the map centres), arrow keys with Shift nudge, Delete removes, Enter renames markers/text.
Requests and roster rows are list items; state changes go through `announce()`. Dialogs use
the `Dialog` primitive. Ink swatches carry names. Contrast of ink on terrain is a design check
(Pixel 7 screenshot review), not a hard assertion.

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
2. **Map** — three thumbnail cards 3-up (`<img>` from `terrainToDataUri(model, {size: 320,
   labels: false, grid: false})`, `alt="Zestafona — farmland, a river and a town in the middle"`),
   name eyebrow bottom-left, `blurb` under it, 2 px accent ring when selected. Default Zestafona.
   `?map=` prefill.
3. **Control zone** — helper right-aligned `Change it any time under Manage`. Chips `Default ·
   Small Factory · Water Treatment · Houses · None`; default `Default`; the selected zone draws
   its ring on the selected thumbnail (thumbnail re-rendered with `zone`). `?zone=` prefill.
4. **Run squads?** — RadioCards 2-col: `One shared map` — `Everyone works on the same layer.
   Simple.` / `Squad mode` — `Each squad plans on its own layer. Only you and co-commanders mark
   the team map. Joiners are asked their squad.`
5. **Who can draw and use the map?** — RadioCards 2-col: `Everyone` — `Anyone in the room draws
   and places every marker.` / `By request` — `Only you and co-commanders. People ask from a
   greyed tool; you approve in the Roster.`
6. **Sign in** — full-width `discord` variant button `Sign in with Discord` (Discord glyph).
   Behaviour: when `site.discord.clientId` is set, links to `discordInstallUrl("account")`
   with a helper `Sign-in needs a server to finish; for now it adds the app to your account and
   you continue with a callsign.` When empty, the button is disabled with helper `Discord
   sign-in is not configured on this instance.` Divider `OR` (mono 11 px between 1 px
   `line-strong` rules).
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

Submit: `newRoomCode()` (§5.3), `createRoomState` with the settings, `roster.upsert` self as
`commander` (`ink` from identity), save snapshot + index, `router.push("/room/CODE")`. Loading
state on the button. Mobile: fields stack, team 3-up at 44 px, thumbnails 3-up 100×64, zone
chips wrap, radio cards stack, the submit sits in a sticky bottom bar (`bg-bg-0/90 backdrop-blur`,
safe-area padding). No JS: the form posts nothing; a `<noscript>` line says JavaScript is needed
to open a room.

### 4.5 `/join` (WP3)

Same shell as `/create`; H1 **Join a war room**. Fields:
1. **War room code** — `CodeInput` (six mono cells 48×56, tracking 0.3em, auto-uppercase,
   paste accepts `x5gm-4q` / `X5GM 4Q`, auto-advance, Backspace steps back, Enter submits);
   prefilled from `?code=`; error under the cells `Codes are 6 letters or digits, never 0, O,
   1 or I.` with a 2×4 px shake (off under reduced motion). `DEMO` → navigates to `/demo`.
2. **Sign in with Discord** (as in 4.4) · `OR` · **Type your callsign** (placeholder shows a
   generated `Operator 41E3`; dice button).
3. **Your focus** — helper `Change it any time from your name in the top bar`. 2×3 grid of
   44 px toggle buttons with lucide icons: Infantry `ChevronUp`, Medic `Plus`, Recon `Crosshair`,
   Support `Wrench`, Driver `Car`, Pilot `Plane`. Optional; `role="radiogroup"`.
4. Submit `Join war room →` → saves identity → `/room/CODE`.
5. **Rejoin** list (when history exists): tier-1 card, eyebrow `Rejoin`, rows as on Home.

### 4.6 `/add` (WP6)

`src/app/(site)/add/page.tsx` (async server component). `const to = searchParams.to === "account"
? "account" : "server"`; `const url = discordInstallUrl(to)`; if `url` → `redirect(url)`.
Otherwise render the setup page (this is what an unconfigured self-host shows):

Eyebrow `Setup required`; H1 **This instance has no Discord app configured**; lede `Point it at
your own Discord application and the Add buttons and the voice-channel Activity start working.
It takes about five minutes.`; ordered steps in a tier-1 panel:
1. `Create an application at discord.com/developers/applications.`
2. `Under Activities, enable Activities and add a URL mapping: prefix / → your site origin
   (for example https://wardogs.example.com).`
3. `Under OAuth2, note the Client ID. Add applications.commands to the default install scopes.
   Enable both Guild Install and User Install.`
4. `Set NEXT_PUBLIC_DISCORD_CLIENT_ID=<client id> in the site's environment and redeploy. If you
   run a relay, set NEXT_PUBLIC_RELAY_URL too and add its URL mapping (/relay → the relay origin).`
5. `In Discord, join a voice channel, press Start an Activity, pick your app.`
Callout note: `Members cannot launch it? That is almost always the Use Activities permission
on the voice channel. See the Discord help page.` → `/discord-help`. Buttons: `Try the live
demo` primary → `/demo`, `Read the docs` secondary → `/dev`.

### 4.7 `/activity` (WP3)

`src/app/(app)/activity/page.tsx` static shell (`Loading the war room for this call…`) +
client `ActivityShell`: dynamically imports `src/lib/discord/activity.ts`, which imports
`@discord/embedded-app-sdk` (never imported anywhere else).
```ts
// src/lib/discord/activity.ts
export interface ActivityContext { instanceId: string; channelId: string | null; guildId: string | null }
export function isInsideDiscord(): boolean;                 // window.location.search has frame_id or the hostname ends with discordsays.com
export async function initActivity(clientId: string): Promise<ActivityContext | null>;  // new DiscordSDK(clientId); await ready(); null on failure or when not embedded
// src/lib/room/code.ts
export function codeFromInstance(instanceId: string): string;  // 6 chars from hashString(instanceId) mapped onto the code alphabet; stable
```
Flow: outside Discord → `router.replace("/demo")` + toast `Open this inside a Discord voice
channel to share a room with the call. Here is the demo instead.` Inside Discord with a client
id → `code = codeFromInstance(instanceId)`; identity: the SDK's `authorize({identify})` is not
completed in v1 (no backend to exchange the code), so the Join dialog appears with copy
`Sign-in needs a server; use a callsign for now.`; then `<MapApp mode="activity" code />`.
Inside Discord without a client id → an inline Callout `This instance has no Discord app
configured` with the /add steps. Transport: relay when configured (documented URL mapping
`/relay`), else BroadcastChannel (works across the Activity's iframes in one client).
`next.config.ts` keeps the `frame-ancestors` CSP for `/activity` and adds `connect-src` for
`https://discord.com https://*.discord.com wss://*.discord.gg` (§7.6).

### 4.8 `/demo/admin` and the dashboard (WP4)

Layout: `(app)` with its own `AdminStrip` header (48 px: lockup left, mono Badge `Proof of
concept` right; on dashboard routes also the visitor callsign chip and `Reset to 04:00Z
snapshot`). No SiteHeader. Page is `src/app/(app)/demo/admin/page.tsx` (static) with a client
island for the live card.

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
server: same clock, same seed. Your changes are shared with tabs in this browser, and with
everyone when a relay is configured.`; `Heals itself` — `Kicked players come back. Bans you
place expire in an hour. Rotation, config and everything visitors wrote reset at 04:00Z.`;
`Not real` — `A test server the app runs itself, in your browser. The roster is fictional. Real
communities would sign in with Discord and hold real ranks.` Second `Open the dashboard →` + mono
link `What wardogs.tech is` → `/`. Footer line: `wardogs.tech is unofficial and not affiliated
with Bulkhead or Team17. The map is drawn by this site; nothing here is game art.`

**Dashboard** (`src/app/(app)/demo/admin/(dashboard)/layout.tsx` with `Tabs` as links:
`Live · Rotation · History · Bans · Audit`; each tab route is a static shell + client panel;
`export const metadata.robots = { index: false }`). A persistent `Not real` Badge and the
visitor callsign chip (`visitor Operator 41E3`; click to change) sit in the strip. The
simulation runs in one `setInterval` 1 Hz (paused when `document.hidden`); commands live in
`localStorage wardogs:sim:<UTCDATE>` and broadcast on `BroadcastChannel wardogs:sim` (and on the
relay room `SIM` when configured) so tabs see each other's actions.

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

**Docs shell** (`src/components/docs/DocsShell.tsx`, used by /dev, /rcon-reference,
/discord-help, /map-guide, /rcon-api): the `UNOFFICIAL` strip at the very top (32 px,
`bg-bg-1`, mono `UNOFFICIAL` in accent + Barlow 13 px text, text per page), then the normal
`SiteHeader`, then a docs header row: lockup-less (SiteHeader has it) — instead a mono eyebrow
(`Dev hub`, `Unofficial · Community reference`, `Discord help`, `Map guide`) and right-aligned
mono `Updated {site.updated} · v{site.version}`. Three-column at `xl`: sticky left TOC 220 px
(mono 12 px, active item amber rule via `IntersectionObserver`), content 68ch, right "On this
page" 200 px (h3s); at `lg` two columns; below: content + a TOC `<details>` accordion at the
top. Headings: h1 `display display-2`; h2 `display display-3` with a hover `#` anchor link
(mono, accent); h3 Barlow 600 18 px. Body 16/1.65. Code: mono 13 px; blocks `bg-bg-0
border-line rounded-md` with a header bar (language/filename left, `CopyButton` chip right);
inline code `bg-bg-2 px-1.5 rounded-sm`. Tables full-bleed on mobile inside `overflow-x-auto`,
header row `label-mono`, zebra rows. Callouts per §2.7. Docs footer line: mono
`WARDOGS.TECH — {PAGE}` · `Home` · `Discord` · `Fan-made · Not affiliated with Bulkhead or Team17`.

Content lives in `src/content/dev/*.tsx` as typed modules:
```ts
export interface DocSection { id: string; title: string; body: React.ReactNode }
export interface Doc { slug: string; title: string; unofficialLine: string; eyebrow: string; intro: React.ReactNode; sections: DocSection[]; jsonLd: "TechArticle" }
```

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
against your own server.` Client island `ApiConsole`:
- Target switch (segmented, top): `Demo simulator (in this tab)` (default) · `Your server`.
  "Your server" reveals `Base URL` (`https://host:7776`) and `Bearer token` inputs kept in
  `sessionStorage wardogs:console:target` (label `Sent only to the host you type. Kept for this
  tab only.`), `Test connection` (`GET /v1/status`), and an inline warning when the URL is
  `http://` and the page is `https:` (`A browser cannot call a plaintext listener from an HTTPS
  page. Use TLS, or call from a server.` → `/rcon-reference#02`).
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
  depending on the commander's settings, draw on it. Do not share a code with people who
  should not see the plan. Rooms are kept in the browsers of the people in them and, where a
  relay is configured, in that relay's memory while the room is active.`
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

`(site)` layout. Eyebrow `404`; H1 **Nothing at this position**; lede `The page you asked for
is not on the map. If you were sent a war room link, the code goes after /room/.`; a
`CodeInput`-lite field (`Have a code?`) that navigates to `/room/CODE`; buttons `Try the live
demo` → `/demo`, `Join a war room` → `/join`, `Home` (ghost). Metadata `robots: noindex`.

---

## 5. Realtime and persistence

### 5.1 Store (`src/store/room.ts`, WP1) — the only place that mutates room state

```ts
export interface RoomStore {
  code: string | null;
  mode: "room" | "demo" | "activity";
  state: RoomState | null;
  me: Identity | null;
  sync: SyncStatus;
  peers: number;                                  // presence count within 30 s
  presence: Record<string, Presence>;
  pings: Ping[];                                  // last 4 s
  history: History;
  queued: number;                                 // ops waiting for the relay
  // UI (not persisted except via prefs)
  tool: Tool; ink: InkColor; markerKind: MarkerKind; selection: string | null; brief: boolean; grid: boolean; showPings: boolean; sound: boolean;
  // actions
  boot(args: { code: string; mode: RoomStore["mode"]; identity: Identity; joinHint?: { team?: string; squad?: string } }): Promise<void>;
  dispatch(body: OpBody, opts?: { undoable?: boolean }): Op | null;   // stamps meta, applies, persists, sends; returns null when the reducer ignored it or canDraw() forbids it
  ingest(op: Op): void;                            // remote/bot ops
  undo(): void; redo(): void;
  ping(at: Point): void;
  setTool(t: Tool): void; setInk(c: InkColor): void; setMarkerKind(k: MarkerKind): void; select(id: string | null): void;
  setBrief(b: boolean): void; setGrid(b: boolean): void; setShowPings(b: boolean): void; setSound(b: boolean): void;
  updateIdentity(patch: Partial<Identity>): void;  // also emits roster.update
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
contains `useRoomStore.setState` or imports `reduce.ts` directly.

### 5.2 Transports

- **BroadcastChannel** (`createBroadcastTransport`): channel `wardogs:<CODE>`; on `join` posts
  `hello` and, after 300 ms with no `sync.snapshot`, posts `sync.request`; every peer answers
  `sync.request` with `sync.snapshot` from `getState()` **only if** it is the lowest client id
  among peers it has seen in the last 30 s (prevents n snapshots); `presence` posted every 10 s
  with `[self]` (receivers aggregate, expire after 30 s); `bye` on leave. Safari without
  BroadcastChannel: fallback bus on the `storage` event using key `wardogs:bus:<CODE>` with
  `{ n, msg }` (write then remove). Status is always `"local"`.
- **WebSocket** (`createWsTransport`): `new WebSocket(`${relayUrl.replace(/\/$/, "")}/ws?room=${code}`)`;
  on open send `hello` (with the local snapshot); reconnect with backoff `min(15000, 500 * 2^n)`
  + jitter ±20 %; heartbeat: the relay's `presence` every 15 s serves as the server heartbeat;
  the client sends `cursor` at most every 50 ms and at least every 20 s (with `at: null`); ops
  queue while not open (cap 1,000; drop oldest); after reconnect: `hello` → `sync.request
  {since: state.seq}` → flush the queue. `connectTimeoutMs` (3 s) not opened → switch to
  BroadcastChannel and status `"local"` with a toast `Relay unreachable — this browser only`;
  a background retry every 30 s upgrades to ws when it succeeds (state merged via snapshot).
- **Memory** (`createMemoryTransport`): synchronous bus for unit tests and the convergence test.

### 5.3 Room codes (`src/lib/room/code.ts`, WP1)

Alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols; no 0/O/1/I). `newRoomCode(): string`
(6 symbols from `crypto.getRandomValues`), `normalizeCode(input: string): string` (uppercase,
strip everything not in `[A-Z2-9]`), `RoomCodeSchema = z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/))`,
`isRoomCode(s)`, `RESERVED_CODES = ["DEMO", "SIM"]` (valid on the relay and in routes, never
generated), `codeFromInstance(instanceId)` (§4.7). Room links: `/room/<CODE>` (canonical),
`/join?code=<CODE>` (what COPY LINK copies, so the recipient gets the callsign/focus step),
`/r/<CODE>` (301 → `/room/<CODE>`; `next.config.ts redirects()`).

### 5.4 Storage (`src/lib/storage/*`, WP1)

All reads/writes wrapped in try/catch; a failure degrades to in-memory only and sets
`storageOk = false` (one toast).

| Key | Store | Shape | Notes |
|---|---|---|---|
| `wardogs:identity` | localStorage | `{ v:1, client, callsign, focus, ink }` | created on first use; `client` never changes |
| `wardogs:prefs` | localStorage | `{ v:1, grid, showPings, sound, brief, lastTool, showRcon }` | |
| `wardogs:room:<CODE>` | localStorage | `RoomSnapshot` | debounced 500 ms; `compactState()` before save drops tombstones older than 24 h and caps `order` at `MAX_NODES`; if JSON > `MAX_STATE_BYTES` the oldest strokes are removed and a toast says so |
| `wardogs:room:<CODE>:bad` | localStorage | raw string | quarantine for unparsable snapshots |
| `wardogs:rooms` | localStorage | `RecentRoom[]` (max 10, newest first) | drives Rejoin cards and "Start from a recent plan" |
| `wardogs:sim:<YYYY-MM-DD>` | localStorage | `TimedCommand[]` | UTC date of the 04:00Z boundary; older keys deleted on load |
| `wardogs:sim:actor` | localStorage | `string` | visitor callsign for the admin demo |
| `wardogs:dh` | sessionStorage | `{ step, answers }` | Discord help stepper |
| `wardogs:console:target` | sessionStorage | `{ mode, baseUrl, token }` | never localStorage |
| IDB `wardogs` / store `maps` | IndexedDB | key `hash` → `{ blob, w, h, mime, name, at }` | uploaded maps; `src/lib/storage/idb.ts` with a 20-line in-memory shim for vitest (`vitest.setup.ts`) |

API: `loadIdentity() / saveIdentity()`, `loadPrefs() / savePrefs()`, `loadRoom(code) / saveRoom(code, snapshot) / forgetRoom(code)`,
`listRecentRooms()`, `touchRecentRoom(r: RecentRoom)`, `putMap(hash, rec) / getMap(hash)`.

### 5.5 Presence, idle, single-writer

`presence[client].seenAt` updates on any `presence`/`cursor`/`op` from that client. `peers` =
clients seen within 30 s (including self). Idle = no activity for 90 s (roster idle dot).
**Single-writer rule**: housekeeping ops that every client could compute (prune delivered
requests after 30 min, prune strokes over `MAX_NODES`, promote a successor commander, expire
`drawRequested` after 10 min) are emitted only by `singleWriter(roster, presence, now)` — the
lowest client id among clients with presence in the last 30 s. Duplicates are harmless anyway
(LWW) but this keeps the op stream quiet.

### 5.6 Demo seeding and reset

Covered in §4.2. Implementation: `useDemoDirector(store)` in `src/components/map/demo/`
computes `epochStart(now)`, hydrates `stateAt(now)`, schedules the remaining timeline items
with `setTimeout` (recomputed on `visibilitychange`), and at the epoch boundary calls
`store.boot` again with the seed (visitor edits dropped; the visitor's roster entry re-added).
The "resets in m:ss" text ticks every second from the same clock. `window.__wardogs.now` is
used when present so e2e can fake time. Bots do not need to be "running" anywhere else: the
timeline is the same for everyone by construction. Between visitors there is no server-side
state, and that is stated in the demo's tooltip: `Bots are scripted on a shared clock. Your
edits are shared with tabs in this browser and, on a relay, with everyone.`

### 5.7 Uploaded maps over the wire

Chunks of 48 kB base64 (`map.chunk`, `n` total); receivers assemble by `hash`, verify SHA-256
(`crypto.subtle.digest`) matches, store in IDB, then swap the terrain layer for the image
(letterboxed square, `MAP_PX` map space). Missing blob on open → `map.request {hash}`; the
holder (any peer with it, or the relay cache) answers. Uploaded maps have no metres:
`widthMetres = null` → measure shows map fractions.

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
`export const runtime = "nodejs"` in each route file; fonts read with `fs.readFile` from
`src/assets/fonts/saira-condensed-800.woff` and `barlow-500.woff`). 1200×630, charcoal `#141311`,
the two-scale grid as repeating linear gradients at 4 %, an optional terrain crop as an
absolutely positioned `<img src={terrainToDataUri(...)}>` at 40 % opacity on the right,
centred lockup (mark from `markSvg` 44 px + wordmark 40 px), headline in Saira 800 at up to
128 px / 0.9 (three lines max), amber Barlow 500 30 px strapline with 60 px amber rules either
side, and a 4 px amber bar on the bottom edge. Presets:

| Route file | Headline | Strapline | Terrain |
|---|---|---|---|
| `src/app/opengraph-image.tsx` (+ `twitter-image.tsx` re-export) | THE TACTICAL MAP / EVERY WARDOGS / SERVER NEEDS | DRAW THE PLAN. CALL THE DROP. EVERYONE SEES IT. | none |
| `src/app/(app)/demo/opengraph-image.tsx` | THE LIVE DEMO | A SHARED MAP. NO SIGN-IN. RESETS EVERY FIVE MINUTES. | zestafona crop |
| `src/app/(site)/dev/opengraph-image.tsx` | RUN YOUR SERVER | RCON · OPENAPI · CONFIG · DISCORD HELP | none |
| `src/app/(app)/demo/admin/opengraph-image.tsx` | SERVER ADMIN / IN THE SAME DISCORD | LIVE PLAYERS. MATCH HISTORY. BANS WITH EVIDENCE. | bakurani crop |
| `src/app/(app)/room/[code]/opengraph-image.tsx` | JOIN THE WAR ROOM | OPEN THE LINK. TYPE A CALLSIGN. YOU ARE ON THE MAP. | ozeti crop — **the code is never rendered** |
| `src/app/(app)/create/…`, `join/…` | OPEN A WAR ROOM / JOIN A WAR ROOM | same as root | none |

E2E asserts each returns 200 `image/png`.

### 6.3 Sitemap, robots, manifest
`src/app/sitemap.ts`: `/` (1.0 weekly), `/demo` (0.8 daily), `/create`, `/join` (0.6 monthly),
`/dev`, `/rcon-reference`, `/rcon-api`, `/discord-help`, `/map-guide` (0.5 monthly),
`/demo/admin` (0.5), `/terms`, `/privacy` (0.2 yearly); `lastModified` = `site.updated`.
`src/app/robots.ts`: allow all; disallow `/room/`, `/r/`, `/activity`, `/add`, `/demo/admin/live`,
`/demo/admin/rotation`, `/demo/admin/history`, `/demo/admin/bans`, `/demo/admin/audit`;
sitemap URL from `site.url`. `src/app/manifest.ts`: name `wardogs.tech`, short_name `Wardogs
map`, `display: "standalone"`, `background_color`/`theme_color: "#141311"`, `start_url: "/join"`,
icons `/icon` (512, `purpose: "any maskable"`) and `/icon.svg`.

### 6.4 JSON-LD (`src/components/site/json-ld.tsx`, WP6)
`<JsonLd data={…}>` serialises with `JSON.stringify` and escapes `<` as `<`. Root layout:
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

| Module | Tests (file) |
|---|---|
| `src/lib/geo.ts` | `geo.test.ts`: bearing north=0/east=90/south=180/west=270; snapAngle keeps length; clampPoint. |
| `src/lib/map/reduce.ts` | `reduce.test.ts`: applyOp idempotent (same op twice → same reference); stale op ignored; convergence: 200 random ops from 3 actors applied in 20 seeded permutations reach a deep-equal state; delete beats move regardless of arrival order; re-add after delete with higher rev resurrects; layer.clear with type filter; settings per-field LWW; mergeStates commutative and idempotent; seq monotone. |
| `src/lib/map/history.ts` | undo emits inverse, redo re-emits; cap 200; redo cleared on new push. |
| `src/lib/map/inverseOf` | every invertible op type round-trips (apply op then inverse → deep-equal minus revs/seq). |
| `src/lib/map/schema.ts` | rejects malformed nodes/ops; parseSnapshot returns null, never throws; callsign/code schemas. |
| `src/lib/map/viewport.ts` | world↔screen round-trip; zoomAt keeps the cursor point fixed; clamp keeps ≥ 25 % visible; fit centres. |
| `src/lib/map/grid.ts` | gridRef corners (0,0)=A1, (0.999,0.999)=J10, sub-cells 1..9 layout; gridCell inverse. |
| `src/lib/map/ink.ts` | outline stable for fixed input (snapshot); simplify reduces points, keeps endpoints. |
| `src/lib/map/tools.ts` | pen: down/move/up → one node.add with ≥2 points; tap → 2-point dot; shapes below 0.004 → no op; shift snap 15°; measure metres = widthMetres × distance. |
| `src/lib/map/requests.ts` | every transition edge (open→claimed→delivered, release, not-yours, already-delivered), eta, ageState thresholds, filter MINE both ways, rankRequests order, shouldPrune 30 min. |
| `src/lib/map/roster.ts` | canDraw matrix (2 modes × 3 roles × canDraw flag), tallies, warnings, visibleLayers/editableLayer, successor order, singleWriter picks lowest id with presence. |
| `src/lib/map/plan.ts` | planToText snapshot for the demo seed; importPlan replace/merge id re-minting. |
| `src/lib/map/scenario.ts` | timeline sorted and < epoch; stateAt(now) deterministic; seed state validates against RoomStateSchema; all points in [0,1]. |
| `src/lib/map/ids.ts`, `src/lib/room/code.ts` | alphabet, length, normalizeCode, codeFromInstance stable and valid, reserved codes. |
| `src/lib/realtime/*` | schema rejects bad frames and oversize; memory transport: two clients converge on ops and snapshot; ws transport: backoff schedule with fake timers, queue cap, `since` on reconnect (mock WebSocket); broadcast: single snapshot responder election (mock BroadcastChannel). |
| `server/relay.test.ts` | starts on port 0; two `ws` clients: hello → snapshot, op fan-out, sync.request → sync.ops, presence on join/leave, rate-limit error, bad frame drop, room-full, origin rejection, `/healthz`. |
| `src/lib/storage/*` | round-trips; quarantine on corrupt JSON; recent rooms cap 10; IDB shim put/get. |
| `src/lib/terrain/*` | same seed → deep-equal model; different seeds differ; every zone/POI/settlement inside [0,1]²; each anchor has a settlement of the right kind within 0.05; `terrainToSvg` returns a string starting with `<svg` that contains the zone name when `zone` given; biome palettes are distinct. |
| `src/lib/admin-sim/*` | stateAt determinism (same inputs → deep-equal); kick removes then restores within 90–300 s; ban expiry; move persists until next match; match n increases monotonically; history length ≈ 72 h / 40 min; resetBoundary math; `toRcon` covers every command; `handleRcon`: every openapi path responds 200 with a body that satisfies the spec's response schema (a small structural check built from `parseSpec`), 401 without token, 404 unknown. |
| `src/lib/openapi/parse.ts` | parses the real spec: 31 paths, 35 operations, every op tagged, every `$ref` resolved, `exampleFor` obeys required/enum, snippets contain method/path/token header. |
| `src/lib/config-ini/validate.ts` | parses the template with zero errors; unknown key → stripped; ScorePeriod 40 → error; BindAddress 0.0.0.0 + Password only → error; rotation entry parse; line numbers. |
| `src/lib/a11y/contrast.test.ts` | WCAG relative luminance: fg on bg-0/1/2 ≥ 7:1; fg-muted on bg-1 ≥ 4.5:1; accent-ink on accent ≥ 4.5:1; warn/ok/danger on bg-1 ≥ 3:1 (UI); accent on bg-1 ≥ 4.5:1. |
| `src/lib/brand/mark.ts` | `markSvg` output is valid-looking SVG containing the chevron path. |
| `src/lib/map/boundaries.test.ts` | no `useRoomStore.setState` / direct `reduce.ts` import under `src/components/**`. |

Component tests (Testing Library): `RequestsPanel` (filters, Claim/Delivered/Release buttons
dispatch the right patches, hint line, announce called), `RosterPanel` (tallies, menu actions,
approve/deny), `ToolRail` (roving tabindex, arrow keys, hotkeys change tool, disabled state
under `request` mode), `Dialog` (focus trap, Esc, focus return), `CopyButton` (announces,
fallback), `CodeInput` (paste, auto-advance, uppercase), `Tabs` (arrow keys), `Sheet` (snap
cycle), `LiveServerCard` (renders scores from a fixed state), `ApiConsole` (search filters,
simulator send renders a 200), `DiscordStepper` (all four outcomes reachable), `ConfigValidator`
(renders issues).

### 7.2 E2E (Playwright; projects `desktop` and `mobile` (Pixel 7); `tests/e2e/*.spec.ts`)
1. `home.spec`: hero text, CTAs, no console errors, LCP entry < 2,500 ms, CLS < 0.05, OG route
   200 `image/png`, FAQ toggles, code field → `/room/ABC234`.
2. `room.spec`: `/create` → pick Valkyra/Bakurani/Houses → callsign → lands on `/room/[code]`;
   draw a pen stroke (mouse), place marker via `2` + click, rename it, undo, redo; reload →
   everything persists; COPY LINK writes the clipboard (granted permission); sync pill shows
   `LOCAL`.
3. `sync.spec` (desktop): open the room in a second page of the same context; place a marker
   in page A → visible in page B within 1 s (`expect.poll`); create a request in B, claim in
   A, deliver in B; roster shows both callsigns; kick from A → B sees the removed dialog.
4. `demo.spec`: `/demo` shows the seed plan immediately (markers count ≥ 8), the roster has 4
   bots + you, `page.clock` runs 45 s → Fuel shows `DELIVERED`; run to the epoch boundary →
   state resets (visitor marker gone); `Reset now` works; sticky bar links to `/create?map=`.
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
    element on `/room/[code]` shows a visible focus ring (computed `outline-style != none`).
11. `seo.spec`: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, canonical tags, noindex on
    `/room/X`, JSON-LD parses.
Multi-page sync uses BroadcastChannel (same context). The relay convergence test is the vitest
test in `server/relay.test.ts`, not e2e.

### 7.3 Performance budgets
- First-load JS (from `next build` output): `(site)` routes ≤ 120 kB gzipped; `(app)` shells
  ≤ 130 kB before the dynamic `MapApp` chunk; `MapApp` chunk ≤ 140 kB gzipped; `ApiConsole`
  and the admin dashboard chunks ≤ 90 kB each. `scripts/check-bundle.mjs` parses
  `.next/build-manifest.json` + file sizes (gzip via `zlib`) and fails CI over budget.
- No raster assets in the marketing pages except OG (served by route). No `next/image` remote
  patterns needed.
- `motion` is imported only under `src/components/home/**` and `src/components/site/**`;
  `@discord/embedded-app-sdk` only under `src/lib/discord/**`; `perfect-freehand` only under
  `src/lib/map/ink.ts`; `ws` only under `server/**`.
- Terrain: `generateTerrain` ≤ 120 ms at res 256 (asserted loosely in a unit test: < 1 s);
  `terrainBitmap` memoised; the terrain canvas is not redrawn on pan.
- Ink: a 5,000-point stroke never touches React state before pointer-up; the transient stroke
  draws on the overlay canvas in `requestAnimationFrame`.
- LCP < 2.0 s lab on `/` and `/demo` (CI asserts < 2.5 s); CLS < 0.05; no long task > 200 ms
  during a scripted 2 s draw on `/demo`.
- Fonts: preload only Saira 800 and Barlow 400/500 (set `preload` per weight in
  `next/font/local`); `adjustFontFallback` stays on.

### 7.4 Accessibility checklist (manual, `docs/accessibility.md`; automated parts in 7.1/7.2)
Landmarks on every route · one `h1` · skip link `Skip to content` (site) / `Skip to map` (app)
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
  build:
    runs-on: ubuntu-latest
    needs: check
    env: { NEXT_PUBLIC_SITE_URL: "https://wardogs.example.com" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: node scripts/check-bundle.mjs
      - uses: actions/upload-artifact@v4
        with: { name: next-build, path: .next, retention-days: 1, include-hidden-files: true }
  e2e:
    runs-on: ubuntu-latest
    needs: build
    env: { NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100", PW_NO_BUILD: "1", CI: "true" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { name: next-build, path: .next }
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
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
`package.json` scripts added by WP6: `"e2e:ci": "PW_NO_BUILD=1 playwright test"`,
`"build:relay": "tsc -p server/tsconfig.json"`, `"start:relay": "node server/dist/relay.js"`
(dev keeps `tsx watch`), `"check:bundle": "node scripts/check-bundle.mjs"`. `npm run check`
stays typecheck + lint + unit.

### 7.6 Security headers (`next.config.ts`, WP6)
Keep the existing split. Add to both: `Strict-Transport-Security: max-age=63072000;
includeSubDomains; preload`. Non-activity routes add `Cross-Origin-Opener-Policy: same-origin`
and `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src
'self' ws: wss: https://discord.com https://*.discord.com; media-src 'self' blob:; worker-src
'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
(`connect-src` also includes `NEXT_PUBLIC_RELAY_URL`'s origin when set; `ws:` is dropped when
`NODE_ENV === "production"` unless the relay URL is `ws://`). `/activity` keeps its
`frame-ancestors` and uses the same CSP minus `frame-ancestors 'none'` plus `connect-src
wss://*.discord.gg https://*.discordsays.com`. No nonces, no `proxy.ts`. E2E asserts no CSP
violation is logged on `/`, `/demo`, `/rcon-api`. Input validation: every inbound wire frame,
every stored snapshot, every route param and search param goes through zod; uploaded images are
magic-byte sniffed and decoded with `createImageBitmap`; SVG uploads are rejected; text nodes
render as SVG `<text>`, never HTML; callsigns are rendered as text.

### 7.7 Relay Docker (`server/Dockerfile`, `server/tsconfig.json`, `docker-compose.yml`, WP1)
Multi-stage `node:22-alpine`: build stage `npm ci` + `npm run build:relay` (tsc → `server/dist`,
includes the imported `src/lib/map` and `src/lib/realtime` modules via `rootDir: "."`); runtime
stage copies `server/dist` + production `node_modules` (`ws`, `zod`), runs as user `node`,
`EXPOSE 8787`, `HEALTHCHECK CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1`. `docker-compose.yml`
runs the relay for `dev:all` parity. README documents deploying the relay to any Docker host
(Fly, Railway, a VPS) and setting `NEXT_PUBLIC_RELAY_URL=wss://…` on Vercel.

---

## 8. Work packages

Six packages, built concurrently in one working tree. Owned paths never overlap. A builder
touches only its owned paths and contract files under the create-if-missing rule (§3.0).
Requests for changes to files owned by another package go in the builder's report under
"Requests to other packages" with the exact diff wanted.

### 8.1 Phase order (critical path)

- **Phase 0 (first hour, every package):** write your contract files verbatim (§3), install
  nothing, run `npx next typegen` after adding routes. WP6 additionally lands the `globals.css`
  additions (§2.1, §2.5), the extended `Button`, and the primitives in §3.12 as compiling stubs
  before anything else, because every other package renders with them.
- **Phase 1:** WP1 engine + store + transports; WP2 terrain + maps + OG helper; WP6 site
  pages; WP4 simulator engine + OpenAPI parser; WP5 content modules + validator; WP3 map UI
  against the WP1/WP2 contracts.
- **Phase 2:** integration — WP3 wires the store/transport; WP4 wires the console to the
  simulator; WP6 wires `HeroPlayer` into the home page; WP5 wires the endpoint table to
  `parseSpec`. E2E specs are owned by the package whose route they exercise (listed below).
- **Done** = `npm run check`, `npm run build`, `npm run e2e` green for your specs, and your
  report filed (`docs/reports/<package>.md`: what shipped, deviations, requests to others).

### 8.2 Shared-file ownership

| File | Owner | Others |
|---|---|---|
| `src/app/globals.css` | WP6 | request additions with exact CSS in the report |
| `src/app/layout.tsx` | WP6 | — |
| `src/config/site.ts` | WP6 | request additions; do not add keys elsewhere |
| `next.config.ts` (headers, redirects) | WP6 | WP1 may request relay origin handling |
| `package.json` scripts | WP6 | WP1 requests the relay scripts (already listed in §7.5) — WP6 adds them in Phase 0 |
| `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts` | WP6 | WP1 supplies the IDB shim text in its report if WP6 has not added it; WP6 adds it in Phase 0 from §5.4 |
| Contract files in §3 | listed owner | create-if-missing, never edit |
| `README.md`, `docs/architecture.md`, `docs/accessibility.md`, `CONTRIBUTING.md` | WP6 | packages contribute sections via report |
| `src/content/openapi.json`, `src/content/ServerSettings.ini` | WP5 (verbatim copies from the scratchpad paths) | WP4 may create them under create-if-missing |
| `docs/reports/<package>.md` | each package owns its own report (`core.md`, `terrain.md`, `map-ui.md`, `admin.md`, `docs.md`, `site.md`) | — |
| `docs/SPEC.md` | nobody | read-only during the build |

### 8.3 Packages

#### WP1 — Map engine, sync, storage, relay (`core`)
Owned paths: `src/lib/geo.ts`, `src/lib/map/**`, `src/lib/realtime/**`, `src/lib/room/**`,
`src/lib/storage/**`, `src/store/**`, `server/**` (relay, tests, Dockerfile, tsconfig),
`docker-compose.yml`, `tests/e2e/sync.spec.ts`.
Delivers: §3.1, §3.3, §3.4 (all modules incl. scenario, plan, export-png), §3.5, §3.6, §5.1–5.7,
§7.7. Unit tests per §7.1. A `src/lib/map/index.ts` barrel.
Imports: `src/config/site.ts` (Team), `src/lib/terrain/types.ts` (MapId, ControlZoneId — types
only), `src/config/maps.ts` (`mapById` for metres in tools/plan — types + one function).
Depends on: nothing at runtime beyond contracts. Others depend on it heavily → land Phase 0
contracts first, reducer + store by mid Phase 1.
Spec sections: 3.0–3.6, 4.2 (scenario data), 5, 7.1 (engine rows), 7.7.

#### WP2 — Terrain, maps config, OG renderer (`terrain`)
Owned paths: `src/lib/terrain/**`, `src/config/maps.ts`, `src/lib/og/**`,
`src/app/opengraph-image.tsx`, `src/app/twitter-image.tsx`, `tests/e2e/og.spec.ts`.
Delivers: §3.2, §3.7, §6.2 helper + root OG routes, biome tuning (visually checked at 320 px
thumbnails, 1024 px canvas and 1200×630 OG), `drawTerrain`/`terrainBitmap`, `terrainToSvg`.
Imports: `src/lib/geo.ts`, `src/lib/brand/mark.ts` (OG mark), fonts under `src/assets/fonts`.
Depends on: WP6's `mark.ts` (create-if-missing).
Spec sections: 3.2, 3.7, 6.2, 7.1 (terrain rows), 7.3 (terrain budget).

#### WP3 — Map app UI, create/join, demo, activity (`map-ui`)
Owned paths: `src/components/map/**`, `src/app/(app)/layout.tsx`, `src/app/(app)/room/**`,
`src/app/(app)/demo/page.tsx`, `src/app/(app)/demo/loading.tsx`,
`src/app/(app)/demo/opengraph-image.tsx`, `src/app/(app)/create/**`, `src/app/(app)/join/**`,
`src/app/(app)/activity/**`, `src/lib/discord/**`, `src/lib/a11y/audit.ts`,
`tests/e2e/room.spec.ts`, `tests/e2e/demo.spec.ts`, `tests/e2e/mobile.spec.ts`,
`tests/e2e/keyboard.spec.ts`.
Delivers: §3.13, §4.2, §4.3 (all sub-sections), §4.4, §4.5, §4.7, the `(app)` layout with
`Skip to map`, `MarkerSprite`, `MapPreview`/`HeroPlayer`/`HeroStatic`, `NodeList`, `GridLayer`,
`ManageDialog`, mobile bottom bar/sheets/FABs, `useDemoDirector`, `UploadMap`.
Imports: everything from WP1 (`@/lib/map`, `@/lib/realtime`, `@/lib/room`, `@/lib/storage`,
`@/store/room`), WP2 (`@/lib/terrain`, `@/config/maps`), WP6 primitives.
Depends on: WP1 store/transport and WP2 terrain for integration; can build all components
against the contracts with a memory transport and a stub model in Phase 1.
Spec sections: 3.13, 4.2–4.5, 4.7, 2.6–2.9 (app chrome), 5.6–5.7 (UI side), 7.2 specs 2–6, 7.4.

#### WP4 — Admin simulator, dashboard, OpenAPI console (`admin`)
Owned paths: `src/lib/admin-sim/**`, `src/lib/openapi/**`, `src/components/admin/**`,
`src/components/console/**`, `src/app/(app)/demo/admin/**` (page, `(dashboard)` layout and the
five tab routes, `opengraph-image.tsx`), `src/app/(site)/rcon-api/**`, `tests/e2e/admin.spec.ts`,
`tests/e2e/console.spec.ts`.
Delivers: §3.8, §3.9, §4.8, §4.9 `/rcon-api`, the sim `BroadcastChannel wardogs:sim` bridge,
"What this sends" sheet, inline SVG score charts.
Imports: `src/content/openapi.json` (WP5, create-if-missing), `src/lib/config-ini/validate.ts`
(WP5 contract) for the config endpoints, `src/config/maps.ts` (WP2), WP6 primitives, `src/lib/og`
(WP2) for its OG route, `src/components/docs/DocsShell.tsx` (WP5) for `/rcon-api`.
Depends on: WP5 `DocsShell` + `validateIni` (stub-able), WP6 primitives.
Spec sections: 3.8, 3.9, 4.8, 4.9 (console part), 7.1 (sim + openapi rows), 7.2 specs 7–8.

#### WP5 — Dev hub and docs content (`docs`)
Owned paths: `src/content/**` (dev docs modules, `openapi.json`, `ServerSettings.ini`,
`rcon-prompt.ts`), `src/components/docs/**` (DocsShell, TOC, CodeBlock, EndpointTable,
DiscordStepper, ConfigValidator, IniViewer), `src/lib/config-ini/**`, `src/app/(site)/dev/**`
(incl. `opengraph-image.tsx`), `src/app/(site)/rcon-reference/**`, `src/app/(site)/discord-help/**`,
`src/app/(site)/map-guide/**`, `src/app/openapi.json/route.ts`, `src/app/ServerSettings.ini/route.ts`,
`tests/e2e/docs.spec.ts`.
Delivers: §3.10, §4.9 (all but `/rcon-api`), the route handlers, JSON-LD TechArticle usage.
Imports: `src/lib/openapi/parse.ts` (WP4 contract) for the endpoint table, WP6 primitives and
`JsonLd`, `src/lib/og` (WP2) for the dev OG route, `src/config/maps.ts` for the zone table.
Depends on: WP4 `parseSpec` (stub-able with the contract), WP6.
Spec sections: 3.10, 4.9, 6.4 (TechArticle), 7.1 (ini rows), 7.2 spec 9.

#### WP6 — Design system, site shell, home, add, legal, SEO plumbing, CI (`site`)
Owned paths: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/not-found.tsx`,
`src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts`, `src/app/icon.tsx`,
`src/app/apple-icon.tsx`, `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx`,
`src/app/(site)/add/**`, `src/app/(site)/terms/**`, `src/app/(site)/privacy/**`,
`src/components/ui/**`, `src/components/site/**`, `src/components/home/**`, `src/lib/brand/**`,
`src/lib/a11y/contrast.test.ts`, `src/lib/utils.ts`, `src/config/site.ts`, `next.config.ts`,
`package.json`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`,
`eslint.config.mjs`, `.env.example`, `scripts/**`, `.github/**`, `README.md`, `CONTRIBUTING.md`,
`docs/architecture.md`, `docs/accessibility.md`, `docs/reports/README.md`, `public/**`,
`tests/e2e/home.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/seo.spec.ts`.
Delivers: §2 (all), §3.11, §3.12, §4.1, §4.6, §4.10, §4.11, §6.1, §6.3, §6.4, §7.3 bundle
script, §7.5, §7.6, the IDB shim in `vitest.setup.ts` (§5.4), `/r/:code` redirect, README with
env vars (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_INVITE`,
`NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_RELAY_URL`, `RELAY_PORT`,
`RELAY_ALLOWED_ORIGINS`), Vercel + relay deploy docs, Discord Activity setup with the "Use
Activities" note.
Imports: `HeroPlayer`/`HeroStatic` (WP3), `listRecentRooms` + `RoomCodeSchema` (WP1) for the
home code field and Rejoin card, `markSvg` for icons.
Depends on: WP3 `HeroPlayer`/`HeroStatic` for the final hero (Phase 2). Until WP3 lands,
render the tier-3 frame with a `Skeleton` inside; do not write a local stand-in for the map.
Spec sections: 2, 3.11, 3.12, 3.14, 4.1, 4.6, 4.10, 4.11, 6, 7.3, 7.5, 7.6.

### 8.4 Dependency graph

```
WP6 (primitives, tokens)  ──►  WP3, WP4, WP5 (render with them)
WP1 (types, reducer, store, transport) ──► WP3 (map app), WP6 (home code field / rejoin)
WP2 (terrain, maps, og) ──► WP3 (map), WP4/WP5/WP6 (OG routes, thumbnails, zone table)
WP4 (parseSpec) ──► WP5 (endpoint table)      WP5 (DocsShell, validateIni) ──► WP4 (console, config endpoints)
```
The WP4⇄WP5 cycle is broken by contracts: both sides are pure functions/components with exact
signatures in §3.9/§3.10/§4.9; build against the contract, integrate in Phase 2.

### 8.5 Definition of done (whole build)

`npm run check` green; `npm run build` green with the bundle script passing; `npm run e2e` green
on both projects; every route in §3.14 exists with its metadata; `/demo` paints the seed plan
with JS disabled (static shell) and is live with JS; a room survives reload; two tabs converge;
the relay test passes; `docker build -f server/Dockerfile .` succeeds; no file outside a
package's owned paths was edited by that package (reviewer diff check); reports filed.

---

## Appendix A — Keyboard and gesture map (single source; render it in Controls & help)

| Key | Action | Context |
|---|---|---|
| `V` `P` `A` `L` `C` `R` `T` `M` | select, pen, arrow, line, circle, rect, text, measure | tools |
| `1`–`8` | FOB, Rally, LZ, OBJ, Enemy FOB, Enemy troops, Danger, Pin | markers (also 1–4 = kind inside the New request dialog) |
| `N` | new request | anywhere in the app |
| `X` | ping (next click / at the crosshair) | anywhere |
| `G` `F` `0` `+` `−` | grid, fullscreen, fit, zoom in, zoom out | view |
| `B` | brief mode | anywhere |
| `⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`, `Ctrl+Y` | undo, redo | own ops |
| `⌘/Ctrl+C` | copy room link | nothing selected |
| `⌘/Ctrl+Shift+E` | export PNG | command roles |
| `Delete` / `Backspace` | remove selection | selection |
| Arrow keys | pan map / nudge selection 1 % (Shift 5 %) / move in node list | map focused |
| `Enter` | place current marker at crosshair / commit text / rename | map focused / editing |
| `Esc` | cancel placement, deselect, close dialog or sheet | anywhere |
| `?` | Controls & help | anywhere |
| `Space`+drag, middle-drag, wheel, `Ctrl`+wheel | pan, pan, zoom, zoom | pointer |
| `Shift`+drag | snap 15° / constrain square-circle | line, arrow, measure, rect, circle |
| One finger / two fingers / long-press / double-tap | tool / pan+zoom / marker palette / ping | touch |

## Appendix B — Marker glyphs (WP3 `MarkerSprite.tsx`; original artwork)

All glyphs are 32-unit symbols with a 2-unit stroke, a filled backing shape for legibility on
any terrain, and a label under them (mono 10 px, uppercase, `text-0` with a dark halo):
`fob` triangle-roof on a base (tent) in `friendly` (team colour); `rally` a flag in `rally`;
`lz` a circle with an H in `lz`; `obj` a double ring in `objective`; `enemy-fob` an inverted
tent in `enemy-a`; `enemy-troops` a diamond with two chevrons in `enemy-a`; `danger` a warning
triangle in `danger` with a translucent radius disc; `pin` a teardrop in `warn`. Request pins
are a crate glyph with the request number, coloured by state. Peer cursors are small chevrons
in the peer's ink colour with the callsign.

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

## Appendix D — Reference material for builders (read-only inputs)

- Upstream text for verbatim ports: `/tmp/claude-0/-home-user-War-dogs/61851c33-82db-5257-a90e-a5d704125fb0/scratchpad/devpages/rcon-reference.txt`,
  `…/devpages/discord-help.txt`, spec `…/devpages/openapi.json`, template `…/devpages/ServerSettings.ini`.
- Upstream UI reference (look, not pixels; never ship it): `…/scratchpad/ref/command.png`;
  page screenshots under `…/scratchpad/shots/`. The upstream OG composition `…/ref/og.png`
  informs §6.2; regenerate with our mark.
- Do not copy any image from the reference folders into the repo.
