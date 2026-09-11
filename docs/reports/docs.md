# WP5 — Dev hub and docs content, config validator (`docs`) · Phase 1 report

Branch `wp/docs`, worktree `/home/user/wd-docs`. Merged in before starting: `wp/admin` (for
`src/lib/openapi/parse.ts` + `match.ts`), `wp/terrain` (for `src/lib/og`, `src/lib/terrain`,
`src/config/maps.ts`) and `wp/site` (latest primitives). Gates in the worktree: `npm run lint`,
`npm run typecheck`, `npm run test` (30 files / 166 tests), `npm run build` — all green.
`npm run e2e` was not run as a gate (it targets the integrated build), but `tests/e2e/docs.spec.ts`
was smoke-run against this worktree's dev server on both projects (12/12 green) with a scratch
Playwright config that has no `webServer` entry.

## What shipped

### Contracts

- `src/content/openapi.json`, `src/content/ServerSettings.ini` — already present from WP4's
  create-if-missing copies; verified byte-identical to the scratchpad (`md5sum`). Not touched.
- `src/content/dev/types.ts` — `DocSectionData`, `Doc` exactly as §3.15.
- `src/lib/config-ini/validate.ts` — `IniIssue`, `IniValidation`, `parseIni`, `validateIni`,
  `INI_KEYS` exactly as §3.10, plus `INI_SECTIONS` (section labels in template order),
  `parseRotationEntry`, `unquote`, `IniKeyType` as extra exports.
- `src/components/docs/DocsShell.tsx` — `DocsShell` and `DocSection` with the §3.15 signatures
  (both in `DocsShell.tsx`, as the §3.15 comment block places them); `CodeBlock.tsx` — `CodeBlock`
  with the §3.15 props (+ `InlineCode`, `DocTable` helpers); `EndpointTable.tsx` —
  `EndpointTable({ endpoints })` taking WP4's `Endpoint[]`.

### Config validator — `src/lib/config-ini/validate.ts` (zod-backed, 20 tests)

- `parseIni`: `;` / `#` / `//` comments, `[section]` headers (repeated headers merge), `key=value`
  with `+` list keys and quoted values, line numbers, keys before any section land in `""`.
- `validateIni`: unknown section / key → stripped + warning (`unknown-section`, `unknown-key`);
  orphan keys; syntax errors for lines that are neither; duplicates (last wins, warning); type
  checks (`bool`, `int`) and `range` errors via zod schemas; `ScorePeriod` 18–30 (the §7.1 case
  `ScorePeriod=40` → error); `BindAddress` not loopback + `Password` and no `PasswordHash` → error
  "Network listener needs PasswordHash"; RCON `bEnabled=true` on a network bind → warning "TLS cert
  and key required" (the rotation section's `bEnabled` is not confused with the listener's);
  `MinimumRequiredPlayers > MaxPlayers` → warning; `MaxReservedSlots > MaxPlayers`, min/max cash
  and level inversions, non-URL `ServerImageURL` → warnings; `RotationMode` must be
  `Ordered|Random` (error); `+RotationEntries` parsed field by field (`Map` required, `Experience`
  xor `Experiences`, unknown / duplicate fields, parentheses) → error with the reason; SteamID64
  shape on the two `+Default…PlayerIds` lists → error; rotation enabled with no entries → warning.
  `ok` = no errors; `warnings` mirrors the API's `warnings[]`; `stripped` lists `[section]` or
  `section.key`.
- `INI_KEYS` carries all 23 honoured keys across the seven sections with default / applies /
  description / type / range, ported from the upstream table (08). A test asserts every key in the
  shipped template is covered and no extra section exists.

### Docs shell — `src/components/docs/*`

- `DocsShell` (server): UNOFFICIAL strip (32 px, `bg-bg-1`, mono accent `UNOFFICIAL` + 13 px
  text), docs header row (eyebrow left, mono `Updated {updated} · v{version}` right, defaults
  `site.updated` / `site.version`), H1 `display display-2`, lede intro, the column layout
  (`lg`: sticky TOC 200 px + content; `xl`: + sticky "On this page" 160 px; below `lg`: a
  `<details>` Contents accordion at the top), and the docs footer line
  `WARDOGS.TECH — {EYEBROW} · Home · Discord · Fan-made · Not affiliated with Bulkhead or Team17`.
  When `toc` is empty (the hub) the page is a single 960 px column so the six cards get room.
  Imports `docs.css` (prose rules with a `not-prose` guard, tables, TOC, token colours). Same font
  stack as the site — no `font-family` override anywhere in the docs.
