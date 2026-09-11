import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SEED, stateAt } from "@/lib/admin-sim/engine";
import { LiveCardIsland, LiveServerCard } from "./live-server-card";
import { SimProvider } from "./sim-provider";

const NOW = Date.UTC(2026, 8, 11, 13, 4, 31);

describe("LiveServerCard", () => {
  it("renders the scores, map, mode and metrics from a fixed state", () => {
    const state = stateAt(DEFAULT_SEED, NOW, [], "Operator 41E3");
    render(<LiveServerCard state={state} />);
    expect(screen.getByText("Wardogs Demo Server")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Zestafona|Bakurani|Ozeti/);
    for (const team of ["Lonestar", "Valkyra", "Manticore"] as const) {
      expect(screen.getByLabelText(`${team} ${state.scores[team]}`)).toBeInTheDocument();
    }
    expect(screen.getByText(`${state.players.length}/${state.maxPlayers}`)).toBeInTheDocument();
    expect(screen.getByText(String(state.history.length))).toBeInTheDocument();
    // Five-row roster preview with team dots and pings.
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("LiveCardIsland mounts the sim and swaps the skeleton for the card", async () => {
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
