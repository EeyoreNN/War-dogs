import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses } from "./button";
import { Chip } from "./chip";
import { Kbd } from "./kbd";

describe("Button", () => {
  it("renders a type=button with the variant classes", () => {
    render(<Button variant="secondary">Open</Button>);
    const btn = screen.getByRole("button", { name: "Open" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.className).toContain("border-line-strong");
  });

  it("exposes active as aria-pressed and chip selection the same way", () => {
    render(
      <>
        <Button variant="icon" active aria-label="Pen" />
        <Chip selected>Mine</Chip>
        <Chip>All</Chip>
      </>,
    );
    expect(screen.getByRole("button", { name: "Pen" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });

  it("locks the label and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save plan
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveTextContent("Save plan");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a trailing keycap and the platform modifier", () => {
    render(
      <>
        <Button kbd="P">Pen</Button>
        <Kbd>Mod+Z</Kbd>
      </>,
    );
    expect(screen.getByRole("button", { name: /Pen/ }).querySelector("kbd")).toHaveTextContent("P");
    expect(screen.getByText("Ctrl+Z").tagName).toBe("KBD");
  });

  it("buttonClasses forces the icon and chip sizes", () => {
    expect(buttonClasses("icon", "lg")).toContain("w-10");
    expect(buttonClasses("chip", "lg")).toContain("h-8");
    expect(buttonClasses("primary", "md")).toContain("pointer-coarse:min-h-11");
  });
});
