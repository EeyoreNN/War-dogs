import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { Dialog } from "./dialog";
import { Button } from "./button";

// jsdom has no showModal()/close(); mirror the attribute so `open` reflects the state.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof proto.showModal !== "function") {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

function Harness() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Manage</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Manage room">
        <input aria-label="Room name" />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens focused on the first control, closes on the native close event and restores focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Manage" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Manage room" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByLabelText("Room name")).toHaveFocus();

    fireEvent(dialog, new Event("close"));
    expect(screen.queryByLabelText("Room name")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
