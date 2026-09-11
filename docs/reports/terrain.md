# WP2 — Terrain, maps config, OG renderer (`terrain`)

Branch `wp/terrain`, worktree `/home/user/wd-terrain`. Gates in the worktree: `npm run lint`,
`npm run typecheck`, `npm run test` (19 files / 84 tests) and `npm run build` all green.
`npm run e2e` was not run in this phase (it targets the integrated build); `tests/e2e/og.spec.ts`
is written against the full route set.

## What shipped

### Contracts (verbatim, byte-identical to the spec — verified with `diff` against the fenced blocks)

- `src/lib/terrain/types.ts` (§3.2, owned).
- `src/config/maps.ts` (§3.7, owned).
- `src/lib/geo.ts` (§3.1, WP1's file, created under create-if-missing).

These three files are intentionally **not** prettier-formatted: the spec bytes win, and the spec
text is not prettier-clean (`types.ts`, `maps.ts`). The gates do not run `prettier --check`, so
nothing fails; see the request to WP6 below.

### Generator — `src/lib/terrain/*` (§3.7)

| Module                       | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rng.ts`                     | `hashString` (FNV-1a 32-bit), `mulberry32`, `hashLattice`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `noise.ts`                   | `valueNoise2D`, `fbm`, `ridged`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `geometry.ts`                | RDP `simplify`, `catmullRom`, `chaikinClosed`, `pointInRing`, `ringArea`, `ringCentroid`, `distToPolyline`, `nearestOnPolyline`, `pointAlong`, grid `sampleGrid` / `downsample`, marching squares `isolines` / `isolinesPadded` / `padGrid` (grid padded below the level so every ring closes along the map edge and even-odd fill paints the area above the level)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `contours.ts`                | `CONTOUR_STEP` 0.05, `contourLevels`, `contourLines` (index contour every 5th level)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `features.ts`                | zone polygons (12–20 vertices, radius 0.075 / 0.06), lake `blob`, block builders (street axis, scattered village, industrial yard, circular tanks), `fieldParcels` (rotated lattice of quads), `maskRings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `builder.ts`                 | the `Layout` / `World` working types and routing helpers (`route`, `connect`, `crossing`, `sharpestBend`, `highestPoint`, …)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `biomes.ts`                  | the three biome definitions: `river-valley` (broad valley carved by a river + tributary, farmland patchwork, crossroads town, villages, rail along the valley, pond at Tarn Cross), `highland` (anisotropic ridged noise, reservoir beside the water works, inflow stream and a wash, quarry with a rail spur, sparse villages, dry palette), `coastal` (sea on the east with a bay, port with quay warehouses and a breakwater, coastal road, rail to a container yard, dunes as a ridged strip near the shore, salt flats). Anchored features per §3.7: `industry` (4–7 large blocks) at `small-factory`, `water-works` (3–5 tanks, beside water) at `water-treatment`, `village` (8–14 blocks) at `houses`, crossroads `town` + `objective` POI at `default`; 8 flavour POIs named from `names` in order, each placed by a real feature (bridge = road × river crossing, bend = sharpest river vertex, ridge = highest interior cell, halt = point on the rail, …). |
| `generate.ts`                | `generateTerrain(spec)` (deterministic; ≈ 95–105 ms warm at res 256 on this box), `mapModel(id)` (module-level memo), `specFor(def)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `palette.ts` / `draw-svg.ts` | `biomePalette(biome)` — every `ground` at relative luminance 0.157 / 0.163 / 0.164 (band 0.15–0.19), ≥ 4.1:1 against both white and black; palettes distinct; colour maths (`mix`, `relativeLuminance`, `contrastRatio`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `draw-svg.ts`                | `terrainToSvg`, `terrainToDataUri`, `SvgOptions` (incl. `detail`, `crop`, `background`), `layoutLabels` (label collision avoidance shared with the canvas), `STYLE` constants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `draw-canvas.ts`             | `drawTerrain(ctx, model, size)` (real hillshade from the heightfield, light from the NW, ±8 % luminance; same vector layers as the SVG), `terrainBitmap(model, size)` (OffscreenCanvas or detached canvas, memoised by seed+size, failed promise evicted), `clearBitmapCache` (tests)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `url.ts`                     | `terrainUrl(map, opts)` → `/terrain/<map>.svg?size=…&zone=…&grid=…&labels=…&v=<site.version>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `index.ts`                   | barrel for `@/lib/terrain`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

SVG size (measured): Zestafona 33 kB full / 22 kB thumb, Bakurani 42 / 26 kB, Ozeti 28 / 19 kB
(budgets 150 / 40 kB, asserted for all three maps). Each contour level is one `<path>` in
`<defs>` reused four times (SE shadow, NW highlight, hypsometric band fill, contour stroke), so
the relief costs no extra path bytes.

### Route — `src/app/terrain/[file]/route.ts`

`GET /terrain/<zestafona|bakurani|ozeti>.svg`, zod-validated query (`size` ∈ {320, 640, 1024},
`zone` ∈ `CONTROL_ZONE_IDS`, `grid`/`labels` ∈ {0, 1}; anything else 404), `image/svg+xml;
charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, dynamic handler, memoised
model. `detail` is `thumb` at ≤ 400 px, `full` otherwise.

### OG — `src/lib/og/*`, `src/app/opengraph-image.tsx`, `src/app/twitter-image.tsx` (§6.2)

- `presets.ts`: `OgPreset`, `OG_SIZE`, `OG_CONTENT_TYPE`, `OG_PRESETS` (`root`, `demo`, `dev`,
  `admin`, `room`, `create`, `join` — headline, strapline, terrain map, alt text). The room preset
  carries no code.
- `render.tsx`: `renderOg(preset): ImageResponse` (sync, as specified), `ogElement`, `loadOgFonts`
  (TTFs read with literal `join(process.cwd(), "src/assets/fonts/…")` paths, cached), `headlineSize`.
  1200×630, `#141311`, two-scale grid at 4 %/1.8 %, the brand contour rings from
  `src/lib/brand/contours.ts` at 7 % amber, optional terrain crop (`size 630, detail thumb,
labels/grid off`) at 40 % on the right with a left-to-right fade so the headline stays legible,
  44 px mark from `markSvg` + 40 px wordmark, Saira 800 headline (128 px, shrinking so the widest
  line fits 1080 px, ≤ 3 lines, line-height 0.9), amber Barlow 500 30 px strapline with 60 px
  rules, 4 px amber bottom bar. Without fonts it renders the text-free composition instead of
  failing.
- Fonts: `src/assets/fonts/SairaCondensed-ExtraBold.ttf`, `Barlow-Medium.ttf` from the Google
  Fonts repo with `OFL-SairaCondensed.txt`, `OFL-Barlow.txt` and a `README.md`. The two woff
  files that were in the folder are removed (nothing referenced them; satori reads the TTFs).
- Thin route files for the other packages are one-liners, e.g.
  `src/app/(app)/demo/opengraph-image.tsx`:

  ```tsx
  import { OG_CONTENT_TYPE, OG_PRESETS, OG_SIZE, renderOg } from "@/lib/og/render";
  export const runtime = "nodejs";
  export const alt = OG_PRESETS.demo.alt;
  export const size = { width: OG_SIZE.width, height: OG_SIZE.height };
  export const contentType = OG_CONTENT_TYPE;
  export default function Image() {
    return renderOg(OG_PRESETS.demo);
  }
  ```

  Use `OG_PRESETS.admin` for `(admin)/demo/admin`, `OG_PRESETS.room` for `(app)/room/[code]`
  (ignore `params`), `OG_PRESETS.dev` for `(site)/dev`, `OG_PRESETS.create` / `.join`.

### Tests

- Unit (`src/lib/terrain/*.test.ts`, `src/lib/og/render.test.tsx`): determinism per seed and
  divergence across seeds; every zone/POI/settlement/road/ring inside [0, 1]²; each anchor has a
  settlement of the right kind within 0.05 (plus block-count ranges and "beside water" for the
  works); 6–8 flavour POIs named in spec order; biome signature features; `terrainToSvg` starts
  with `<svg`, contains the zone name, ≤ 40 kB thumb and ≤ 150 kB full/1024 for every map;
  labels/grid/detail/crop/background options; ground luminance 0.15–0.19 and ≥ 3.5:1 contrast;
  palettes distinct; `terrainUrl`; generation < 1 s; `drawTerrain` call sequence on a recording
  context; `terrainBitmap` memoisation and failure eviction; every geometry/rng/noise/feature
  export; OG presets, font loading, element tree with/without fonts, a real PNG from `renderOg`
  (node environment — resvg's wasm rejects jsdom's cross-realm `Uint8Array`).
- E2E `tests/e2e/og.spec.ts`: all eight OG routes are 200 `image/png` with a 1200×630 IHDR; two
  room codes render byte-identical images; `/terrain/*.svg` is 200 SVG with the immutable
  cache header, within budget, contains the zone chip; unknown files and bad queries 404.

### Visual check

Rendered every map at 1024 (full, grid, zone), 320 (thumb) and as OG crops through headless
Chromium, and the canvas renderer side by side with the SVG (vite-bundled into a plain page).
Screenshots under
`/tmp/claude-0/-home-user-War-dogs/61851c33-82db-5257-a90e-a5d704125fb0/scratchpad/build/shots-terrain/`
(`*-full.png`, `*-thumb.png`, `og-*.png`, `thumbs-desktop.png`, `thumbs-mobile.png`,
`canvas-vs-svg.png`). Iterations from looking: label collision avoidance, the town label not
repeated under an active zone chip, interior-only "highest point" POI, the Ozeti bay moved north
so the port clears the crossroads, stronger band relief in the SVG, softer hillshade on canvas.

## Deviations from the spec (with reasons)

1. **Anchored settlement names.** The four anchored settlements are named after their zones
   (`Default`, `Small Factory`, `Water Treatment`, `Houses`) and **all eight** entries of
   `names` go to flavour POIs in order (the spec allows 6–8). Reason: `names[0]` is not a town
   name on every map (`Breakwater`, `Saddle`), and the zone names on the map match what players
   see in the game. The objective POI is also named `Default` and renders as a glyph only.
2. **`twitter-image.tsx` is a full file, not a re-export.** Next 16 refuses re-exported segment
   config (`runtime`) with a build-time error, so the file repeats the five exports and calls
   `renderOg(OG_PRESETS.root)`.
3. **SVG hillshade** is emulated: hypsometric band fills plus a SE shadow and NW highlight copy of
   each band (SVG has no per-pixel shading that resvg and browsers both honour). The canvas
   renderer computes the real NW hillshade from the heightfield. Checked by eye side by side.
4. **Grid and zone are SVG-only.** `drawTerrain` paints ground, fields, woods, contours, water,
   roads, settlements, POI glyphs, vignette and labels; the app's `GridLayer` / `ZoneLayer`
   (§4.3, WP3) draw the grid and zone over the canvas, so the canvas does not duplicate them.
5. **Thumb detail keeps the flat woods tint** (12 → 19 % alpha) and drops only the stipple, so
   woodland still reads at 320 px.
6. `renderOg` adds a `Cache-Control: public, max-age=86400, s-maxage=86400,
stale-while-revalidate=604800` header (static routes are prerendered anyway).
7. Extra exports beyond the listed API: `src/lib/og/presets.ts` (`OG_PRESETS`, `OG_SIZE`,
   `OG_CONTENT_TYPE`), `layoutLabels`/`STYLE`/`contoursFor` in `draw-svg.ts`, the geometry/
   feature/builder helper modules, and the `src/lib/terrain/index.ts` barrel.
8. Verbatim contract files are left unformatted (see above).

## Requests to other packages

### WP6 — `.prettierignore`

The three verbatim contract files are not prettier-clean as written in the spec. To keep
`npm run format:check` green after integration, add:

```diff
+# Verbatim contract files (§3.0): spec bytes win over formatting.
+src/lib/geo.ts
+src/lib/terrain/types.ts
+src/config/maps.ts
```

(Other verbatim files — `src/lib/map/types.ts`, `keys.ts`, `teams.ts`,
`src/lib/realtime/transport.ts`, `src/lib/admin-sim/types.ts` — will need the same treatment if
their spec text is not prettier-clean.)

### WP3 / WP4 / WP5 / WP6 — thin OG route files

Use the snippet under "OG" above with the matching `OG_PRESETS` key. `tests/e2e/og.spec.ts`
already asserts all eight routes; it will fail until those files exist.

### WP3 — consuming the terrain

- Server components: `<img src={terrainUrl(map, { size, zone })}>` (never a data URI).
- Map app: `terrainBitmap(mapModel(map), size)` once per map+size bucket; draw with
  `ctx.drawImage(bitmap, …)`; `drawTerrain` is available for a synchronous fallback.
- Zone polygons and names: `mapModel(map).zones`.

## Not done

- `npm run e2e` (runs on the integrated build in Phase 2).
- No dev-server hydration check of the canvas in a Next page: in this sandbox `next dev` pages
  never hydrate (the HMR WebSocket handshake fails), so the canvas was verified through a
  vite-bundled plain page instead. Nothing in the package depends on that.
