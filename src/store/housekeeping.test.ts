import { describe, expect, it } from "vitest";
import { applyOps } from "@/lib/map/reduce";
import { A, B, C, makeState, member, op, request, stroke } from "@/lib/map/test-fixtures";
import { MAX_NODES, MAX_NODES_PER_OP, ONLINE_TTL_MS, type Presence } from "@/lib/map/types";
import { DRAW_REQUEST_TTL_MS, housekeepingOps } from "./housekeeping";

const NOW = 10_000_000;
const pres = (client: string, seenAt: number): Presence => ({
  client: client as Presence["client"],
  callsign: "",
  seenAt,
  cursor: null,
});

describe("housekeeping", () => {
  it("prunes delivered requests, caps strokes, promotes a successor, expires draw requests, flips stale members", () => {
    const strokes = Array.from({ length: MAX_NODES + 3 }, (_, i) =>
      stroke(`S${i}`, { createdAt: i }),
    );
    let state = makeState();
    for (let i = 0; i < strokes.length; i += MAX_NODES_PER_OP) {
      state = {
        ...state,
        nodes: {
          ...state.nodes,
          ...Object.fromEntries(strokes.slice(i, i + MAX_NODES_PER_OP).map((n) => [n.id, n])),
        },
      };
    }
    state = { ...state, order: Object.keys(state.nodes) };
    state = applyOps(state, [
      op(
        {
          t: "request.add",
          request: request("OLD", { status: "delivered", deliveredAt: NOW - 31 * 60_000 }),
        },
        2,
        A,
      ),
      op(
        {
          t: "request.add",
          request: request("NEW", { status: "delivered", deliveredAt: NOW - 5 * 60_000 }),
        },
        3,
        A,
      ),
      op({ t: "roster.upsert", member: member(A, { role: "commander", joinedAt: 1 }) }, 4, A),
      op(
        {
          t: "roster.upsert",
          member: member(B, { role: "member", joinedAt: 2, drawRequested: true }),
        },
        5,
        B,
      ),
      op(
        { t: "roster.upsert", member: member(C, { role: "member", joinedAt: 3, online: true }) },
        6,
        C,
      ),
    ]);
    const presence = {
      [A]: pres(A, NOW - ONLINE_TTL_MS - 1),
      [B]: pres(B, NOW),
      [C]: pres(C, NOW - ONLINE_TTL_MS - 5),
    };
    const ops = housekeepingOps({
      state,
      presence,
      now: NOW,
      drawRequestedAt: { [B]: NOW - DRAW_REQUEST_TTL_MS },
    });
    expect(ops).toContainEqual({ t: "request.remove", id: "OLD" });
    expect(ops).not.toContainEqual({ t: "request.remove", id: "NEW" });
    expect(ops).toContainEqual({ t: "node.remove", ids: ["S0", "S1", "S2"] });
    expect(ops).toContainEqual({ t: "roster.update", id: B, patch: { role: "commander" } });
    expect(ops).toContainEqual({ t: "roster.update", id: A, patch: { role: "member" } });
    expect(ops).toContainEqual({ t: "roster.update", id: B, patch: { drawRequested: false } });
    expect(ops).toContainEqual({ t: "roster.update", id: A, patch: { online: false } });
    expect(ops).toContainEqual({ t: "roster.update", id: C, patch: { online: false } });
    // A fresh draw request and an online commander produce nothing.
    const quiet = housekeepingOps({
      state: { ...state, requests: {}, nodes: {}, order: [] },
      presence: { [A]: pres(A, NOW), [B]: pres(B, NOW), [C]: pres(C, NOW) },
      now: NOW,
      drawRequestedAt: { [B]: NOW - 1000 },
    });
    expect(quiet).toEqual([]);
  });
});
