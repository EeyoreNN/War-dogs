import { describe, expect, it } from "vitest";
import {
  ageState,
  canEdit,
  claim,
  createRequest,
  deliver,
  etaRemaining,
  filterRequests,
  rankRequests,
  release,
  setEta,
  shouldPrune,
  suggestedFocus,
} from "./requests";
import { A, B, C, member, request } from "./test-fixtures";
import type { RequestPatch, SupplyRequest } from "./types";

const me = member(B, { callsign: "Bravo" });
const cmd = member(C, { callsign: "Charlie", role: "co-commander" });
const other = member(A, { callsign: "Alpha" });
const patched = (r: SupplyRequest, p: RequestPatch | string): SupplyRequest => ({
  ...r,
  ...(p as RequestPatch),
});

describe("requests", () => {
  it("createRequest starts open with no claim", () => {
    const r = createRequest({
      id: "R1",
      kind: "fuel",
      priority: "urgent",
      by: A,
      byName: "Alpha",
      at: null,
      note: "hi",
      layer: "team",
      now: 10,
    });
    expect(r).toMatchObject({
      status: "open",
      claimedBy: null,
      createdAt: 10,
      note: "hi",
      priority: "urgent",
      at: null,
    });
  });
  it("open → claimed → delivered, with release and the error edges", () => {
    const r = request("R1", { by: A });
    const c = claim(r, me, 1000, 60);
    expect(c).toEqual({
      status: "claimed",
      claimedBy: B,
      claimedByName: "Bravo",
      claimedAt: 1000,
      etaSec: 60,
    });
    const claimed = patched(r, c);
    expect(claim(claimed, other, 2000)).toBe("not-open");
    expect(deliver(r, me, 2000)).toBe("not-claimed");
    expect(deliver(claimed, other, 2000)).toBe("not-yours");
    expect(deliver(claimed, cmd, 2000)).toEqual({ status: "delivered", deliveredAt: 2000 });
    const d = deliver(claimed, me, 2000);
    expect(d).toEqual({ status: "delivered", deliveredAt: 2000 });
    const delivered = patched(claimed, d);
    expect(deliver(delivered, me, 3000)).toBe("already-delivered");
    expect(claim(delivered, me, 3000)).toBe("already-delivered");
    expect(release(delivered, me)).toBe("already-delivered");
    expect(release(r, me)).toBe("not-claimed");
    expect(release(claimed, other)).toBe("not-yours");
    expect(release(claimed, cmd)).toEqual({
      status: "open",
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
      etaSec: null,
    });
    expect(release(claimed, me)).toMatchObject({ status: "open" });
    expect(claim(r, me, 1000)).toMatchObject({ etaSec: null });
  });
  it("eta is the claimer's alone", () => {
    const claimed = patched(request("R1"), claim(request("R1"), me, 1000, 60));
    expect(setEta(claimed, me, 120)).toEqual({ etaSec: 120 });
    expect(setEta(claimed, cmd, 120)).toBe("not-yours");
    expect(setEta(request("R1"), me, 120)).toBe("not-claimed");
    expect(setEta(patched(claimed, { status: "delivered" }), me, 5)).toBe("already-delivered");
    expect(etaRemaining(claimed, 31_000)).toBe(30);
    expect(etaRemaining(claimed, 91_000)).toBe(-30);
    expect(etaRemaining(request("R1"), 5000)).toBeNull();
    expect(etaRemaining({ ...claimed, etaSec: null }, 5000)).toBeNull();
  });
  it("canEdit: requester or command", () => {
    const r = request("R1", { by: A });
    expect(canEdit(r, other)).toBe(true);
    expect(canEdit(r, cmd)).toBe(true);
    expect(canEdit(r, me)).toBe(false);
  });
  it("ageState thresholds", () => {
    const r = request("R1", { createdAt: 0 });
    expect(ageState(r, 59_999)).toBe("fresh");
    expect(ageState(r, 60_000)).toBe("aging");
    expect(ageState(r, 119_999)).toBe("aging");
    expect(ageState(r, 120_000)).toBe("stale");
    expect(ageState({ ...r, status: "claimed" }, 500_000)).toBe("fresh");
  });
  it("suggestedFocus", () => {
    expect(suggestedFocus("fuel")).toEqual(["pilot", "driver"]);
    expect(suggestedFocus("ammo")).toEqual(["pilot", "driver"]);
    expect(suggestedFocus("medical")).toEqual(["medic"]);
    expect(suggestedFocus("other")).toEqual([]);
  });
  it("rankRequests: urgent first, then my focus, then oldest", () => {
    const list = [
      request("old-other", { kind: "other", createdAt: 100 }),
      request("new-fuel", { kind: "fuel", createdAt: 300 }),
      request("mid-fuel", { kind: "fuel", createdAt: 200 }),
      request("urgent-medical", { kind: "medical", createdAt: 400, priority: "urgent" }),
      request("urgent-fuel-late", { kind: "fuel", createdAt: 500, priority: "urgent" }),
    ];
    const pilot = member(B, { focus: "pilot" });
    expect(rankRequests(list, pilot, 1000).map((r) => r.id)).toEqual([
      "urgent-fuel-late",
      "urgent-medical",
      "mid-fuel",
      "new-fuel",
      "old-other",
    ]);
    expect(rankRequests(list, null, 1000).map((r) => r.id)).toEqual([
      "urgent-medical",
      "urgent-fuel-late",
      "old-other",
      "mid-fuel",
      "new-fuel",
    ]);
    expect(list.map((r) => r.id)[0]).toBe("old-other");
  });
  it("filterRequests: MINE both ways", () => {
    const byMe = request("a", { by: B });
    const claimedByMe = request("b", { by: A, status: "claimed", claimedBy: B });
    const deliveredByMe = request("c", { by: A, status: "delivered", claimedBy: B });
    const others = request("d", { by: A });
    const list = [byMe, claimedByMe, deliveredByMe, others];
    expect(filterRequests(list, "mine", B).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(filterRequests(list, "mine", null)).toEqual([]);
    expect(filterRequests(list, "all", B).map((r) => r.id)).toEqual(["a", "b", "d"]);
    expect(filterRequests(list, "open", B).map((r) => r.id)).toEqual(["a", "d"]);
    expect(filterRequests(list, "done", B).map((r) => r.id)).toEqual(["c"]);
  });
  it("shouldPrune after 30 minutes delivered", () => {
    const d = request("R1", { status: "delivered", deliveredAt: 0 });
    expect(shouldPrune(d, 30 * 60_000)).toBe(false);
    expect(shouldPrune(d, 30 * 60_000 + 1)).toBe(true);
    expect(shouldPrune(request("R2"), 10_000_000)).toBe(false);
  });
});
