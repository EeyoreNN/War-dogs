import { describe, expect, it } from "vitest";
import { applyOps } from "@/lib/map/reduce";
import {
  A,
  B,
  C,
  baseSettings,
  makeState,
  marker,
  member,
  op,
  request,
} from "@/lib/map/test-fixtures";
import type { OpBody, RoomState, RosterMember } from "@/lib/map/types";
import { canDispatch } from "./permissions";

const state = (over: Partial<RoomState> = {}): RoomState => ({
  ...applyOps(makeState(), [
    op(
      {
        t: "node.add",
        nodes: [
          marker("T1", { layer: "team" }),
          marker("S1", { layer: "squad:Alpha" }),
          marker("S2", { layer: "squad:Bravo" }),
        ],
      },
      2,
      A,
    ),
    op({ t: "request.add", request: request("R1", { by: B, byName: "Bravo" }) }, 3, B),
    op(
      {
        t: "request.add",
        request: request("R2", { by: C, byName: "Charlie", status: "claimed", claimedBy: B }),
      },
      4,
      C,
    ),
  ]),
  ...over,
});

const commander = member(A, { role: "commander" });
const co = member(A, { role: "co-commander" });
const alpha = member(A, { role: "member", squad: "Alpha", canDraw: true });
const locked = member(A, { role: "member", canDraw: false });
const ok = (body: OpBody, me: RosterMember | null, s = state()) =>
  canDispatch(body, me, s, A, "room");

