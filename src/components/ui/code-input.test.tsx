import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeInput, isSubmittableCode, normalizeCodeInput } from "./code-input";

function Harness({
  initial = "",
  onSubmit,
  error,
}: {
  initial?: string;
  onSubmit?: () => void;
  error?: string;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <CodeInput id="code" value={value} onChange={setValue} onSubmit={onSubmit} error={error} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const cells = () => screen.getAllByRole("textbox") as HTMLInputElement[];

describe("CodeInput", () => {
  it("normalises and validates codes", () => {
    expect(normalizeCodeInput("x5gm-4q")).toBe("X5GM4Q");
    expect(normalizeCodeInput("X5GM 4Q")).toBe("X5GM4Q");
    expect(isSubmittableCode("X5GM4Q")).toBe(true);
    expect(isSubmittableCode("DEMO")).toBe(true);
    expect(isSubmittableCode("X5GM4")).toBe(false);
    expect(isSubmittableCode("O0II11")).toBe(false);
  });

  it("uppercases, auto-advances and steps back on Backspace", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const [c1, c2, c3] = cells();
    expect(c1).toHaveAttribute("id", "code");
    await user.click(c1);
    await user.keyboard("x");
    expect(screen.getByTestId("value")).toHaveTextContent("X");
    expect(c2).toHaveFocus();
    await user.keyboard("5");
    expect(c3).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(screen.getByTestId("value")).toHaveTextContent(/^X$/);
    expect(c2).toHaveFocus();
  });

  it("accepts a pasted code with separators", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(cells()[0]);
    await user.paste("x5gm-4q");
    expect(screen.getByTestId("value")).toHaveTextContent("X5GM4Q");
    expect(cells()[5]).toHaveFocus();
  });

  it("submits on Enter for a full code or DEMO, not for a partial one", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { unmount } = render(<Harness initial="DEMO" onSubmit={onSubmit} />);
    await user.click(cells()[3]);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    unmount();

    render(<Harness initial="X5GM4" onSubmit={onSubmit} />);
    await user.click(cells()[4]);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("marks the cells invalid and describes them with the error", () => {
    render(<Harness error="Codes are 6 letters or digits, never 0, O, 1 or I." />);
    expect(screen.getByRole("alert")).toHaveAttribute("id", "code-error");
    for (const c of cells()) {
      expect(c).toHaveAttribute("aria-invalid", "true");
      expect(c).toHaveAttribute("aria-describedby", "code-error");
    }
  });
});
