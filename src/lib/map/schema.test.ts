import { describe, expect, it, vi } from "vitest";
import {
  CallsignSchema,
  MapNodeSchema,
  OpSchema,
  RoomSettingsSchema,
  RoomStateSchema,
  migrateSnapshot,
  parseSnapshot,
} from "./schema";
import { applyOps } from "./reduce";
import { A, B, makeState, marker, member, op, request, stroke, text } from "./test-fixtures";
import { MAX_NODES_PER_OP, MAX_STROKE_POINTS } from "./types";

const BEL = String.fromCharCode(7);
const SOH = String.fromCharCode(1);

describe("schema", () => {
  it("accepts well-formed nodes and rejects malformed ones", () => {
    expect(MapNodeSchema.safeParse(marker("M1")).success).toBe(true);
    expect(MapNodeSchema.safeParse(stroke("S1")).success).toBe(true);
    expect(MapNodeSchema.safeParse(text("T1")).success).toBe(true);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), at: { x: 1.2, y: 0 } }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), at: { x: Number.NaN, y: 0 } }).success).toBe(
      false,
    );
    expect(MapNodeSchema.safeParse({ ...marker("M1"), label: "x".repeat(33) }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), team: "Rebels" }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), id: "has:colon" }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), layer: "squad:" }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), layer: "squad:Bravo" }).success).toBe(true);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), author: "nope" }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...stroke("S1"), points: [{ x: 0, y: 0 }] }).success).toBe(
      false,
    );
    expect(
      MapNodeSchema.safeParse({
        ...stroke("S1"),
        points: Array(MAX_STROKE_POINTS + 1).fill({ x: 0, y: 0 }),
      }).success,
    ).toBe(false);
    expect(MapNodeSchema.safeParse({ ...stroke("S1"), width: 0 }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...stroke("S1"), width: 0.06 }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...text("T1"), text: "a\nb\nc" }).success).toBe(true);
    expect(MapNodeSchema.safeParse({ ...text("T1"), text: "a\nb\nc\nd" }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...text("T1"), text: "x".repeat(81) }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...text("T1"), text: `a${BEL}b` }).success).toBe(false);
    expect(MapNodeSchema.safeParse({ ...marker("M1"), t: "banner" }).success).toBe(false);
  });
  it("ops: caps and discriminators", () => {
    expect(OpSchema.safeParse(op({ t: "node.add", nodes: [marker("M1")] }, 2, A)).success).toBe(
      true,
    );
    expect(OpSchema.safeParse(op({ t: "node.add", nodes: [] }, 2, A)).success).toBe(false);
    expect(
      OpSchema.safeParse(
        op(
          {
            t: "node.add",
            nodes: Array.from({ length: MAX_NODES_PER_OP + 1 }, (_, i) => marker(`M${i}`)),
          },
          2,
          A,
        ),
      ).success,
    ).toBe(false);
    expect(
      OpSchema.safeParse(
        op(
          {
            t: "node.remove",
            ids: Array.from({ length: MAX_NODES_PER_OP + 1 }, (_, i) => `M${i}`),
          },
          2,
          A,
        ),
      ).success,
    ).toBe(false);
    expect(
      OpSchema.safeParse(op({ t: "node.update", id: "M1", patch: { label: "x".repeat(40) } }, 2, A))
        .success,
    ).toBe(false);
    expect(
      OpSchema.safeParse(
        op({ t: "node.update", id: "M1", patch: { label: "ok", bogus: 1 } as never }, 2, A),
      ).success,
    ).toBe(true);
    expect(
      OpSchema.safeParse(op({ t: "layer.clear", layer: "team", types: null }, 2, A)).success,
    ).toBe(true);
    expect(
      OpSchema.safeParse(
        op({ t: "request.add", request: request("R1", { note: "n".repeat(61) }) }, 2, A),
      ).success,
    ).toBe(false);
    expect(OpSchema.safeParse(op({ t: "roster.upsert", member: member(B) }, 2, B)).success).toBe(
      true,
    );
    expect(
      OpSchema.safeParse(
        op({ t: "roster.update", id: B, patch: { role: "emperor" } as never }, 2, B),
      ).success,
    ).toBe(false);
    expect(
      OpSchema.safeParse(op({ t: "settings.update", patch: { map: "mars" } as never }, 2, B))
        .success,
    ).toBe(false);
    expect(
      OpSchema.safeParse({ ...op({ t: "node.remove", ids: ["M1"] }, 2, A), t: "node.explode" })
        .success,
    ).toBe(false);
    expect(
      OpSchema.safeParse({ ...op({ t: "node.remove", ids: ["M1"] }, 2, A), actor: "someone" })
        .success,
    ).toBe(false);
  });
  it("settings: squads unique, sized and capped", () => {
    const base = makeState().settings;
    expect(RoomSettingsSchema.safeParse(base).success).toBe(true);
    expect(RoomSettingsSchema.safeParse({ ...base, squads: ["Alpha", "Alpha"] }).success).toBe(
      false,
    );
    expect(RoomSettingsSchema.safeParse({ ...base, squads: ["A"] }).success).toBe(false);
    expect(
      RoomSettingsSchema.safeParse({
        ...base,
        squads: Array.from({ length: 9 }, (_, i) => `Squad${i}`),
      }).success,
    ).toBe(false);
    expect(
      RoomSettingsSchema.safeParse({
        ...base,
        mapSource: { kind: "upload", hash: "zz", w: 1024, h: 1024, mime: "image/jpeg", name: "x" },
      }).success,
    ).toBe(false);
    expect(
      RoomSettingsSchema.safeParse({
        ...base,
        mapSource: {
          kind: "upload",
          hash: "a".repeat(64),
          w: 1024,
          h: 1024,
          mime: "image/jpeg",
          name: "x",
        },
      }).success,
    ).toBe(true);
  });
  it("state: code accepts codes and DEMO, normalises input", () => {
    const s = applyOps(makeState(), [
      op({ t: "node.add", nodes: [marker("M1")] }, 2, A),
      op({ t: "roster.upsert", member: member(A) }, 3, A),
    ]);
    const r = RoomStateSchema.safeParse(s);
    expect(r.success).toBe(true);
    expect(RoomStateSchema.parse({ ...s, code: "DEMO" }).code).toBe("DEMO");
    expect(RoomStateSchema.parse({ ...s, code: "abc234" }).code).toBe("ABC234");
    expect(RoomStateSchema.safeParse({ ...s, code: "SIM" }).success).toBe(false);
    expect(RoomStateSchema.safeParse({ ...s, v: 2 }).success).toBe(false);
    expect(RoomStateSchema.safeParse({ ...s, roster: { bogus: member(A) } }).success).toBe(false);
  });
  it("parseSnapshot never throws and logs once in dev; migrateSnapshot is v1 only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = makeState();
    expect(parseSnapshot({ v: 1, state: s, savedAt: 5 })).toEqual({ v: 1, state: s, savedAt: 5 });
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("junk")).toBeNull();
    expect(parseSnapshot({ v: 1, state: { ...s, seq: -1 }, savedAt: 5 })).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(parseSnapshot(circular)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(migrateSnapshot({ v: 0, state: s })).toBeNull();
    expect(migrateSnapshot(undefined)).toBeNull();
    expect(migrateSnapshot({ v: 1, state: s, savedAt: 1 })?.savedAt).toBe(1);
    warn.mockRestore();
  });
  it("callsign schema trims and bounds", () => {
    expect(CallsignSchema.parse("  Reaper ")).toBe("Reaper");
    expect(CallsignSchema.safeParse("a").success).toBe(false);
    expect(CallsignSchema.safeParse("x".repeat(25)).success).toBe(false);
    expect(CallsignSchema.safeParse(`bad${SOH}name`).success).toBe(false);
  });
});
