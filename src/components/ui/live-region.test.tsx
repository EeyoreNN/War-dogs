import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRegion, announce } from "./live-region";

describe("LiveRegion", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("coalesces announcements made within 300 ms into one polite message", () => {
    render(<LiveRegion />);
    const region = screen.getByText("", { selector: "[aria-live='polite']" });
    act(() => {
      announce("Copied");
      announce("Request claimed");
    });
    expect(region).toHaveTextContent("");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(region).toHaveTextContent("Copied. Request claimed");
  });
});
