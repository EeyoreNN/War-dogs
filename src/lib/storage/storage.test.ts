import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { applyOps } from "../map/reduce";
import { A, B, makeState, marker, op, stroke } from "../map/test-fixtures";
import {
  MAX_NODES,
  MAX_STATE_BYTES,
  MAX_TOMBSTONES,
  type RecentRoom,
  type RoomState,
} from "../map/types";
import { generateCallsign, loadIdentity, resetIdentityCache, saveIdentity } from "./identity";
import { getMap, putMap, resetIdb, deleteMap } from "./idb";
import { KEY_IDENTITY, KEY_PREFS, KEY_ROOMS, roomBadKey, roomKey } from "./keys";
import { onStorageError, readJson, resetStorageFailure, writeLocal } from "./local";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./prefs";
import { loadRelayOverride } from "./relay";
import {
  compactState,
  dropOldestStrokes,
  loadQuarantined,
  loadRoom,
  loadRoomResult,
  saveRoom,
} from "./room";
import { forgetRoom, listRecentRooms, touchRecentRoom } from "./rooms";

const recent = (code: string, updatedAt: number): RecentRoom => ({
  code,
  team: "Lonestar",
  map: "zestafona",
  controlZone: "default",
  role: "member",
  updatedAt,
});

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    resetIdentityCache();
    resetStorageFailure();
    resetIdb();
  });

  it("identity: minted once, guarded, callsign generator", () => {
    const a = loadIdentity();
    expect(a.client).toMatch(/^wd_[A-HJ-NP-Z2-9]{12}$/);
    expect(a.callsign).toBe("");
    resetIdentityCache();
    expect(loadIdentity().client).toBe(a.client);
    saveIdentity({ ...a, callsign: "Reaper", focus: "medic", ink: "red" });
    resetIdentityCache();
    expect(loadIdentity()).toEqual({
      client: a.client,
      callsign: "Reaper",
      focus: "medic",
      ink: "red",
    });
    localStorage.setItem(
      KEY_IDENTITY,
      JSON.stringify({ v: 1, client: a.client, callsign: 5, focus: "wizard", ink: "puce" }),
    );
    resetIdentityCache();
    expect(loadIdentity()).toEqual({ client: a.client, callsign: "", focus: null, ink: "blue" });
    localStorage.setItem(KEY_IDENTITY, "{bad json");
    resetIdentityCache();
    expect(loadIdentity().client).not.toBe(a.client);
    expect(generateCallsign()).toMatch(/^Operator [A-HJ-NP-Z2-9]{4}$/);
  });

  it("prefs round-trip with defaults for unknown values", () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    const next = savePrefs({ grid: false, lastTool: "pen" });
    expect(next.grid).toBe(false);
    expect(loadPrefs().lastTool).toBe("pen");
    localStorage.setItem(KEY_PREFS, JSON.stringify({ v: 1, grid: "yes", lastTool: "laser" }));
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("room snapshots round-trip; corrupt JSON is quarantined", () => {
    const s = applyOps(makeState(A, "ABC234"), [
      op({ t: "node.add", nodes: [marker("M1")] }, 2, A),
    ]);
    const r = saveRoom("ABC234", { v: 1, state: s, savedAt: 5 });
    expect(r.ok).toBe(true);
    expect(r.trimmed).toBe(0);
    expect(loadRoom("ABC234")).toEqual({ v: 1, state: s, savedAt: 5 });
    expect(loadRoomResult("NOPE22").status).toBe("missing");
    localStorage.setItem(roomKey("ABC234"), "{corrupt");
    const res = loadRoomResult("ABC234");
    expect(res.status).toBe("corrupt");
    expect(res.snapshot).toBeNull();
    expect(loadQuarantined("ABC234")).toBe("{corrupt");
    expect(localStorage.getItem(roomKey("ABC234"))).toBeNull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(
      roomKey("ABC234"),
      JSON.stringify({ v: 1, state: { nope: 1 }, savedAt: 1 }),
    );
    expect(loadRoomResult("ABC234").status).toBe("corrupt");
    warn.mockRestore();
    // A snapshot stored under the wrong code is not trusted either.
    saveRoom("ZZZ234", { v: 1, state: s, savedAt: 5 });
    expect(loadRoomResult("ZZZ234").status).toBe("corrupt");
  });

  it("compactState keeps the newest 2,000 tombstones by rev and caps nodes", () => {
    let s: RoomState = makeState();
    const tombstones: RoomState["tombstones"] = {};
    for (let i = 0; i < MAX_TOMBSTONES + 50; i++)
      tombstones[`T${i}`] = { seq: i + 1, actor: i % 2 ? A : B };
    s = { ...s, tombstones };
    const c = compactState(s);
    expect(Object.keys(c.tombstones).length).toBe(MAX_TOMBSTONES);
    expect(c.tombstones.T0).toBeUndefined();
    expect(c.tombstones.T49).toBeUndefined();
    expect(c.tombstones.T50).toBeDefined();
    expect(c.tombstones[`T${MAX_TOMBSTONES + 49}`]).toBeDefined();
    const nodes: RoomState["nodes"] = {};
    for (let i = 0; i < MAX_NODES + 3; i++) nodes[`S${i}`] = stroke(`S${i}`, { createdAt: i });
    const big = compactState({ ...makeState(), nodes, order: Object.keys(nodes) });
    expect(Object.keys(big.nodes).length).toBe(MAX_NODES);
    expect(big.nodes.S0).toBeUndefined();
    expect(big.order.length).toBe(MAX_NODES);
    const untouched = makeState();
    expect(compactState(untouched)).toBe(untouched);
    expect(dropOldestStrokes(untouched, 5)).toBe(untouched);
  });

  it("saveRoom trims the oldest strokes to fit MAX_STATE_BYTES and reports it", () => {
    const pts = Array.from({ length: 1500 }, (_, i) => ({
      x: (i % 100) / 100,
      y: Math.floor(i / 100) / 20,
    }));
    let s = makeState(A, "ABC234");
    for (let i = 0; i < 40; i++) {
      s = applyOps(s, [
        op({ t: "node.add", nodes: [stroke(`S${i}`, { points: pts, createdAt: i })] }, 2 + i, A),
      ]);
    }
    s = applyOps(s, [op({ t: "node.add", nodes: [marker("M1", { createdAt: 0 })] }, 100, A)]);
    expect(JSON.stringify(s).length).toBeGreaterThan(MAX_STATE_BYTES);
    const r = saveRoom("ABC234", { v: 1, state: s, savedAt: 1 });
    expect(r.ok).toBe(true);
    expect(r.trimmed).toBeGreaterThan(0);
    expect(r.bytes).toBeLessThanOrEqual(MAX_STATE_BYTES);
    const back = loadRoom("ABC234")!;
    expect(back.state.nodes.M1).toBeDefined();
    expect(back.state.nodes.S0).toBeUndefined();
    expect(back.state.nodes.S39).toBeDefined();
  });

  it("recent rooms: cap 5 newest first; forgetting drops the snapshot", () => {
    const code = (i: number) => `ABCDE${"BCDEFGH"[i]}`;
    for (let i = 0; i < 7; i++) {
      touchRecentRoom(recent(code(i), i));
      saveRoom(code(i), { v: 1, state: makeState(A, code(i)), savedAt: i });
    }
    const list = listRecentRooms();
    expect(list.length).toBe(5);
    expect(list.map((r) => r.code)).toEqual([code(6), code(5), code(4), code(3), code(2)]);
    expect(localStorage.getItem(roomKey(code(0)))).toBeNull();
    expect(localStorage.getItem(roomKey(code(6)))).not.toBeNull();
    forgetRoom(code(6));
    expect(listRecentRooms().map((r) => r.code)).toEqual([code(5), code(4), code(3), code(2)]);
    expect(localStorage.getItem(roomKey(code(6)))).toBeNull();
    expect(localStorage.getItem(roomBadKey(code(6)))).toBeNull();
    touchRecentRoom(recent(code(2), 99));
    expect(listRecentRooms()[0].code).toBe(code(2));
    localStorage.setItem(KEY_ROOMS, JSON.stringify([{ code: "bad" }, recent("GDDD22", 1), "junk"]));
    expect(listRecentRooms().map((r) => r.code)).toEqual(["GDDD22"]);
    localStorage.setItem(KEY_ROOMS, "nope");
    expect(listRecentRooms()).toEqual([]);
  });

  it("relay override", () => {
    expect(loadRelayOverride()).toBeNull();
    localStorage.setItem("wardogs:relay", "off");
    expect(loadRelayOverride()).toBe("off");
    localStorage.setItem("wardogs:relay", "wss://relay.example/path");
    expect(loadRelayOverride()).toBe("wss://relay.example/path");
    localStorage.setItem("wardogs:relay", "javascript:alert(1)");
    expect(loadRelayOverride()).toBeNull();
  });

  it("idb put/get on the memory fallback", async () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });
    await putMap("h1", {
      shared: blob,
      full: null,
      w: 1024,
      h: 1024,
      mime: "image/jpeg",
      name: "a.jpg",
      at: 1,
    });
    const rec = await getMap("h1");
    expect(rec?.name).toBe("a.jpg");
    expect(await getMap("nope")).toBeNull();
    await deleteMap("h1");
    expect(await getMap("h1")).toBeNull();
  });

  it("storage failures degrade to memory and notify once", () => {
    const failures: string[] = [];
    const off = onStorageError((f) => failures.push(f));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    };
    try {
      expect(writeLocal("k", "v")).toBe(false);
      const r = saveRoom("ABC234", { v: 1, state: makeState(A, "ABC234"), savedAt: 1 });
      expect(r.ok).toBe(false);
      expect(r.failure).toBe("quota");
    } finally {
      Storage.prototype.setItem = original;
      off();
    }
    expect(failures).toEqual(["quota", "quota"]);
    expect(readJson("missing")).toBeNull();
  });

  it("identity.ts and rooms.ts import no zod (source scan)", () => {
    for (const f of ["identity.ts", "rooms.ts"]) {
      const src = readFileSync(`${process.cwd()}/src/lib/storage/${f}`, "utf8");
      expect(src).not.toMatch(/from "zod"/);
      expect(src).not.toMatch(/\/schema"/);
    }
  });
});
