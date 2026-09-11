import { describe, expect, it } from "vitest";
import { CODE_ERROR, resolveCodeRoute } from "./logic";
import { forgetRoom, listRecentRooms } from "@/lib/storage/rooms";

describe("resolveCodeRoute", () => {
  it("routes a valid code to /room/<CODE>, uppercased and stripped", () => {
    expect(resolveCodeRoute("x5gm-4q")).toEqual({ ok: true, href: "/room/X5GM4Q" });
    expect(resolveCodeRoute(" ABC 234 ")).toEqual({ ok: true, href: "/room/ABC234" });
  });
  it("routes the reserved DEMO code to /demo", () => {
    expect(resolveCodeRoute("demo")).toEqual({ ok: true, href: "/demo" });
  });
  it("rejects ambiguous glyphs, short and long input with the inline error", () => {
    for (const bad of ["", "ABC", "ABC0DE", "ABCDEFG", "OOOOOO", "111111"]) {
      expect(resolveCodeRoute(bad)).toEqual({ ok: false, error: CODE_ERROR });
    }
  });
});

describe("recent rooms (WP1 storage, as the Rejoin card uses it)", () => {
  const room = (code: string, updatedAt: number) => ({
    code,
    team: "Lonestar",
    map: "zestafona",
    controlZone: "default",
    role: "commander",
    updatedAt,
  });
  it("reads newest first, caps at five and ignores junk", () => {
    localStorage.setItem(
      "wardogs:rooms",
      JSON.stringify([
        room("AAAAAA", 1),
        { nope: true },
        room("BBBBBB", 9),
        ...[2, 3, 4, 5, 6].map((n) => room(`C${n}C${n}C${n}`, n)),
      ]),
    );
    const list = listRecentRooms();
    expect(list).toHaveLength(5);
    expect(list[0]?.code).toBe("BBBBBB");
    expect(list.map((r) => r.code)).not.toContain("AAAAAA");
  });
  it("returns [] on unparsable storage and forgets a room plus its snapshot", () => {
    localStorage.setItem("wardogs:rooms", "{oops");
    expect(listRecentRooms()).toEqual([]);
    localStorage.setItem("wardogs:rooms", JSON.stringify([room("X5GM4Q", 5), room("Y5GM4Q", 4)]));
    localStorage.setItem("wardogs:room:X5GM4Q", "{}");
    forgetRoom("X5GM4Q");
    expect(listRecentRooms().map((r) => r.code)).toEqual(["Y5GM4Q"]);
    expect(localStorage.getItem("wardogs:room:X5GM4Q")).toBeNull();
  });
});
