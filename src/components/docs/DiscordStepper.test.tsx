import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DiscordStepper, OUTCOMES, resolve, STORAGE_KEY } from "./DiscordStepper";

const answer = (label: "Yes" | "No") =>
  fireEvent.click(screen.getByRole("button", { name: label }));
const outcome = () => screen.getByRole("region").getAttribute("data-outcome");

describe("resolve", () => {
  it("maps every answer path to its outcome", () => {
    expect(resolve([])).toEqual({ question: 0 });
    expect(resolve(["no"])).toEqual({ outcome: "A" });
    expect(resolve(["yes"])).toEqual({ question: 1 });
    expect(resolve(["yes", "no"])).toEqual({ outcome: "C" });
    expect(resolve(["yes", "yes"])).toEqual({ question: 2 });
    expect(resolve(["yes", "yes", "yes"])).toEqual({ outcome: "B" });
    expect(resolve(["yes", "yes", "no"])).toEqual({ outcome: "D" });
  });
});

describe("DiscordStepper", () => {
  beforeEach(() => sessionStorage.clear());

  it("reaches all four outcomes and starts over", () => {
    const { unmount } = render(<DiscordStepper />);
    expect(screen.getByText("Can you — an admin — launch it?")).toBeTruthy();

    answer("No");
    expect(outcome()).toBe("A");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(OUTCOMES.A.title);
    expect(screen.getByRole("link", { name: "Add to your server" }).getAttribute("href")).toBe(
      "/add",
    );
    expect(screen.getByRole("button", { name: "Copy this checklist for my mods" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByText("Question 1 of 3")).toBeTruthy();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    answer("Yes");
    answer("No");
    expect(outcome()).toBe("C");
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));

    answer("Yes");
    answer("Yes");
    expect(screen.getByText("Question 3 of 3")).toBeTruthy();
    answer("Yes");
    expect(outcome()).toBe("B");
    expect(screen.getByRole("link", { name: /Temp voice channels/ }).getAttribute("href")).toBe(
      "#temp-channels",
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));

    answer("Yes");
    answer("Yes");
    answer("No");
    expect(outcome()).toBe("D");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(["yes", "yes", "no"]));
    unmount();
  });

  it("restores its state from sessionStorage", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(["yes", "yes"]));
    render(<DiscordStepper />);
    expect(screen.getByText("Question 3 of 3")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("ignores garbage in storage", () => {
    sessionStorage.setItem(STORAGE_KEY, "{nope");
    render(<DiscordStepper />);
    expect(screen.getByText("Question 1 of 3")).toBeTruthy();
  });
});
