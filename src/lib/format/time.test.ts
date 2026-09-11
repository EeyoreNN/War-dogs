import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

describe("timeAgo", () => {
  const now = 1_800_000_000_000;

  it("formats whole units, floored", () => {
    expect(timeAgo(now - 20_000, now)).toBe("just now");
    expect(timeAgo(now - 59_999, now)).toBe("just now");
    expect(timeAgo(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 3.9 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 23 * 3_600_000, now)).toBe("23 h ago");
  });

  it("switches to days at 24 h and pluralises", () => {
    expect(timeAgo(now - 24 * 3_600_000, now)).toBe("1 day ago");
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe("1 day ago");
    expect(timeAgo(now - 5 * 86_400_000, now)).toBe("5 days ago");
  });

  it("never reads negative for a future timestamp", () => {
    expect(timeAgo(now + 60_000, now)).toBe("just now");
  });
});
