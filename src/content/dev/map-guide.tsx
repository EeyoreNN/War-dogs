import * as React from "react";
import Link from "next/link";
import { CodeBlock, DocTable } from "@/components/docs/CodeBlock";
import { Stats } from "@/components/docs/Stats";
import { Callout } from "@/components/ui/callout";
import { MAP_LIST } from "@/config/maps";
import { CONTROL_ZONE_IDS, CONTROL_ZONE_LABEL, type ZoneAnchorId } from "@/lib/terrain/types";
import { CONTOUR_STEP } from "@/lib/terrain/contours";
import { DEFAULT_RES } from "@/lib/terrain/generate";
import { GRID_COLS, GRID_N, gridRef } from "@/lib/map/grid";
import {
  DEFAULT_DANGER_RADIUS,
  DEFAULT_STROKE_WIDTH,
  MAP_PX,
  MAX_NODES,
  MAX_NODES_PER_OP,
  MAX_STATE_BYTES,
  MAX_STROKE_POINTS,
  MAX_TEXT_CHARS,
} from "@/lib/map/types";
import { EXPORT_LEGEND_HEIGHT } from "@/lib/map/export-png";
import { MAP_CHUNK_BYTES, MAX_MAP_BYTES } from "@/lib/realtime/map-chunks";
import { site } from "@/config/site";
import type { Doc } from "./types";

/* Map-space constants come from the real modules (§3.3 / §3.4 / §5.7) so the guide cannot drift
   from the code. The 8 MB upload cap is the §4.3.6 file-input limit (WP3's `UploadMap`); it has
   no exported constant yet. */
const UPLOAD_CAP_MB = 8;
const SHARED_CAP_MB = MAX_MAP_BYTES / 1_048_576;
const CHUNK_KB = MAP_CHUNK_BYTES / 1024;
const TERRAIN_RES = DEFAULT_RES;

const ZONE_IDS = CONTROL_ZONE_IDS.filter((z): z is ZoneAnchorId => z !== "none");

