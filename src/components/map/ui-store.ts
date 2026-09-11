// UI-only state shared across the app's components (dialogs, sheets, placement modes, the
// viewport API). Nothing here is room state: that lives in `useRoomStore` and only its actions
// mutate it (§5.1).
import { create } from "zustand";
import type { SheetSnap } from "@/components/ui/sheet";
import type { RequestFilter } from "@/lib/map/requests";
import type { Ping, Point, RequestKind, RequestPriority } from "@/lib/map/types";

export type ManageTab = "map" | "squads" | "access" | "plan" | "room";
export type PanelTab = "requests" | "roster";

export interface ViewportApi {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  centreOn(p: Point): void;
  focusMap(): void;
  /** The map point under the crosshair / viewport centre. */
  crosshair(): Point;
  /** Place the current marker at the crosshair (keyboard path). */
  placeAtCrosshair(): void;
  exportSvgElement(): SVGSVGElement | null;
  terrainForExport(): Promise<ImageBitmap | HTMLCanvasElement | null>;
}

export interface TextEditorState {
  at: Point;
  nodeId: string | null;
  initial: string;
  kind: "text" | "label";
}

export interface PlacingRequest {
  kind: RequestKind;
  priority: RequestPriority;
  note: string;
}

interface UiState {
  panelsOpen: boolean;
  requestFilter: RequestFilter;
  helpOpen: boolean;
  manageOpen: boolean;
  manageTab: ManageTab;
  newRequestOpen: boolean;
  placingRequest: PlacingRequest | null;
  pingArmed: boolean;
  textEditor: TextEditorState | null;
  copyFallback: { title: string; text: string } | null;
  downloadBlocked: boolean;
  fullscreen: boolean;
  layersOpen: boolean;
  hiddenLayers: string[];
  // mobile
  panelTab: PanelTab;
  sheetSnap: SheetSnap;
  markerSheet: { at: Point | null } | null;
  moreOpen: boolean;
  demoChipDismissed: boolean;
  // transient
  freshIds: Set<string>;
  /** The node list's "open and focus" entry point (Tab from the map, §4.3.10). */
  nodeListApi: { focus(): void } | null;
  /** Scripted bot pings in the demo (they are not ours, so they cannot go through store.ping). */
  demoPings: Ping[];
  viewportApi: ViewportApi | null;
  // actions
  set(patch: Partial<UiState>): void;
  openManage(tab?: ManageTab): void;
  markFresh(ids: string[]): void;
  toggleLayer(layer: string): void;
}

const FRESH_MS = 450;

export const useUiStore = create<UiState>()((set, get) => ({
  panelsOpen: true,
  requestFilter: "all",
  helpOpen: false,
  manageOpen: false,
  manageTab: "map",
  newRequestOpen: false,
  placingRequest: null,
  pingArmed: false,
  textEditor: null,
  copyFallback: null,
  downloadBlocked: false,
  fullscreen: false,
  layersOpen: false,
  hiddenLayers: [],
  panelTab: "requests",
  sheetSnap: "peek",
  markerSheet: null,
  moreOpen: false,
  demoChipDismissed: false,
  freshIds: new Set(),
  demoPings: [],
  nodeListApi: null,
  viewportApi: null,
  set: (patch) => set(patch),
  openManage: (tab) => set({ manageOpen: true, manageTab: tab ?? get().manageTab }),
  markFresh: (ids) => {
    if (ids.length === 0) return;
    set((s) => ({ freshIds: new Set([...s.freshIds, ...ids]) }));
    setTimeout(() => {
      set((s) => {
        const next = new Set(s.freshIds);
        for (const id of ids) next.delete(id);
        return { freshIds: next };
      });
    }, FRESH_MS);
  },
  toggleLayer: (layer) =>
    set((s) => ({
      hiddenLayers: s.hiddenLayers.includes(layer)
        ? s.hiddenLayers.filter((l) => l !== layer)
        : [...s.hiddenLayers, layer],
    })),
}));

/** Test hook. */
export function resetUiStore(): void {
  useUiStore.setState({
    panelsOpen: true,
    requestFilter: "all",
    helpOpen: false,
    manageOpen: false,
    manageTab: "map",
    newRequestOpen: false,
    placingRequest: null,
    pingArmed: false,
    textEditor: null,
    copyFallback: null,
    downloadBlocked: false,
    fullscreen: false,
    layersOpen: false,
    hiddenLayers: [],
    panelTab: "requests",
    sheetSnap: "peek",
    markerSheet: null,
    moreOpen: false,
    demoChipDismissed: false,
    freshIds: new Set(),
    demoPings: [],
    nodeListApi: null,
    viewportApi: null,
  });
}

/** True while any modal surface of the app is open (single-key shortcuts pause). */
export const selectModalOpen = (s: UiState): boolean =>
  s.helpOpen ||
  s.manageOpen ||
  s.newRequestOpen ||
  s.copyFallback !== null ||
  s.downloadBlocked ||
  s.markerSheet !== null ||
  s.moreOpen;
