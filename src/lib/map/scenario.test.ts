import { describe, expect, it } from "vitest";
import { RoomStateSchema } from "./schema";
import {
  DEMO_BOT_IDS,
  DEMO_BOTS,
  DEMO_EPOCH_MS,
  DEMO_TIMELINE,
  HERO_TIMELINE,
  SEED_IDS,
  TIMELINE_IDS,
  botPresence,
  demoRelayRoom,
  demoSeedState,
  epochIndex,
  epochStart,
  heroFinalState,
  heroOps,
  heroStartState,
  isDemoBot,
  stateAt,
  timelineOps,
} from "./scenario";
import { CLIENT_ID_PATTERN } from "./ids";
import type { MapNode, RoomState } from "./types";

const everyPoint = (s: RoomState) => {
  const pts: { x: number; y: number }[] = [];
  for (const n of Object.values(s.nodes) as MapNode[]) {
    if (n.t === "stroke") pts.push(...n.points);
    else if (n.t === "shape" || n.t === "measure") pts.push(n.a, n.b);
    else pts.push(n.at);
  }
  for (const r of Object.values(s.requests)) if (r.at) pts.push(r.at);
  return pts;
};

describe("scenario", () => {
  it("epoch maths", () => {
    expect(epochStart(DEMO_EPOCH_MS * 3 + 1234)).toBe(DEMO_EPOCH_MS * 3);
    expect(epochIndex(DEMO_EPOCH_MS * 3 + 1234)).toBe(3);
    expect(demoRelayRoom(DEMO_EPOCH_MS * 3 + 1234)).toBe("DEMO-3");
  });
  it("bots have valid ids and the expected roles", () => {
    for (const id of Object.values(DEMO_BOT_IDS)) expect(id).toMatch(CLIENT_ID_PATTERN);
    expect(DEMO_BOTS.map((m) => [m.callsign, m.role, m.focus, m.ink])).toEqual([
      ["Ossian", "commander", "infantry", "yellow"],
      ["Krieger", "member", "pilot", "green"],
      ["Boston", "member", "medic", "blue"],
      ["Rook", "member", "recon", "red"],
    ]);
    expect(isDemoBot(DEMO_BOT_IDS.rook)).toBe(true);
    expect(isDemoBot("wd_AAAAAAAAAAAA")).toBe(false);
  });
  it("seed state validates, is deterministic per epoch and holds the plan", () => {
    const s = demoSeedState(7);
    expect(RoomStateSchema.safeParse(s).success).toBe(true);
    expect(demoSeedState(7)).toBe(s);
    expect(s.code).toBe("DEMO");
    expect(s.createdAt).toBe(7 * DEMO_EPOCH_MS);
    expect(s.settings).toMatchObject({
      team: "Lonestar",
      map: "zestafona",
      controlZone: "default",
      drawAccess: "everyone",
      squadMode: false,
    });
    expect(Object.keys(s.nodes).length).toBe(11);
    expect(Object.keys(s.requests).length).toBe(3);
    expect(Object.keys(s.roster).length).toBe(4);
    expect(s.roster[DEMO_BOT_IDS.ossian].role).toBe("commander");
    expect(s.requests[SEED_IDS.reqAmmo]).toMatchObject({
      status: "claimed",
      claimedBy: DEMO_BOT_IDS.krieger,
      etaSec: 60,
    });
    expect(s.requests[SEED_IDS.reqFuel].createdAt).toBe(7 * DEMO_EPOCH_MS - 45_000);
    for (const p of everyPoint(s)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    const other = demoSeedState(8);
    expect(other.nodes[SEED_IDS.fob].createdAt).toBe(8 * DEMO_EPOCH_MS + 1);
    expect(other.revs[SEED_IDS.fob]).toEqual(s.revs[SEED_IDS.fob]);
  });
  it("timeline is sorted, inside the epoch, and stamps deterministically", () => {
    for (let i = 1; i < DEMO_TIMELINE.length; i++)
      expect(DEMO_TIMELINE[i].at).toBeGreaterThanOrEqual(DEMO_TIMELINE[i - 1].at);
    expect(DEMO_TIMELINE[DEMO_TIMELINE.length - 1].at).toBeLessThan(DEMO_EPOCH_MS);
    expect(DEMO_TIMELINE.filter((i) => i.kind === "ping").length).toBe(2);
    const ops = timelineOps(4);
    expect(ops).toEqual(timelineOps(4));
    expect(ops.length).toBe(DEMO_TIMELINE.filter((i) => i.kind === "op").length);
    expect(ops[0].seq).toBe(1000);
    expect(ops[0].ts).toBe(4 * DEMO_EPOCH_MS + 8_000);
    expect(ops[0]).toMatchObject({
      t: "request.update",
      id: SEED_IDS.reqFuel,
      patch: { status: "claimed", claimedAt: 4 * DEMO_EPOCH_MS + 8_000 },
    });
    // Update / remove ops carry the entity id as `id` (OpMeta & OpBody share the key); adds get fresh ids.
    const addIds = ops.filter((o) => o.t === "node.add" || o.t === "request.add").map((o) => o.id);
    expect(new Set(addIds).size).toBe(addIds.length);
    expect(addIds.every((id) => /^[A-HJ-NP-Z2-9]{16}$/.test(id))).toBe(true);
    const firstAdd = (n: number) => timelineOps(n).find((o) => o.t === "node.add")!.id;
    expect(firstAdd(5)).not.toBe(firstAdd(4));
  });
  it("stateAt is deterministic and applies only the due ops", () => {
    const base = 12 * DEMO_EPOCH_MS;
    const at0 = stateAt(base);
    expect(at0.state).toEqual(demoSeedState(12));
    expect(at0.nextIndex).toBe(0);
    const at9 = stateAt(base + 9_000);
    expect(at9.state.requests[SEED_IDS.reqFuel].status).toBe("claimed");
    expect(at9.nextIndex).toBe(1);
    expect(stateAt(base + 9_000)).toEqual(at9);
    const at46 = stateAt(base + 46_000);
    expect(at46.state.requests[SEED_IDS.reqFuel].status).toBe("delivered");
    expect(at46.state.nodes[TIMELINE_IDS.troops]).toBeDefined();
    const at80 = stateAt(base + 80_000).state;
    expect((at80.nodes[TIMELINE_IDS.troops] as { at: { x: number } }).at.x).toBe(0.66);
    const end = stateAt(base + DEMO_EPOCH_MS - 1);
    expect(end.nextIndex).toBe(DEMO_TIMELINE.length);
    expect(end.state.requests[TIMELINE_IDS.ammo].status).toBe("delivered");
    expect(RoomStateSchema.safeParse(end.state).success).toBe(true);
  });
  it("botPresence", () => {
    const p = botPresence(123);
    expect(p.length).toBe(4);
    expect(p[0]).toEqual({
      client: DEMO_BOT_IDS.ossian,
      callsign: "Ossian",
      seenAt: 123,
      cursor: null,
    });
  });
  it("hero timeline loops the seed plan then 8 items", () => {
    expect(HERO_TIMELINE.length).toBe(11 + 8);
    for (let i = 1; i < HERO_TIMELINE.length; i++)
      expect(HERO_TIMELINE[i].at).toBeGreaterThan(HERO_TIMELINE[i - 1].at);
    expect(HERO_TIMELINE[10].at).toBeLessThanOrEqual(5_000);
    const final = heroFinalState();
    expect(final).toEqual(heroFinalState());
    expect(Object.keys(final.nodes).length).toBe(11 + 5);
    expect(RoomStateSchema.safeParse(final).success).toBe(true);
    expect(heroOps().length).toBe(HERO_TIMELINE.filter((i) => i.kind === "op").length);
    const start = heroStartState();
    expect(Object.keys(start.nodes).length).toBe(0);
    expect(Object.keys(start.roster).length).toBe(4);
  });
});
