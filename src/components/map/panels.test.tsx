// §7.1 component tests on the real store (memory transport): RequestsPanel filters and
// transitions, RosterPanel tallies and menu actions, ToolRail roving tabindex / hotkeys / request
// mode, NodeList expansion and labels.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryBus, createMemoryTransport } from "@/lib/realtime/memory";
import { marker, member, A, B } from "@/lib/map/test-fixtures";
import type { Identity, RosterMember } from "@/lib/map/types";
import { resetRoomStore, setTransportFactory, useRoomStore } from "@/store/room";
import { setNotifier } from "@/store/notify";
import { MapAppContext, type MapAppContextValue } from "./context";
import { NodeList } from "./NodeList";
import { RequestsPanel } from "./RequestsPanel";
import { RosterPanel } from "./RosterPanel";
import { ToolRail } from "./ToolRail";
import { resetUiStore, useUiStore } from "./ui-store";

vi.mock("@/components/ui/live-region", () => ({
  announce: vi.fn(),
  LiveRegion: () => null,
}));
import { announce } from "@/components/ui/live-region";

const me: Identity = { client: A, callsign: "Alpha", focus: "pilot", ink: "blue" };
const ctx: MapAppContextValue = {
  mode: "room",
  code: "ABC234",
  activity: null,
  go: () => undefined,
  openExternal: () => undefined,
  isMobile: false,
  landscapePhone: false,
  reducedMotion: true,
  rejoin: () => undefined,
  joinHint: null,
};

function Wrap({ children }: { children: React.ReactNode }) {
  return <MapAppContext.Provider value={ctx}>{children}</MapAppContext.Provider>;
}

async function bootRoom(over: { drawAccess?: "everyone" | "request" } = {}) {
  const store = useRoomStore.getState();
  await store.boot({ code: "ABC234", mode: "room", identity: me });
  store.startFresh({
    team: "Lonestar",
    map: "zestafona",
    drawAccess: over.drawAccess ?? "everyone",
  });
  return useRoomStore.getState();
}

