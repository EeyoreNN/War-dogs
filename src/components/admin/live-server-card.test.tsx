import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveCardIsland } from "./live-server-card";
import { SimProvider } from "./sim-provider";

describe("LiveCardIsland", () => {
  it("mounts the sim and renders the card", async () => {
    render(
      <SimProvider>
        <LiveCardIsland />
      </SimProvider>,
    );
    expect(
      await screen.findByTestId("live-server-card", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