- `DocSection`: `<section id aria-labelledby>` with an h2 `display display-3`, a mono two-digit
  prefix when the id is `NN`, and a hover / focus `#` anchor link.
- `Toc.tsx` (client): `useScrollSpy` (scroll + resize + IntersectionObserver, rAF-throttled,
  "last heading past the 25 % line"), `TocNav` (mono 12 px, `aria-current="true"` + 2 px amber
  rule) and `OnThisPage` (h3s discovered from the article via `useSyncExternalStore`; renders
  nothing when a page has no h3s).
- `CodeBlock` (server; the `CopyButton` chip is the island): header bar with filename / language,
  `overflow-x-auto` pre, optional `wrap`, and a tiny pure tokenizer (`highlight.ts`) for
  `ini` / `json` / `http` / `bash`. `DocTable`: `overflow-x-auto` wrapper, `label-mono` header row,
  zebra rows, full-bleed on phones (`-mx-6`).
- `EndpointTable` (client): `All / Read / Write` chips, `role="search"` box (method / path /
  group / summary / description substring), `n of 35 endpoints` live count, columns Method ·
  Path · Group · Access · Description & body (body keys with `?` for optional, text/plain note for
  the config endpoints), path params in amber, every path linking to
  `/rcon-api?endpoint=<endpointId>`, empty state.
- `DiscordStepper` (client): Q1–Q3, outcomes A–D with the §4.9 copy, links to `/add` and the
  article sections, `Copy this checklist for my mods` (plain-text checklist per outcome),
  `Start over`; state in `sessionStorage wardogs:dh` through a tiny external store
  (`useSyncExternalStore`, no hydration mismatch, memory fallback when storage throws); outcome
  announced via `announce()` and focus moved to the outcome heading. Pure `resolve()` exported.
- `ConfigValidator` (client): labelled textarea, `Validate` (disabled while empty),
  `Load the template`, results panel (`Valid` / `Rejected` badge, counts line, errors then
  warnings with level badge + `L<n>` + key chip, stripped list), `aria-live` region.
- `IniViewer` (server): one `<details>` per section (first open) with the key rows from `INI_KEYS`
  (key mono accent, default chip, applies chip, description, and `template: <value>` where the
  starter template differs from the default, e.g. `MaxPlayers` 32 vs 128).
- `Stats`: the stat-chip row used by the reference and the map guide intros.

### Content modules — `src/content/dev/*`

- `rcon-reference.tsx`: sections 01–10 ported from the capture where factual; 05 is generated
  (`EndpointTable` over `getSpec().endpoints`), 08's key table is generated from `INI_KEYS` /
  `INI_SECTIONS` (so the docs and the validator cannot drift), the RCON listener block and the
  rotation entry format as `ini` code blocks, the download panel links `/ServerSettings.ini` with
  `download`, 03's "One token, full access" is a danger `Callout`, 09 renders `RCON_PROMPT` with
  one `CopyButton` `Copy for Claude / ChatGPT`. Four stat chips with the endpoint count read from
  the parsed spec.
- `rcon-prompt.ts`: `RCON_PROMPT`, extracted from the capture by a script (byte-exact apart from
  trailing whitespace and the one leading space the HTML text node carried).
- `discord-help.tsx`: the article verbatim (seven sections, three tables), with the §4.9 edit in
  "Things that are not the problem" (see deviations for the duplicate sentence).
- `map-guide.tsx`: rewritten for this codebase — TL;DR chips, why procedural (generator,
  determinism, the two renderers, the `/terrain/<map>.svg` route, ground luminance), coordinate
  system (verbatim contract sentence + how the viewport transform and widths work, metres per
  map from `MAPS`), grid references with an inline-SVG keypad figure, control zones with a table
  generated from `MAPS` (anchors as grid refs + normalised coordinates, biome / seed / width),
  custom uploads (the §4.3.6 pipeline, IndexedDB, chunking, hash check, scale note as a Callout,
  reverting, the three exports), adding a built-in map (a `MapDef` example + rules), reference
  constants table.
- `dev-hub.ts`: the six card records. `json-ld.ts`: `docJsonLd()` → `TechArticle` +
  `BreadcrumbList` (Home › Dev hub › page; the hub itself has two crumbs).

### Routes

- `src/app/(site)/dev/page.tsx` — cards (`LinkCard` tier 2; the template card is a plain `<a
download>` with the same tier-2 classes), `Validate a config` (`ConfigValidator`), `The annotated
template` (`IniViewer`), the `Building something?` note Callout. Reads the template with
  `fs.readFile(join(process.cwd(), "src/content/ServerSettings.ini"))` at build time.