describe("panels on the real store", () => {
  let bus: ReturnType<typeof createMemoryBus>;
  beforeEach(() => {
    localStorage.clear();
    bus = createMemoryBus();
    setTransportFactory((opts) => createMemoryTransport(bus, opts));
    setNotifier(() => undefined);
    resetUiStore();
    vi.mocked(announce).mockClear();
  });
  afterEach(() => {
    resetRoomStore();
    setTransportFactory(null);
    setNotifier(null);
  });

  it("RequestsPanel: raise, filter, claim, ETA, deliver, hint line, announcements", async () => {
    await bootRoom();
    const user = userEvent.setup();
    render(
      <Wrap>
        <RequestsPanel />
      </Wrap>,
    );
    expect(screen.getByText(/No requests yet/)).toBeInTheDocument();

    act(() => {
      useRoomStore.getState().dispatch({
        t: "request.add",
        request: {
          id: "R1",
          kind: "medical",
          status: "open",
          priority: "urgent",
          by: A,
          byName: "Alpha",
          claimedBy: null,
          claimedByName: null,
          createdAt: Date.now(),
          claimedAt: null,
          deliveredAt: null,
          etaSec: null,
          at: { x: 0.35, y: 0.65 },
          note: "two stretchers",
          layer: "team",
        },
      });
    });
    const card = screen.getByRole("listitem", { name: "" });
    expect(within(card).getByText("Medical")).toBeInTheDocument();
    expect(within(card).getByText(/urgent/i)).toBeInTheDocument();
    expect(within(card).getByText("D7")).toBeInTheDocument();
    // Nobody online has the medic focus → hint line.
    expect(within(card).getByText(/No medic in room/i)).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /^claim$/i }));
    expect(useRoomStore.getState().state?.requests.R1.status).toBe("claimed");
    expect(within(card).getByText(/claimed by Alpha/)).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "2m" }));
    expect(useRoomStore.getState().state?.requests.R1.etaSec).toBe(120);
    expect(within(card).getByText(/ETA/)).toBeInTheDocument();

    // MINE shows it (claimed by me); DONE is empty until delivery.
    await user.click(screen.getByRole("tab", { name: /mine/i }));
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /done/i }));
    expect(screen.getByText(/Nothing delivered yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^all$/i }));
    await user.click(screen.getByRole("button", { name: /^delivered$/i }));
    expect(useRoomStore.getState().state?.requests.R1.status).toBe("delivered");
    await user.click(screen.getByRole("tab", { name: /done/i }));
    expect(screen.getByText(/^delivered$/i)).toBeInTheDocument();
  });

  it("RosterPanel: tallies, warnings, offline rows and the command menu", async () => {
    await bootRoom({ drawAccess: "request" });
    const user = userEvent.setup();
    const bravo: RosterMember = member(B, {
      callsign: "Bravo",
      focus: "medic",
      drawRequested: true,
      online: true,
      canDraw: false,
    });
    act(() => {
      useRoomStore.getState().ingest({
        id: "OP1",
        ts: Date.now(),
        actor: B,
        seq: 50,
        t: "roster.upsert",
        member: bravo,
      });
      useRoomStore
        .getState()
        .ingestPresence([{ client: B, callsign: "Bravo", seenAt: Date.now(), cursor: null }]);
    });
    render(
      <Wrap>
        <RosterPanel />
      </Wrap>,
    );
    expect(screen.getByText(/Pilot 1/)).toBeInTheDocument();
    expect(screen.getByText(/Medic 1/)).toBeInTheDocument();
    expect(screen.queryByText(/No pilot in room/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 asking to draw/)).toBeInTheDocument();
    const roster = screen.getByRole("list", { name: /^roster$/i });
    expect(within(roster).getByText("Alpha")).toBeInTheDocument();
    expect(within(roster).getByText("(you)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(useRoomStore.getState().state?.roster[B].canDraw).toBe(true);
    expect(useRoomStore.getState().state?.roster[B].drawRequested).toBe(false);

    await user.click(screen.getByRole("button", { name: /more actions for bravo/i }));
    const menu = screen.getByRole("menu");
    await user.click(within(menu).getByRole("menuitem", { name: /make co-commander/i }));
    expect(useRoomStore.getState().state?.roster[B].role).toBe("co-commander");

    await user.click(screen.getByRole("button", { name: /more actions for bravo/i }));
    await user.click(screen.getByRole("menuitem", { name: /^kick$/i }));
    await user.click(
      screen
        .getByRole("dialog")
        .querySelector("button.bg-danger\\/15, button[class*='danger']") as HTMLElement,
    );
    expect(useRoomStore.getState().state?.roster[B]).toBeUndefined();
  });

  it("ToolRail: roving tabindex, arrow keys, tool buttons, disabled in request mode for members", async () => {
    await bootRoom();
    const user = userEvent.setup();
    const { unmount } = render(
      <Wrap>
        <ToolRail />
      </Wrap>,
    );
    const toolbar = screen.getByRole("toolbar", { name: /drawing tools/i });
    const select = within(toolbar).getByRole("button", { name: "Select" });
    const pen = within(toolbar).getByRole("button", { name: "Pen" });
    expect(select).toHaveAttribute("tabindex", "0");
    expect(pen).toHaveAttribute("tabindex", "-1");
    select.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowDown" });
    expect(document.activeElement).toBe(pen);
    expect(pen).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(toolbar, { key: "End" });
    expect(document.activeElement).not.toBe(pen);
    await user.click(pen);
    expect(useRoomStore.getState().tool).toBe("pen");
    expect(pen).toHaveAttribute("aria-pressed", "true");
    expect(pen).toHaveAttribute("aria-keyshortcuts", "P");
    await user.click(within(toolbar).getByRole("button", { name: "Enemy troops" }));
    expect(useRoomStore.getState().tool).toBe("marker");
    expect(useRoomStore.getState().markerKind).toBe("enemy-troops");
    await user.click(within(toolbar).getByRole("radio", { name: "Manticore" }));
    expect(useRoomStore.getState().enemyTeam).toBe("Manticore");
    await user.click(within(toolbar).getByRole("radio", { name: "Red" }));
    expect(useRoomStore.getState().ink).toBe("red");
    unmount();

    // A member in `request` mode gets locked tools and the Ask to draw chip.
    act(() => {
      useRoomStore
        .getState()
        .dispatch({ t: "settings.update", patch: { drawAccess: "request" } }, { undoable: false });
      useRoomStore
        .getState()
        .dispatch({ t: "roster.update", id: A, patch: { canDraw: false } }, { undoable: false });
      useRoomStore
        .getState()
        .dispatch({ t: "roster.update", id: A, patch: { role: "member" } }, { undoable: false });
    });
    render(
      <Wrap>
        <ToolRail />
      </Wrap>,
    );
    const bar = screen.getByRole("toolbar", { name: /drawing tools/i });
    expect(within(bar).getByRole("button", { name: "Pen" })).toBeDisabled();
    expect(within(bar).getByRole("button", { name: "Select" })).not.toBeDisabled();
    await user.click(within(bar).getByRole("button", { name: /ask to draw/i }));
    expect(useRoomStore.getState().state?.roster[A].drawRequested).toBe(true);
  });

  it("NodeList: collapsed by default, expands on focus, options carry the faction, Delete removes", async () => {
    await bootRoom();
    act(() => {
      useRoomStore.getState().dispatch({
        t: "node.add",
        nodes: [
          marker("M1", {
            kind: "enemy-fob",
            team: "Valkyra",
            label: "AUSTIN",
            at: { x: 0.55, y: 0.25 },
            author: A,
            authorName: "Alpha",
          }),
          marker("M2", {
            kind: "lz",
            label: "LZ BRAVO",
            at: { x: 0.35, y: 0.65 },
            author: A,
            authorName: "Alpha",
          }),
        ],
      });
    });
    render(
      <Wrap>
        <NodeList />
      </Wrap>,
    );
    expect(screen.getByRole("button", { name: /things on the map \(2\)/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const list = document.getElementById("node-list") as HTMLElement;
    expect(list).toHaveAttribute("role", "listbox");
    act(() => list.focus());
    expect(screen.getByRole("button", { name: /things on the map/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.textContent)).toEqual([
      'Enemy FOB · Valkyra "AUSTIN" at F3, placed by Alpha',
      'Friendly LZ "LZ BRAVO" at D7, placed by Alpha',
    ]);
    expect(useRoomStore.getState().selection).toBe("M1");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(useRoomStore.getState().selection).toBe("M2");
    fireEvent.keyDown(list, { key: "Delete" });
    expect(useRoomStore.getState().state?.nodes.M2).toBeUndefined();
    expect(useUiStore.getState().nodeListApi).not.toBeNull();
  });
});
