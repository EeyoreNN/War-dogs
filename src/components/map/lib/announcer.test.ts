import { describe, expect, it } from "vitest";
import { demoSeedState, timelineOps } from "@/lib/map/scenario";
import { applyOp } from "@/lib/map/reduce";
import { asClientId } from "@/lib/map/types";
import { ANNOUNCE_CAP, diffAnnouncements } from "./announcer";

describe("diffAnnouncements", () => {
  const seed = demoSeedState(3);
  const ops = timelineOps(3);
  const me = asClientId("wd_VISITOR22222");

  it("announces the demo timeline like a squadmate would say it", () => {
    let s = seed;
    const said: string[] = [];
    for (const op of ops) {
      const next = applyOp(s, op);
      said.push(...diffAnnouncements(s, next, me));
      s = next;
    }
    expect(said).toContain("Fuel claimed by Krieger, ETA 1 minute");
    expect(said).toContain("Rook placed Enemy troops at H4");
    expect(said).toContain("Fuel delivered");
    expect(said).toContain("Medical requested by Boston at F5");
    expect(said).toContain("Medical claimed by Krieger, ETA 30 seconds");
  });

  it("stays quiet for identical states and my own markers", () => {
    expect(diffAnnouncements(seed, seed, me)).toEqual([]);
    const mine = applyOp(seed, {
      ...ops[1],
      actor: me,
      seq: 5000,
      id: "MINEOP",
      nodes: [
        {
          ...(ops[1].t === "node.add" ? ops[1].nodes[0] : (null as never)),
          id: "MINE",
          author: me,
        },
      ],
    } as never);
    expect(diffAnnouncements(seed, mine, me)).toEqual([]);
  });

  it("collapses floods to a count", () => {
    const empty = { ...seed, roster: {}, requests: {} };
    const changes =
      Object.keys(seed.roster).length +
      Object.values(seed.requests).filter((r) => r.status === "open").length;
    expect(changes).toBeGreaterThan(ANNOUNCE_CAP);
    expect(diffAnnouncements(empty, seed, me)).toEqual([`${changes} changes on the map`]);
  });
});
