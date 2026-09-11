import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, toast, useToastStore } from "./toast";
import { LiveRegion } from "./live-region";

describe("Toaster", () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));
  afterEach(() => vi.useRealTimers());

  it("shows a toast, announces it through the live region and auto-dismisses after 4 s", async () => {
    vi.useFakeTimers();
    render(
      <>
        <Toaster />
        <LiveRegion />
      </>,
    );
    act(() => toast("Plan copied"));
    expect(screen.getByText("Plan copied")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(350));
    expect(screen.getByText(/Plan copied/, { selector: ".sr-only" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Plan copied", { selector: "p" })).toBeNull();
  });

  it("keeps at most four toasts and drops the oldest", () => {
    render(<Toaster />);
    act(() => {
      for (let i = 1; i <= 5; i++) toast(`Toast ${i}`, { durationMs: 0 });
    });
    expect(screen.queryByText("Toast 1")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(4);
  });

  it("runs the action once and dismisses; the X dismisses too", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Toaster />);
    act(() => {
      toast("Room left", { action: { label: "Undo", onClick }, durationMs: 0 });
      toast("Saved", { durationMs: 0 });
    });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Room left")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("places itself bottom-right by default and top centre for app routes (§4.3.8)", () => {
    const { container, rerender } = render(<Toaster />);
    const el = () => container.firstElementChild as HTMLElement;
    expect(el().dataset.position).toBe("bottom-right");
    expect(el().className).toMatch(/\bbottom-4\b/);
    rerender(<Toaster position="top" />);
    expect(el().dataset.position).toBe("top");
    expect(el().className).toMatch(/\btop-14\b/);
    expect(el().className).not.toMatch(/\bbottom-4\b/);
    expect(el().className).not.toMatch(/sm:right-6/);
  });
});
