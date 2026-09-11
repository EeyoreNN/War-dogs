import { describe, expect, it } from "vitest";
import {
  exportStem,
  formatAgeClock,
  formatBearing,
  formatClock,
  formatDistance,
  formatEta,
  formatMb,
  initialOf,
  measureLabel,
  spokenEta,
  timeAgo,
} from "./format";

describe("format", () => {
  it("distance in metres for built-ins, map fractions for uploads", () => {
    expect(formatDistance(0.5, 2400)).toBe("1,200 m");
    expect(formatDistance(0.5167, 2400)).toBe("1,240 m");
    expect(formatDistance(0.52, null)).toBe("0.52 map");
  });
  it("bearing is three digits", () => {
    expect(formatBearing(47)).toBe("047°");
    expect(formatBearing(359.6)).toBe("000°");
    expect(formatBearing(-90)).toBe("270°");
  });
  it("measure label", () => {
    expect(measureLabel(0.5167, 47, 2400)).toBe("1,240 m · 047°");
  });
  it("clocks", () => {
    expect(formatClock(272)).toBe("4:32");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatAgeClock(42_000)).toBe("0:42");
    expect(formatAgeClock(3_725_000)).toBe("1:02:05");
    expect(formatEta(42)).toBe("ETA 0:42");
    expect(formatEta(-12)).toBe("ETA −0:12");
  });
  it("spoken eta", () => {
    expect(spokenEta(30)).toBe("30 seconds");
    expect(spokenEta(60)).toBe("1 minute");
    expect(spokenEta(150)).toBe("3 minutes");
  });
  it("megabytes and export stems", () => {
    expect(formatMb(11.2 * 1024 * 1024)).toBe("11.2 MB");
    const stem = exportStem("X5GM4Q", new Date(2026, 8, 11, 14, 32).getTime());
    expect(stem).toBe("wardogs-X5GM4Q-20260911-1432");
  });
  it("time ago", () => {
    const now = 1_000_000_000;
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2 days ago");
  });
  it("initials", () => {
    expect(initialOf("ossian")).toBe("O");
    expect(initialOf("  ")).toBe("?");
  });
});
