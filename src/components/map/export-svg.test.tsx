// §7.1 component test: the serialised map SVG carries presentation attributes only and none of
// the skipped layers (cursors, pings, selection, editors).
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { exportSvg } from "@/lib/map/export-png";
import { demoSeedState } from "@/lib/map/scenario";
import { fitToBox } from "@/lib/map/viewport";
import { asClientId } from "@/lib/map/types";
import { partitionNodes, Scene } from "./Scene";
import { zoneFor } from "./lib/zone";

describe("export-svg", () => {
  it("has no class on shapes, keeps markers and drops data-export=skip layers", () => {
    const state = demoSeedState(0);
    const viewport = fitToBox({ w: 1000, h: 800 });
    const me = asClientId("wd_AAAAAAAAAAAA");
    const { container } = render(
      <svg id="map" role="application" aria-label="Tactical map">
        <Scene
          state={state}
          nodes={partitionNodes(state, null)}
          viewport={viewport}
          zone={zoneFor(state.settings)}
          widthMetres={2400}
          showGrid
          selectedNode={state.nodes[state.order[0]]}
          pings={[
            {
              id: "p1",
              at: { x: 0.5, y: 0.5 },
              by: me,
              byName: "Me",
              color: "blue",
              ts: 0,
              commander: false,
            },
          ]}
          presence={{ [me]: { client: me, callsign: "Me", seenAt: 0, cursor: { x: 0.2, y: 0.2 } } }}
          roster={state.roster}
          self={null}
          showCursors
        />
      </svg>,
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.querySelectorAll('[data-export="skip"]').length).toBeGreaterThanOrEqual(3);
    const out = exportSvg(svg);
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).not.toMatch(/<(path|circle|rect|text|use|line|polygon)[^>]*\sclass=/);
    expect(out).not.toContain('data-export="skip"');
    expect(out).toContain("#m-fob");
    expect(out).toContain("FOB DELTA");
    expect(out).toContain('viewBox="0 0 2048 2048"');
    // The world group's viewport transform is reset so the whole map renders at MAP_PX.
    expect(out).toMatch(/<g[^>]*data-export="world"(?![^>]*transform=)/);
    expect(out).toContain("--inv");
  });
});
