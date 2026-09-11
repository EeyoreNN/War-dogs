import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";
import { LiveRegion } from "./live-region";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("CopyButton", () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.useRealTimers();
  });

  it("copies, swaps to Copied for 2 s, announces once and calls onCopied", async () => {
    const onCopied = vi.fn();
    const user = userEvent.setup();
    // user-event's setup() installs its own clipboard stub; ours must come after it.
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(
      <>
        <CopyButton text="ABC234" label="Copy code" onCopied={onCopied} />
        <LiveRegion />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(onCopied).toHaveBeenCalledTimes(1);
    // The LiveRegion coalesces for 300 ms before it announces.
    await act(() => new Promise((r) => setTimeout(r, 350)));
    expect(screen.getByText(/Copied/, { selector: ".sr-only" })).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 2100)));
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("degrades to a selectable input when the clipboard API is missing", async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    render(<CopyButton text="ABC234" label="Copy code" />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    const input = screen.getByRole("textbox", { name: /Copy code: select the text/ });
    expect(input).toHaveValue("ABC234");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("degrades to the input when the write is refused", async () => {
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    render(<CopyButton text="ABC234" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("textbox")).toHaveValue("ABC234");
  });
});
