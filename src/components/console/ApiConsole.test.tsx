import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiConsole } from "./ApiConsole";
import { resetTargetCache } from "./target";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetTargetCache();
  window.history.replaceState(null, "", "/rcon-api");
});

describe("ApiConsole", () => {
  it("lists every endpoint grouped by tag and filters by search", async () => {
    const user = userEvent.setup();
    render(<ApiConsole />);
    const nav = screen.getByRole("navigation", { name: "Endpoints" });
    expect(within(nav).getAllByRole("button")).toHaveLength(35);
    await user.type(screen.getByRole("searchbox", { name: "Search endpoints" }), "status");
    expect(within(nav).getAllByRole("button")).toHaveLength(1);
    expect(within(nav).getByText("/status")).toBeInTheDocument();
  });

  it("sends GET /v1/status to the simulator and renders a 200 with the server name", async () => {
    const user = userEvent.setup();
    render(<ApiConsole />);
    await user.type(screen.getByRole("searchbox", { name: "Search endpoints" }), "status");
    await user.click(
      within(screen.getByRole("navigation", { name: "Endpoints" })).getByRole("button"),
    );
    expect(screen.getByTestId("snippet-curl").textContent).toContain("Authorization: Bearer");
    expect(screen.getByTestId("snippet-curl").textContent).toContain("/v1/status");
    const send = screen.getByTestId("console-send");
    await screen.findByText(/Any token works/);
    // The simulator boots on mount; wait for its state before sending.
    await new Promise((r) => setTimeout(r, 50));
    await user.click(send);
    const status = await screen.findByTestId("response-status");
    expect(status.textContent).toContain("200");
    expect(screen.getByTestId("response-body").textContent).toContain("Wardogs Demo Server");
  });

  it("deep-links to an endpoint via ?endpoint= and shows the request form", () => {
    window.history.replaceState(null, "", "/rcon-api?endpoint=post-v1-players-steamId-kick");
    render(<ApiConsole />);
    expect(screen.getByRole("heading", { name: "Kick a player" })).toBeInTheDocument();
    expect(screen.getByLabelText(/steamId · path/)).toBeInTheDocument();
    expect(screen.getByTestId("console-send")).toBeDisabled();
  });

  it("switches to your server, warns about http on https pages and keeps the target in sessionStorage", async () => {
    const user = userEvent.setup();
    render(<ApiConsole />);
    await user.click(screen.getByRole("radio", { name: "Your server" }));
    await user.type(screen.getByLabelText("Base URL"), "https://example.test:7776");
    expect(JSON.parse(sessionStorage.getItem("wardogs:console:target")!)).toMatchObject({
      mode: "server",
      baseUrl: "https://example.test:7776",
    });
    expect(screen.getByText(/must answer CORS preflights/)).toBeInTheDocument();
    expect(localStorage.getItem("wardogs:console:target")).toBeNull();
  });
});
