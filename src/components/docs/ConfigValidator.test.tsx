import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigValidator } from "./ConfigValidator";

const template = readFileSync(join(process.cwd(), "src/content/ServerSettings.ini"), "utf8");

describe("ConfigValidator", () => {
  it("renders issues for a bad ScorePeriod and an unknown key", () => {
    render(<ConfigValidator template={template} />);
    const box = screen.getByLabelText("Paste your ServerSettings.ini");
    const validate = screen.getByRole("button", { name: "Validate" });
    expect(validate.hasAttribute("disabled")).toBe(true);
    fireEvent.change(box, {
      target: { value: "[MatchState.Playing.KOTH]\nScorePeriod=40\nFoo=1\n" },
    });
    fireEvent.click(validate);
    expect(screen.getByText("Rejected")).toBeTruthy();
    expect(screen.getByText(/ScorePeriod=40 is outside 18–30/)).toBeTruthy();
    expect(screen.getByText(/Foo is not honoured/)).toBeTruthy();
    expect(screen.getByText(/1 error · 1 warning · 1 stripped/)).toBeTruthy();
    expect(screen.getByText(/Stripped: MatchState.Playing.KOTH.Foo/)).toBeTruthy();
  });

  it("loads the template and validates it clean", () => {
    render(<ConfigValidator template={template} />);
    fireEvent.click(screen.getByRole("button", { name: "Load the template" }));
    const box = screen.getByLabelText("Paste your ServerSettings.ini") as HTMLTextAreaElement;
    expect(box.value).toBe(template);
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByText("Valid")).toBeTruthy();
    expect(screen.getByText(/0 errors/)).toBeTruthy();
  });
});