- `src/app/(site)/dev/opengraph-image.tsx` — `renderOg(OG_PRESETS.dev)` (WP2 helper).
- `src/app/(site)/rcon-reference/page.tsx` — passes `parseSpec(openapi).info.updated / .version`
  to the shell header (`Updated 2026-09-10 · v0.27`).
- `src/app/(site)/discord-help/page.tsx` — `Start here` section (stepper) above the article.
- `src/app/(site)/map-guide/page.tsx`.
- `src/app/openapi.json/route.ts` — the committed bytes, `application/json; charset=utf-8`,
  `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, plus
  `Access-Control-Allow-Origin: *` so external tools (Postman, generators) can fetch it.
- `src/app/ServerSettings.ini/route.ts` — `text/plain; charset=utf-8`,
  `Content-Disposition: attachment; filename="ServerSettings.ini"`, same cache header.
- Every page exports `metadata` with the §3.14 title / description and `alternates.canonical`;
  each renders `TechArticle` + `BreadcrumbList` JSON-LD through WP6's `JsonLd`.

### Tests

- Unit: `src/lib/config-ini/validate.test.ts` (20), `src/components/docs/DiscordStepper.test.tsx`
  (all four outcomes reachable, reset, restore from storage, garbage tolerated),
  `ConfigValidator.test.tsx` (renders issues for `ScorePeriod=40` + an unknown key; template loads
  and validates clean), `EndpointTable.test.tsx` (filtering, deep links, tokenizer).
- E2E `tests/e2e/docs.spec.ts` (§7.2 spec 9): `/dev` cards + validator flags `ScorePeriod=40` +
  template viewer; `/rcon-reference` header version, generated table (35 rows, deep links,
  search + Write filter), prompt copy button, download link, TOC scroll-spy (desktop);
  `/discord-help` stepper reaches outcome D and survives a reload; `/map-guide` sections, zone
  table, keypad figure; `/openapi.json` (31 paths, headers) and `/ServerSettings.ini`
  (attachment header); JSON-LD + canonical + no horizontal scroll on all four routes.

### Visual QA

Screenshots at 1440×900 and 390×844 for all four routes, section crops of the endpoint table,
the key table, the stepper and the validator in their result states, under
`scratchpad/build/shots-docs/`. Fixed from the first pass: prose `ul` rules leaking into the card
grid (added a `not-prose` guard to every prose rule), the three-column content width at `xl`
(see deviations), path-param colour, table density, a figcaption that could overflow.

## Deviations from the spec (with reasons)

1. **UNOFFICIAL strip position.** §3.15 lists the strip before `SiteHeader`, but the `(site)`
   layout (WP6-owned) renders `SiteHeader` above `main`, and `DocsShell` renders inside `main`.
   The strip is therefore the first thing under the sticky header rather than above it. Rendering
   a second `SiteHeader` inside the shell would duplicate the landmark. If the strip must sit
   above the header, WP6 can add an optional `beforeHeader` slot to `(site)/layout.tsx` — see
   requests.
2. **Column widths at `xl`: TOC 200 px / "On this page" 160 px** (spec: 220 / 200). With the
   1280 px container and 64 px gutters the spec widths leave a 636 px content column, which cannot
   hold the five-column endpoint table or the four-column key table the same section mandates
   without a horizontal scroll on a desktop. 200 / 160 with 40 px gaps gives 712 px; running text
   is still capped at 68ch by CSS.
3. **Map guide eyebrow** is `Reference · Maps` (the page block in §4.9) rather than `Map guide`
   (the shell paragraph lists both); the docs footer therefore reads `WARDOGS.TECH — REFERENCE ·
