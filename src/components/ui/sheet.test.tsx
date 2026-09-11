import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Sheet } from "./sheet";
import { Button } from "./button";

function Harness({ modal }: { modal: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Requests</Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title="Requests" modal={modal}>
        <input aria-label="Note" />
        <button type="button">Send</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("modal: is a dialog, moves focus in, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<Harness modal />);
    const opener = screen.getByRole("button", { name: "Requests" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Requests" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    // Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last.
    const send = screen.getByRole("button", { name: "Send" });
    send.focus();
    fireEvent.keyDown(send, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(send).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("modal: the backdrop click closes it", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness modal />);
    await user.click(screen.getByRole("button", { name: "Requests" }));
    const backdrop = container.querySelector('[aria-hidden="true"].fixed');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("non-modal: renders a labelled region, no backdrop, and Escape closes it only from inside", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness modal={false} />);
    const opener = screen.getByRole("button", { name: "Requests" });
    await user.click(opener);
    const region = screen.getByRole("region", { name: "Requests" });
    expect(region).not.toHaveAttribute("aria-modal");
    expect(container.querySelector('[aria-hidden="true"].fixed')).toBeNull();
    // Focus stayed where it was (no trap, no auto-focus): Escape outside does nothing.
    expect(opener).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "Requests" })).toBeInTheDocument();
    screen.getByRole("textbox", { name: "Note" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region")).toBeNull();
  });
});
