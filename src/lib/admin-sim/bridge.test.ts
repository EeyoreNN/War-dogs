import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSimBridge, loadCommands, newCommandId, saveCommands, simKey } from "./bridge";
import {
  IDENTITY_KEY,
  PREFS_KEY,
  generateCallsign,
  loadShowRcon,
  loadVisitor,
  saveCallsign,
  saveShowRcon,
} from "./identity";
import type { TimedCommand } from "./types";

const NOW = Date.UTC(2026, 8, 11, 13, 0, 0);

/* A minimal BroadcastChannel: every instance with the same name hears every other's posts. */
class FakeChannel {
  static all = new Set<FakeChannel>();
  listeners = new Set<(e: MessageEvent) => void>();
  constructor(public name: string) {
    FakeChannel.all.add(this);
  }
  addEventListener(_t: string, l: (e: MessageEvent) => void) {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: (e: MessageEvent) => void) {
    this.listeners.delete(l);
  }
  postMessage(data: unknown) {
    for (const c of FakeChannel.all)
      if (c !== this && c.name === this.name)
        c.listeners.forEach((l) => l({ data } as MessageEvent));
  }
  close() {
    FakeChannel.all.delete(this);
  }
}

beforeEach(() => {
  localStorage.clear();
  FakeChannel.all.clear();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});
afterEach(() => vi.unstubAllGlobals());

describe("bridge storage", () => {
  it("keys by the 04:00Z boundary date and deletes older keys on load", () => {
    expect(simKey(NOW)).toBe("wardogs:sim:2026-09-11");
    expect(simKey(Date.UTC(2026, 8, 11, 3, 0, 0))).toBe("wardogs:sim:2026-09-10");
    localStorage.setItem("wardogs:sim:2026-09-09", "[]");
    localStorage.setItem("wardogs:sim:2026-09-10", "[]");
    localStorage.setItem("wardogs:other", "keep");
    const old: TimedCommand = { id: "old", at: NOW - 86_400_000, actor: "a", cmd: { t: "reset" } };
    const fresh: TimedCommand = { id: "fresh", at: NOW - 1000, actor: "a", cmd: { t: "reset" } };
    saveCommands(NOW, [old, fresh, { bogus: true } as unknown as TimedCommand]);
    expect(loadCommands(NOW)).toEqual([fresh]);
    expect(localStorage.getItem("wardogs:sim:2026-09-09")).toBeNull();
    expect(localStorage.getItem("wardogs:sim:2026-09-10")).toBeNull();
    expect(localStorage.getItem("wardogs:other")).toBe("keep");
    localStorage.setItem(simKey(NOW), "{not json");
    expect(loadCommands(NOW)).toEqual([]);
  });

  it("ids are unique", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newCommandId()));
    expect(ids.size).toBe(200);
  });
});

describe("createSimBridge", () => {
  it("push persists, notifies and reaches another tab through the channel", () => {
    let t = NOW;
    const a = createSimBridge(() => t);
    const b = createSimBridge(() => t);
    const seenA = vi.fn();
    const seenB = vi.fn();
    a.subscribe(seenA);
    b.subscribe(seenB);
    const c = a.push({ t: "broadcast", text: "hi" }, "Me");
    expect(c.at).toBe(NOW);
    expect(a.commands()).toEqual([c]);
    expect(b.commands()).toEqual([c]);
    expect(seenA).toHaveBeenCalledTimes(1);
    expect(seenB).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(simKey(NOW))!)).toEqual([c]);
    // A duplicate delivery is ignored.
    b.reload();
    expect(b.commands()).toHaveLength(1);
    // A third tab opened later boots from storage.
    t += 5000;
    const late = createSimBridge(() => t);
    expect(late.commands()).toEqual([c]);
    // Sorted by time whichever order they arrive in.
    b.push({ t: "reset" }, "You", NOW - 10);
    expect(a.commands().map((x) => x.cmd.t)).toEqual(["reset", "broadcast"]);
    a.close();
    b.close();
    late.close();
  });

  it("starts a fresh log when the boundary passes, and reload picks up a storage event", () => {
    let t = Date.UTC(2026, 8, 11, 3, 59, 0);
    const a = createSimBridge(() => t);
    a.push({ t: "reset" }, "Me");
    expect(a.commands()).toHaveLength(1);
    t = Date.UTC(2026, 8, 11, 4, 0, 1);
    a.push({ t: "broadcast", text: "new day" }, "Me");
    expect(a.commands().map((c) => c.cmd.t)).toEqual(["broadcast"]);
    expect(localStorage.getItem("wardogs:sim:2026-09-11")).toContain("new day");
    const foreign: TimedCommand = {
      id: "foreign",
      at: t - 1,
      actor: "Other",
      cmd: { t: "match.end" },
    };
    localStorage.setItem("wardogs:sim:2026-09-11", JSON.stringify([...a.commands(), foreign]));
    window.dispatchEvent(new StorageEvent("storage", { key: "wardogs:sim:2026-09-11" }));
    expect(a.commands().some((c) => c.id === "foreign")).toBe(true);
    a.close();
  });

  it("degrades to memory when storage throws", () => {
    const a = createSimBridge(() => NOW);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    a.push({ t: "reset" }, "Me");
    expect(a.storageOk).toBe(false);
    expect(a.commands()).toHaveLength(1);
    spy.mockRestore();
    a.close();
  });
});

describe("identity adapter", () => {
  it("creates an identity on first use with a generated callsign, then keeps it", () => {
    expect(generateCallsign()).toMatch(/^Operator [0-9A-F]{4}$/);
    const first = loadVisitor();
    expect(first.v).toBe(1);
    expect(first.client).toMatch(/^[0-9a-f]{16}$/);
    expect(first.callsign).toMatch(/^Operator [0-9A-F]{4}$/);
    expect(loadVisitor()).toEqual(first);
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY)!);
    expect(stored).toEqual({
      v: 1,
      client: first.client,
      callsign: first.callsign,
      focus: null,
      ink: "blue",
    });
  });

  it("reads a WP1-written identity and saves the callsign without touching other fields", () => {
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        v: 1,
        client: "abc",
        callsign: "Reaper",
        focus: "medic",
        ink: "red",
        extra: 1,
      }),
    );
    expect(loadVisitor()).toEqual({
      v: 1,
      client: "abc",
      callsign: "Reaper",
      focus: "medic",
      ink: "red",
    });
    const next = saveCallsign("  Ghost   Nine  ");
    expect(next.callsign).toBe("Ghost Nine");
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY)!);
    expect(stored).toMatchObject({
      client: "abc",
      callsign: "Ghost Nine",
      focus: "medic",
      ink: "red",
      extra: 1,
    });
    expect(saveCallsign("   ").callsign).toBe("Ghost Nine");
  });

  it("showRcon defaults to true and round-trips inside wardogs:prefs", () => {
    expect(loadShowRcon()).toBe(true);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 1, grid: true }));
    saveShowRcon(false);
    expect(loadShowRcon()).toBe(false);
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({
      v: 1,
      grid: true,
      showRcon: false,
    });
  });
});