MAPS`. Trivial to flip.
4. **Discord help edit.** §4.9 says to replace `Hundreds of servers are running war rooms right
now.` with `A whole-app failure would affect every server, not one.` The upstream cell continues
   `A whole-app failure does not affect one server.`, which becomes a near-duplicate after the
   replacement, so the cell is the single replacement sentence.
5. **Map-space constants in the map guide are literals** (`MAP_PX`, `MAX_NODES`, …) because
   `src/lib/map/types.ts` (WP1) is not on this branch yet and a consumer must not create an API
   file. Phase 2: import them from `@/lib/map/types` and `gridRef` from `@/lib/map/grid.ts`
   (the module has a local mirror of `gridRef` for the zone table, documented as such).
6. **Section 05 intro says "Path parameters are in amber"** (upstream: violet). Violet is not in
   the palette and `enemy-b` is reserved for map markers (§2.3).
7. **The console blurb in 05** no longer mentions Scalar (we do not ship it); it describes the
   WP4 console.
8. **Route handlers are dynamic (`ƒ`)** in the build output: they read the files with `fs` at
   request time and set the §3.14 headers explicitly (the spec's rule for handlers). Forcing them
   static would let Next rewrite `Cache-Control`.
9. `EndpointTable` links use `endpointId` from WP4 (`post-v1-players-steamId-kick`); the console's
   `?endpoint=` reader (WP4, Phase 2) must accept the same ids — it already generates them.

## Requests to other packages

- **WP6 — `src/app/(site)/layout.tsx`** (optional, only if the strip must sit above the header):

  ```diff
  -export default function SiteLayout({ children }: { children: React.ReactNode }) {
  +export default function SiteLayout({ children }: { children: React.ReactNode }) {
     return (
       <div className="flex min-h-dvh flex-col vignette">
         <a href="#main" …>Skip to content</a>
  +      <div id="site-before-header" />
         <SiteHeader />
  ```

  and WP5 would portal the strip into it. Not needed for the current layout; listed for
  completeness.

- **WP6 — `src/app/sitemap.ts`**: already lists `/dev`, `/rcon-reference`, `/rcon-api`,
  `/discord-help`, `/map-guide` (checked). No change.

- **WP4 — `(site)/rcon-api/page.tsx` (Phase 2)**: render
  `<DocsShell eyebrow="Dev hub" unofficialLine="Community tools and references. Not affiliated with the Wardogs developers." title="API Console" intro={<p>Every endpoint in the spec, with a form, a live request preview and a response. Try it against the simulator in this tab, or against your own server.</p>} toc={[]} updated={getSpec().info.updated} version={getSpec().info.version}><ConsoleLoader /></DocsShell>`.
  With `toc={[]}` the shell is a single 960 px column; pass a `toc` to get the rail.

- **WP1 (Phase 2, for WP5 itself)**: nothing to change in WP1; WP5 will switch the map guide's
  literals to `@/lib/map/types` and `@/lib/map/grid` once `wp/core` is merged.

## Not done

- Nothing from the package block is missing. Phase 2 follow-ups only: the map-guide imports
  above, and re-running `docs.spec.ts` on the integrated build (it passed here against the
  worktree's own server).

## Phase 2 — integration fixes

Merged `claude/wardogs-clone-improvement-agc9oe` (every package's Phase 1) into `wp/docs`, ran
`next typegen`. Gates in the worktree after the changes: `npm run lint`, `npm run typecheck`,
`npm run test` (55 files / 325 tests), `npm run build` — all green. E2E:
`PORT=3105 npm run e2e -- tests/e2e/docs.spec.ts` on the integrated build — 12/12 green on both
projects (the Playwright config built and started `next start -p 3105` itself; the relay entry
reused the relay already listening on 8787 because `reuseExistingServer` is on outside CI).

### Done

1. **Map guide reads the real modules** (`src/content/dev/map-guide.tsx`): `MAP_PX`,
   `DEFAULT_STROKE_WIDTH`, `DEFAULT_DANGER_RADIUS`, `MAX_NODES`, `MAX_NODES_PER_OP`,
   `MAX_STATE_BYTES`, `MAX_STROKE_POINTS`, `MAX_TEXT_CHARS` from `@/lib/map/types`; `gridRef`,
   `GRID_COLS`, `GRID_N` from `@/lib/map/grid` (the local mirror is deleted; the zone table calls
   `gridRef(anchor, true)`); `MAP_CHUNK_BYTES` and `MAX_MAP_BYTES` from `@/lib/realtime/map-chunks`
   (the "48 kB chunks" and "shared ≤ 1.5 MB" figures are now derived); `EXPORT_LEGEND_HEIGHT` from
   `@/lib/map/export-png`; `DEFAULT_RES` from `@/lib/terrain/generate`; zone columns from
   `CONTROL_ZONE_IDS` minus `none`. The grid copy and stat chips are rendered from `GRID_N` /
   `GRID_COLS`. Facts re-checked against the code: grid A–J / 1–10 with keypad sub-cells (7 8 9
   top, 1 bottom-left) matches `grid.ts`; `MAP_LIST` has the three built-ins (zestafona, bakurani,
   ozeti); the `MapSourceSchema` upload shape (SHA-256 hex of the shared bytes, `w`/`h` ≤ 1024,
   name ≤ 64) matches the pipeline text; `/terrain/<map>.svg` sizes 320/640/1024 match the route
   schema; the export paragraph was corrected — `exportPng` renders at `MAP_PX` (2048 px) with a
   56 px legend strip (room code, team, map, zone, date), not "at the current zoom"; Save/Load plan
   describe `planToSnapshot` / `importPlan` (`replace` | `merge`). The 8 MB file-input cap stays a
   literal with a comment: it is the §4.3.6 limit and no module exports it yet (WP3's `UploadMap`
   is Phase 2 there).
2. **Mobile overflow on `/dev`**: the culprit was `IniViewer`'s section-name `<code>` in each
   `<summary>` (`[/Script/WDGame.WDGameSession]` cannot wrap); it now has `min-w-0 max-w-full
break-all [overflow-wrap:anywhere]`. `scrollshoot.mjs` at 390 px: `scrollW === innerWidth` on
   `/dev`, `/rcon-reference`, `/discord-help`, `/map-guide` (the only elements wider than the
   viewport are tables and `<pre>` blocks inside their own `overflow-x-auto` containers, as the
   spec allows). The toast container (`inset-x-4`, WP6) was only reported because the layout
   viewport had been widened; it sits at 374 px now.
3. **Canonical + JSON-LD** (WP6's request): verified — all four pages export
   `alternates.canonical` and render `TechArticle` + `BreadcrumbList` through
   `@/components/site/json-ld`; `docs.spec` asserts it on the integrated build.
4. **Route handler headers** verified with `curl -I` against the build: `/openapi.json` →
   `content-type: application/json; charset=utf-8`, `cache-control: public, max-age=3600,
stale-while-revalidate=86400`, `access-control-allow-origin: *`; `/ServerSettings.ini` →
   `content-type: text/plain; charset=utf-8`, `content-disposition: attachment;
filename="ServerSettings.ini"`, same cache header. Exactly §3.14.
5. **Visual QA**: `scrollshoot.mjs` full-page shots at 1440×900 and 390×844 for the four routes
   plus element crops of the annotated template (sections 1 and 7 open), the grid, zone, custom
   maps and reference sections, under `scratchpad/build/shots-docs-p2/`. Nothing else needed
   fixing.

### Not done

- Nothing outstanding for WP5. Requests received from other packages (WP4's `/rcon-api` page
  wiring, WP6's canonical/JSON-LD) are either theirs to build or already satisfied.

### Requests to other packages

- **WP3** (`UploadMap.tsx`, Phase 2): export the file-input cap (e.g. `MAX_UPLOAD_BYTES = 8 *
1024 * 1024`) from a non-component module so the map guide can import it instead of quoting 8 MB.
- **WP6**: none new.

## Budgets

Perf-budget pass (§7.3) against `scripts/check-bundle.mjs` on the merged build.

| route                                              | before                   | after            | budget |
| -------------------------------------------------- | ------------------------ | ---------------- | ------ |
| `/dev`                                             | 248.1 kB gz (OVER)       | 157.1 kB gz (ok) | 190 kB |
| `/discord-help` / `/map-guide` / `/rcon-reference` | 158.4 / 156.1 / 157.9 kB | unchanged        | 190 kB |

- **Cause**: `ConfigValidator` is `"use client"` and statically imported `@/lib/config-ini/validate`,
  which imports `zod`; the whole validator + zod graph (~91 kB gz) rode the `/dev` first load.
  `IniViewer` also reads `validate.ts` but is a server component, so it costs nothing client-side.
- **Fix**: `src/components/docs/ConfigValidatorLoader.tsx` (`"use client"`) owns
  `dynamic(() => import("./ConfigValidator"), { ssr: false })` and renders a
  `ConfigValidatorSkeleton` until the chunk lands; `/dev/page.tsx` imports only the loader. The
  page shell (cards, section copy, the annotated template) is still server-rendered HTML. The
  island's root carries `data-bundle="wd:validator"`.
- **Lazy bundle**: not measured by the committed script because `LAZY_BUDGETS` (in `scripts/`,
  not a WP5 path) has no `wd:validator` entry. Measured by hand from `.next/static/chunks`: the
  marked entry chunk is 5.7 kB gz and the sibling chunk that holds `zod` + `validate.ts` is
  86.4 kB gz — ≈ 92 kB gz in total, none of it referenced by the prerendered `/dev` HTML. Note
  for WP6: Turbopack loads that sibling through its runtime chunk list, not a textual `import()`,
  so the script's graph walk reports the entry alone (5.7 kB, 1 chunk); a `wd:validator` budget
  of 100 kB matches the real graph.
- Gates: prettier · lint · typecheck · `npm run test` (325) · `next build` · check-bundle (`/dev`
  ok; the only OVER rows left are the `/demo/admin/*` routes, WP4/WP6) · `docs.spec.ts` 12/12
  against the build on port 3105.