/** The keypad figure: one grid cell split into nine, numbered like a phone keypad turned for maps. */
function KeypadFigure() {
  const digits = [7, 8, 9, 4, 5, 6, 1, 2, 3];
  return (
    <figure className="not-prose my-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <svg
        viewBox="0 0 132 132"
        width="132"
        height="132"
        role="img"
        aria-label="One grid cell, D7, divided into nine sub-cells numbered 7 8 9 on the top row, 4 5 6 in the middle and 1 2 3 on the bottom."
        className="shrink-0 rounded-md border border-line bg-bg-1"
      >
        {digits.map((d, i) => {
          const x = 6 + (i % 3) * 40;
          const y = 6 + Math.floor(i / 3) * 40;
          const hot = d === 3;
          return (
            <g key={d}>
              <rect
                x={x}
                y={y}
                width={40}
                height={40}
                fill={hot ? "var(--accent-soft)" : "transparent"}
                stroke={hot ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={hot ? 1.5 : 1}
              />
              <text
                x={x + 20}
                y={y + 25}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="14"
                fill={hot ? "var(--accent)" : "var(--text-1)"}
              >
                {d}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="min-w-0 text-[14px] leading-relaxed text-fg-muted">
        <span className="font-mono text-fg">D7</span> is the whole cell: column D, row 7.{" "}
        <span className="font-mono text-fg">D7-3</span> is its bottom-right ninth, highlighted. The
        digits sit like a phone keypad turned for maps: 7 8 9 across the top, 1 2 3 across the
        bottom, 5 in the middle — so &ldquo;north&rdquo; is the high digits and 1 is bottom-left.
      </figcaption>
    </figure>
  );
}

export const mapGuide: Doc = {
  slug: "map-guide",
  title: "How this site draws a map",
  eyebrow: "Reference · Maps",
  unofficialLine: "How this site draws its maps. Code wins over docs if they disagree.",
  jsonLd: "TechArticle",
  intro: (
    <p>
      Every map on {site.name} is generated in the browser and on the server from a seed. This is
      the coordinate system under it, how a grid reference is read, where the control zones sit, and
      what a commander&apos;s uploaded map can be.
    </p>
  ),
  sections: [
    {
      id: "tldr",
      title: "TL;DR",
      body: (
        <>
          <Stats
            items={[
              {
                label: "Maps",
                value: `${MAP_LIST.length} (${MAP_LIST.map((m) => m.id).join(", ")})`,
              },
              { label: "Map space", value: `${MAP_PX} units` },
              {
                label: "Grid",
                value: `${GRID_N} × ${GRID_N}, ${GRID_COLS[0]}–${GRID_COLS[GRID_N - 1]} / 1–${GRID_N}`,
              },
              { label: "Custom upload cap", value: `${UPLOAD_CAP_MB} MB` },
            ]}
          />
          <p>
            Every built-in map is drawn by the site from a seed: no game art, no screenshots. The
            layout is schematic — approximate by design — and the control zones sit at fixed
            positions so callouts mean the same thing in every room.
          </p>
        </>
      ),
    },
    {
      id: "why-procedural",
      title: "Why procedural",
      body: (
        <>
          <p>
            This is a fan project, and the game&apos;s maps belong to the people who made the game.
            So the site draws its own: a terrain generator turns a map definition (a seed, a biome,
            four zone anchors and a list of invented place names) into contours, water, roads, rail,
            settlements, woods, fields and named points of interest. Nothing is traced from a
            screenshot; the result is a plausible map, not a replica.
          </p>
          <p>
            The generator is deterministic. The same seed produces the same heightfield, the same
            river, the same town, every time, on every machine. That is what lets one drawing mean
            the same thing everywhere: the demo, the create page thumbnails, the social preview
            images and every war room on that map show the same terrain, and a marker at{" "}
            <code>{"{ x: 0.42, y: 0.61 }"}</code> lands on the same crossroads for everyone in the
            call.
          </p>
          <p>
            Two renderers draw the same model. The SVG renderer runs on the server and answers{" "}
            <code>/terrain/&lt;map&gt;.svg</code> (320, 640 or 1024 px; cached for a year and busted
            by the site version) — that is how thumbnails, server-rendered previews and the hero get
            their terrain by URL. The canvas renderer runs in the map app itself, adds a real
            hillshade from the heightfield, and is cached as an <code>ImageBitmap</code> so panning
            and zooming never redraw the terrain from vectors.
          </p>
          <p>
            Every biome&apos;s ground colour sits at a mid charcoal-olive (relative luminance
            0.15–0.19), far lighter than the site background, so both white and black ink read at ≥
            3.5:1 on the base fill. That is asserted in a unit test, not eyeballed.
          </p>
        </>
      ),
    },
    {
      id: "coordinates",
      title: "Coordinate system",
      body: (
        <>
          <blockquote>
            Everything drawn is stored as a normalised point <code>{"{x, y}"}</code> in{" "}
            <code>[0, 1]</code> on the square map, and widths as fractions of map width, so drawings
            line up at every zoom. Map space is {MAP_PX} units; the viewport is scale + translate.
          </blockquote>
          <p>
            The origin is the top-left corner; <code>x</code> grows to the right and <code>y</code>{" "}
            grows downward, like a screen. Because every map is square and every point is a
            fraction, a plan drawn on a phone in a 360 px viewport and the same plan on a 2560 px
            monitor are the same numbers. Nothing is stored in pixels.
          </p>
          <p>
            The renderer multiplies a point by <code>MAP_PX</code> ({MAP_PX}) to get map space, then
            applies the viewport: <code>screenX = worldX × MAP_PX × scale + tx</code>, the same for{" "}
            <code>y</code>. Zooming changes <code>scale</code> around the cursor; panning changes{" "}
            <code>tx</code> / <code>ty</code>. The node layers are SVG groups under one transform,
            so the browser does that arithmetic, not the app.
          </p>
          <p>
            Widths follow the same rule. A pen stroke defaults to{" "}
            <code>{DEFAULT_STROKE_WIDTH}</code> of the map width, a danger circle to a radius of{" "}
            <code>{DEFAULT_DANGER_RADIUS}</code>. Marker glyphs are the one exception: they keep a
            fixed screen size so they stay legible when you zoom out.
          </p>
          <p>
            Distances are real on the built-in maps. Each map definition carries an approximate
            width in metres (
            {MAP_LIST.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 ? ", " : ""}
                {m.name} {m.widthMetres} m
              </React.Fragment>
            ))}
            ), so the measure tool reports <code>metres = widthMetres × distance</code> and a
            bearing with north up. Only the ratio matters: change <code>widthMetres</code> and every
            past measurement is rescaled, nothing is redrawn.
          </p>
        </>
      ),
    },
    {
      id: "grid",
      title: "Grid references",
      body: (
        <>
          <p>
            The map is divided into a {GRID_N} × {GRID_N} grid. Columns run{" "}
            <strong>
              {GRID_COLS[0]}–{GRID_COLS[GRID_N - 1]}
            </strong>{" "}
            left to right, rows <strong>1–{GRID_N}</strong> top to bottom, so <code>A1</code> is the
            top-left cell and <code>J10</code> the bottom-right. Each cell is a tenth of the map —
            on Zestafona about 240 m on a side — which is about the precision a voice call can
            carry.
          </p>
          <p>
            When a callout needs to be tighter, a cell splits into nine sub-cells with a keypad
            digit: <code>D7-3</code>.
          </p>
          <KeypadFigure />
          <p>
            The grid is drawn on the terrain when you switch it on; the current reference appears in
            the status line as the pointer moves, and a ping announces its reference to the roster.
            Plan text export uses the same references, so &ldquo;Fuel at E4-8&rdquo; in a copied
            plan means the same square to someone reading it in chat.
          </p>
          <p>
            The two conversions are pure functions in <code>src/lib/map/grid.ts</code>:{" "}
            <code>gridRef(point, sub?)</code> turns a normalised point into{" "}
            <code>&quot;D7&quot;</code> or <code>&quot;D7-3&quot;</code>, and{" "}
            <code>gridCell(ref)</code> turns a reference back into the cell&apos;s bounds (or{" "}
            <code>null</code> when it is not a reference).
          </p>
        </>
      ),
    },
    {
      id: "zones",
      title: "Control zones",
      body: (
        <>
          <p>
            A war room is opened for one map and one control zone. The zone is a fixed anchor in the
            map definition; the generator builds a matching feature there (a crossroads town for the
            default zone, an industrial block at the small factory, tanks beside water at the water
            treatment, a village at the houses) and draws a 12–20 vertex ring around it, a radius of
            0.075 of the map width for the default zone and 0.06 for the others. The same anchors
            are used for every room, so <code>D7</code> on Bakurani is the same place in every call.
          </p>
          <DocTable
            caption="Control zone anchors per map, as grid references"
            head={["Map", ...ZONE_IDS.map((z) => CONTROL_ZONE_LABEL[z])]}
          >
            {MAP_LIST.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  <span className="mt-0.5 block font-mono text-[12px] text-fg-faint">
                    {m.biome} · seed 0x{m.seed.toString(16)} · {m.widthMetres} m
                  </span>
                </td>
                {ZONE_IDS.map((z) => (
                  <td key={z}>
                    <code>{gridRef(m.anchors[z], true)}</code>
                    <span className="mt-0.5 block font-mono text-[12px] text-fg-faint">
                      {m.anchors[z].x.toFixed(2)}, {m.anchors[z].y.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </DocTable>
          <p>
            A fifth option, <strong>None</strong>, opens the map without a zone ring for rooms that
            are not about a KOTH objective. Changing the map or the zone later keeps every drawing
            where it is: positions are relative, and the zone is only a highlight.
          </p>
        </>
      ),
    },
    {
      id: "custom-maps",
      title: "Custom maps uploaded by a commander",
      body: (
        <>
          <p>
            The commander of a room can replace the schematic terrain with an image: a screenshot of
            your own, a hand-drawn layout, a scan of a paper map. PNG, JPEG or WebP, up to{" "}
            {UPLOAD_CAP_MB} MB.
          </p>
          <h3 id="upload-pipeline">What happens to the file</h3>
          <ol>
            <li>
              The bytes are sniffed for a real image signature (the file extension is not trusted),
              then decoded in the browser.
            </li>
            <li>
              The image is letterboxed onto a square field in the site&apos;s background colour. It
              is never stretched: a 16:9 screenshot gets bars top and bottom, and every point on it
              keeps its shape.
            </li>
            <li>
              Two variants are made. A <strong>full</strong> copy at {MAP_PX} px (PNG stays PNG;
              anything else becomes JPEG) is the uploader&apos;s own display copy. A{" "}
              <strong>shared</strong> copy at 1024 px is re-encoded as JPEG at decreasing quality
              until it fits in {SHARED_CAP_MB} MB; that is the one everyone else receives.
            </li>
            <li>
              Both are kept in your browser (IndexedDB, keyed by the SHA-256 of the shared bytes)
              and the room switches to the uploaded map. The shared copy is sent to the room in{" "}
              {CHUNK_KB} kB chunks; receivers verify the hash before they show it, and a peer who
              joins later asks the room for it.
            </li>
          </ol>
          <p>
            The full and shared variants have identical geometry, so a stroke drawn over the 1024 px
            copy on a phone lands on the same building in the {MAP_PX} px copy on the
            uploader&apos;s screen. Nothing about the drawing model changes: points are still
            fractions of a square.
          </p>
          <Callout tone="note" title="Scale">
            Scale is unknown for an uploaded map, so the measure tool reports map fractions. If you
            know the width of what you uploaded, count in cells: one grid cell is a tenth of it.
          </Callout>
          <h3 id="reverting">Reverting and what peers see</h3>
          <p>
            <strong>Use built-in map</strong> in the map panel returns the room to the schematic
            terrain; drawings stay where they are. Someone who has not received the image yet sees a
            banner — <em>Commander&apos;s map not received — showing the schematic map</em> — on the
            built-in terrain until the bytes arrive. Uploaded maps live in the browsers of the
            people in the room (and in the relay&apos;s memory while the room is active); they are
            never stored on this site.
          </p>
          <h3 id="export">Taking a plan out of the room</h3>
          <p>
            Three exports, none of which need the map to be built-in. <strong>Export PNG</strong>{" "}
            renders the terrain (or the uploaded image) with every visible layer on top as one{" "}
            {MAP_PX} px square image with a {EXPORT_LEGEND_HEIGHT} px legend strip (room code, team,
            map, zone, date) bottom-left. <strong>Copy plan as text</strong> writes the markers and
            requests as lines with grid references — the version you paste into a channel.{" "}
            <strong>Save plan</strong> writes the room&apos;s nodes as JSON with their normalised
            points, so <strong>Load plan</strong> puts them back on any map at the same relative
            positions, replacing or merging with what is already drawn.
          </p>
        </>
      ),
    },
    {
      id: "adding-a-map",
      title: "Adding a built-in map",
      body: (
        <>
          <p>
            A built-in map is one entry in <code>src/config/maps.ts</code>. The generator does the
            rest from the seed. To add one, extend <code>MAP_IDS</code> in{" "}
            <code>src/lib/terrain/types.ts</code>, add the name to <code>site.game.maps</code>, and
            add a <code>MapDef</code>:
          </p>
          <CodeBlock
            lang="json"
            filename="src/config/maps.ts"
            code={`kavkazi: {
  id: "kavkazi",
  name: "Kavkazi",
  seed: 0x4b41_564b,            // any 32-bit integer; change it and the whole map changes
  biome: "highland",            // "river-valley" | "highland" | "coastal"
  widthMetres: 2100,            // approximate; only the measure tool reads it
  anchors: {                    // normalised [0, 1]; the generator builds a feature at each
    default: { x: 0.5, y: 0.5 },
    "small-factory": { x: 0.7, y: 0.35 },
    "water-treatment": { x: 0.3, y: 0.4 },
    houses: { x: 0.6, y: 0.72 },
  },
  names: ["Pass", "Old Fort", "Ridge Farm", "Ferry", "The Cut", "Mill Race", "Low Road", "Station"],
  blurb: "One line for the create page.",
},`}
          />
          <ul>
            <li>
              <strong>Anchors</strong> are where the zones are, so keep them inside roughly{" "}
              <code>0.2–0.8</code> on both axes and at least 0.15 apart; the generator puts the
              town, factory, water works and village on them and routes roads between.
            </li>
            <li>
              <strong>Names</strong> are handed out in order to the flavour points of interest (a
              bridge, a bend, a ridge, a halt). Eight is the right number; they must be invented.
            </li>
            <li>
              <strong>Biome</strong> picks the terrain recipe and palette: <code>river-valley</code>{" "}
              carves a valley with farmland, <code>highland</code> raises ridges and a quarry,{" "}
              <code>coastal</code> puts the sea on one side with a port.
            </li>
          </ul>
          <p>
            The unit tests then check the new map for you: every zone, point of interest and
            settlement inside the square, a settlement of the right kind within 0.05 of each anchor,
            and an SVG under 40 kB at thumbnail size and 150 kB at full size.
          </p>
        </>
      ),
    },
    {
      id: "reference",
      title: "Reference",
      body: (
        <DocTable caption="Map constants" head={["Constant", "Value", "Meaning"]}>
          <tr>
            <td>
              <code>MAP_PX</code>
            </td>
            <td>
              <code>{MAP_PX}</code>
            </td>
            <td>Map space per side. Screen = world × MAP_PX × scale + translate.</td>
          </tr>
          <tr>
            <td>
              <code>DEFAULT_STROKE_WIDTH</code>
            </td>
            <td>
              <code>{DEFAULT_STROKE_WIDTH}</code>
            </td>
            <td>Pen width as a fraction of map width.</td>
          </tr>
          <tr>
            <td>
              <code>DEFAULT_DANGER_RADIUS</code>
            </td>
            <td>
              <code>{DEFAULT_DANGER_RADIUS}</code>
            </td>
            <td>Danger circle radius as a fraction of map width.</td>
          </tr>
          <tr>
            <td>Grid</td>
            <td>
              <code>
                {GRID_N} × {GRID_N} · 9 sub-cells
              </code>
            </td>
            <td>Columns A–J, rows 1–10, keypad digits 1–9 (7 8 9 on top).</td>
          </tr>
          <tr>
            <td>
              <code>MAX_NODES</code>
            </td>
            <td>
              <code>{MAX_NODES.toLocaleString("en")}</code>
            </td>
            <td>Nodes per room; the oldest strokes go first past the cap.</td>
          </tr>
          <tr>
            <td>
              <code>MAX_NODES_PER_OP</code>
            </td>
            <td>
              <code>{MAX_NODES_PER_OP}</code>
            </td>
            <td>Nodes in one add / remove operation (undo and imports batch to it).</td>
          </tr>
          <tr>
            <td>
              <code>MAX_STROKE_POINTS</code>
            </td>
            <td>
              <code>{MAX_STROKE_POINTS.toLocaleString("en")}</code>
            </td>
            <td>Points in one pen stroke after simplification.</td>
          </tr>
          <tr>
            <td>
              <code>MAX_TEXT_CHARS</code>
            </td>
            <td>
              <code>{MAX_TEXT_CHARS}</code>
            </td>
            <td>Characters in a text label or a marker name.</td>
          </tr>
          <tr>
            <td>
              <code>MAX_STATE_BYTES</code>
            </td>
            <td>
              <code>{(MAX_STATE_BYTES / 1000).toLocaleString("en")} kB</code>
            </td>
            <td>Serialised room state; older strokes are dropped to stay under it.</td>
          </tr>
          <tr>
            <td>Upload cap</td>
            <td>
              <code>
                {UPLOAD_CAP_MB} MB · shared ≤ {SHARED_CAP_MB} MB
              </code>
            </td>
            <td>Custom map file size, and the size of the copy sent to the room.</td>
          </tr>
          <tr>
            <td>Terrain</td>
            <td>
              <code>
                res {TERRAIN_RES} · contour {CONTOUR_STEP}
              </code>
            </td>
            <td>Heightfield samples per side; contour interval (every fifth is an index line).</td>
          </tr>
          <tr>
            <td>Demo reset</td>
            <td>
              <code>5 min</code>
            </td>
            <td>
              The <Link href="/demo">live demo</Link> returns to its seed plan on a shared timer.
            </td>
          </tr>
        </DocTable>
      ),
    },
  ],
};
