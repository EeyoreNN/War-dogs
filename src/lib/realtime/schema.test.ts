import { describe, expect, it } from "vitest";
import { WIRE_LIMITS, parseWire, validateWire, wireLimit } from "./schema";
import { applyOps } from "../map/reduce";
import { A, makeState, marker, op, stroke } from "../map/test-fixtures";
import type { RoomState } from "../map/types";

const identity = { client: A, callsign: "Alpha", focus: null, ink: "blue" };

function bigState(strokes: number): RoomState {
  const pts = Array.from({ length: 400 }, (_, i) => ({
    x: (i % 100) / 100,
    y: Math.floor(i / 100) / 10,
  }));
  let s = makeState();
  for (let i = 0; i < strokes; i += 100) {
    s = applyOps(s, [
      op(
        {
          t: "node.add",
          nodes: Array.from({ length: Math.min(100, strokes - i) }, (_, j) =>
            stroke(`S${i + j}`, { points: pts }),
          ),
        },
        2 + i,
        A,
      ),
    ]);
  }
  return s;
}

describe("wire schema", () => {
  it("limits table", () => {
    expect(wireLimit("op")).toBe(WIRE_LIMITS.default);
    expect(wireLimit("hello")).toBe(2_097_152);
    expect(wireLimit("map.chunk")).toBe(262_144);
    expect(wireLimit("sync.ops")).toBe(2_097_152);
  });
  it("parses valid frames and rejects bad ones", () => {
    const o = op({ t: "node.add", nodes: [marker("M1")] }, 2, A);
    expect(parseWire(JSON.stringify({ k: "op", room: "ABC234", op: o }))).toMatchObject({
      k: "op",
      room: "ABC234",
    });
    expect(
      parseWire(JSON.stringify({ k: "hello", room: "ABC234", identity, seq: 0, snapshot: null }))
        ?.k,
    ).toBe("hello");
    expect(parseWire(JSON.stringify({ k: "sync.request", room: "ABC234", since: 4 }))?.k).toBe(
      "sync.request",
    );
    expect(
      parseWire(
        JSON.stringify({
          k: "presence",
          room: "R",
          members: [{ client: A, callsign: "a", seenAt: 1, cursor: null }],
        }),
      )?.k,
    ).toBe("presence");
    expect(parseWire(JSON.stringify({ k: "bye", room: "R", client: A }))?.k).toBe("bye");
    expect(
      parseWire(JSON.stringify({ k: "cursor", room: "R", client: A, at: { x: 0.1, y: 0.2 } }))?.k,
    ).toBe("cursor");
    expect(
      parseWire(
        JSON.stringify({
          k: "ping",
          room: "R",
          ping: {
            id: "PING2222222222AA",
            at: { x: 0, y: 0 },
            by: A,
            byName: "a",
            color: "red",
            ts: 1,
            commander: false,
          },
        }),
      )?.k,
    ).toBe("ping");
    expect(
      parseWire(JSON.stringify({ k: "map.request", room: "R", hash: "a".repeat(64) }))?.k,
    ).toBe("map.request");
    expect(
      parseWire(
        JSON.stringify({
          k: "map.chunk",
          room: "R",
          hash: "a".repeat(64),
          i: 0,
          n: 2,
          mime: "image/jpeg",
          w: 1024,
          h: 1024,
          data: "AAAA",
        }),
      )?.k,
    ).toBe("map.chunk");
    expect(
      parseWire(JSON.stringify({ k: "error", room: "R", code: "kicked", message: "bye" }))?.k,
    ).toBe("error");
    expect(parseWire("not json")).toBeNull();
    expect(parseWire(JSON.stringify({ k: "nope", room: "R" }))).toBeNull();
    expect(parseWire(JSON.stringify({ k: "op", room: "R", op: { ...o, actor: "x" } }))).toBeNull();
    expect(
      parseWire(JSON.stringify({ k: "cursor", room: "R", client: A, at: { x: 2, y: 0 } })),
    ).toBeNull();
    expect(
      parseWire(JSON.stringify({ k: "error", room: "R", code: "meh", message: "" })),
    ).toBeNull();
    expect(validateWire({ k: "bye", room: "R", client: A })?.k).toBe("bye");
    expect(validateWire({ k: "bye" })).toBeNull();
  });
  it("per-kind oversize: a 100 kB op fails, a 1 MB snapshot passes, a 3 MB one fails", () => {
    const o = op({ t: "node.add", nodes: [marker("M1")] }, 2, A);
    const opFrame = JSON.stringify({ k: "op", room: "ABC234", op: o });
    expect(parseWire(opFrame, 100_000)).toBeNull();
    expect(parseWire(opFrame, 60_000)).not.toBeNull();
    const snap = JSON.stringify({ k: "sync.snapshot", room: "ABC234", state: bigState(120) });
    expect(snap.length).toBeGreaterThan(900_000);
    expect(snap.length).toBeLessThan(2_000_000);
    expect(parseWire(snap)).not.toBeNull();
    expect(parseWire(snap, 3_000_000)).toBeNull();
    const helloFrame = JSON.stringify({
      k: "hello",
      room: "ABC234",
      identity,
      seq: 0,
      snapshot: bigState(120),
    });
    expect(parseWire(helloFrame)).not.toBeNull();
  });
});