describe("permission table", () => {
  it("drawing follows canDraw and the editable layer", () => {
    const s = state();
    expect(ok({ t: "node.add", nodes: [marker("N", { layer: "team" })] }, alpha, s)).toBe(true);
    expect(
      ok({ t: "node.add", nodes: [marker("N", { layer: "team" })] }, locked, {
        ...s,
        settings: baseSettings({ drawAccess: "request" }),
      }),
    ).toBe(false);
    expect(
      ok(
        { t: "node.add", nodes: [marker("N", { layer: "team" })] },
        { ...locked, canDraw: true },
        { ...s, settings: baseSettings({ drawAccess: "request" }) },
      ),
    ).toBe(true);
    expect(
      ok({ t: "node.add", nodes: [marker("N", { layer: "team" })] }, co, {
        ...s,
        settings: baseSettings({ drawAccess: "request" }),
      }),
    ).toBe(true);
    expect(ok({ t: "node.add", nodes: [marker("N")] }, null, s)).toBe(false);
    const squads = {
      ...s,
      settings: baseSettings({ squadMode: true, squads: ["Alpha", "Bravo"] }),
    };
    expect(
      ok({ t: "node.add", nodes: [marker("N", { layer: "squad:Alpha" })] }, alpha, squads),
    ).toBe(true);
    expect(ok({ t: "node.add", nodes: [marker("N", { layer: "team" })] }, alpha, squads)).toBe(
      false,
    );
    expect(ok({ t: "node.update", id: "S1", patch: { label: "x" } }, alpha, squads)).toBe(true);
    expect(ok({ t: "node.update", id: "S2", patch: { label: "x" } }, alpha, squads)).toBe(false);
    expect(ok({ t: "node.update", id: "S1", patch: { layer: "team" } }, alpha, squads)).toBe(false);
    expect(ok({ t: "node.update", id: "NOPE", patch: { label: "x" } }, commander, squads)).toBe(
      false,
    );
    expect(ok({ t: "node.remove", ids: ["S1"] }, alpha, squads)).toBe(true);
    expect(ok({ t: "node.remove", ids: ["S1", "T1"] }, alpha, squads)).toBe(false);
    expect(ok({ t: "node.remove", ids: ["S1", "T1"] }, commander, squads)).toBe(true);
    expect(ok({ t: "layer.clear", layer: "squad:Alpha", types: null }, alpha, squads)).toBe(true);
    expect(ok({ t: "layer.clear", layer: "team", types: null }, alpha, squads)).toBe(false);
    expect(ok({ t: "layer.clear", layer: "team", types: null }, alpha, s)).toBe(false);
    expect(ok({ t: "layer.clear", layer: "team", types: ["stroke"] }, co, s)).toBe(true);
  });
  it("requests: anyone adds their own; claim when open; edit for requester, claimer or command", () => {
    expect(ok({ t: "request.add", request: request("N", { by: A }) }, locked)).toBe(true);
    expect(ok({ t: "request.add", request: request("N", { by: B }) }, alpha)).toBe(false);
    expect(
      ok({ t: "request.update", id: "R1", patch: { status: "claimed", claimedBy: A } }, alpha),
    ).toBe(true);
    expect(ok({ t: "request.update", id: "R1", patch: { note: "mine now" } }, alpha)).toBe(false);
    expect(ok({ t: "request.update", id: "R1", patch: { note: "ok" } }, co)).toBe(true);
    expect(ok({ t: "request.update", id: "R2", patch: { status: "delivered" } }, alpha)).toBe(
      false,
    );
    expect(ok({ t: "request.update", id: "R2", patch: { status: "delivered" } }, co)).toBe(true);
    expect(
      ok(
        { t: "request.update", id: "R2", patch: { status: "delivered" } },
        alpha,
        state({ requests: { R2: request("R2", { by: C, status: "claimed", claimedBy: A }) } }),
      ),
    ).toBe(true);
    expect(ok({ t: "request.update", id: "ZZ", patch: { note: "x" } }, commander)).toBe(false);
    expect(ok({ t: "request.remove", id: "R1" }, alpha)).toBe(false);
    expect(ok({ t: "request.remove", id: "R1" }, co)).toBe(true);
    expect(canDispatch({ t: "request.remove", id: "R1" }, member(B), state(), B, "room")).toBe(
      true,
    );
  });
  it("roster: self keys for everyone, others for command, commander hand-off only by the commander", () => {
    expect(
      ok(
        {
          t: "roster.update",
          id: A,
          patch: {
            focus: "medic",
            online: true,
            drawRequested: true,
            ink: "red",
            callsign: "x",
            squad: "Alpha",
          },
        },
        locked,
      ),
    ).toBe(true);
    expect(ok({ t: "roster.update", id: A, patch: { canDraw: true } }, locked)).toBe(false);
    expect(ok({ t: "roster.update", id: A, patch: { role: "commander" } }, alpha)).toBe(false);
    expect(ok({ t: "roster.update", id: A, patch: { role: "member" } }, commander)).toBe(true);
    expect(ok({ t: "roster.update", id: A, patch: { role: "member" } }, co)).toBe(false);
    expect(ok({ t: "roster.update", id: B, patch: { canDraw: true } }, alpha)).toBe(false);
    expect(
      ok({ t: "roster.update", id: B, patch: { canDraw: true, drawRequested: false } }, co),
    ).toBe(true);
    expect(ok({ t: "roster.update", id: B, patch: { role: "co-commander" } }, co)).toBe(true);
    expect(ok({ t: "roster.update", id: B, patch: { role: "commander" } }, co)).toBe(false);
    expect(ok({ t: "roster.update", id: B, patch: { role: "commander" } }, commander)).toBe(true);
    expect(ok({ t: "roster.update", id: B, patch: { callsign: "hijack" } }, commander)).toBe(false);
    expect(ok({ t: "roster.remove", id: B }, alpha)).toBe(false);
    expect(ok({ t: "roster.remove", id: B }, co)).toBe(true);
    expect(ok({ t: "roster.remove", id: A }, commander)).toBe(false);
    expect(ok({ t: "roster.upsert", member: member(A) }, null)).toBe(true);
    expect(ok({ t: "roster.upsert", member: member(B) }, alpha)).toBe(false);
    expect(ok({ t: "roster.upsert", member: member(B) }, commander)).toBe(true);
  });
  it("settings: command only", () => {
    expect(ok({ t: "settings.update", patch: { map: "ozeti" } }, alpha)).toBe(false);
    expect(ok({ t: "settings.update", patch: { map: "ozeti" } }, co)).toBe(true);
    expect(ok({ t: "settings.update", patch: { map: "ozeti" } }, null)).toBe(false);
  });
});
