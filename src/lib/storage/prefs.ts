// `wardogs:prefs` (§5.4). Hand-written guard; defaults for anything missing.
import { TOOLS, type Tool } from "../map/types";
import { KEY_PREFS } from "./keys";
import { readJson, writeJson } from "./local";

export interface Prefs {
  v: 1;
  grid: boolean;
  showPings: boolean;
  sound: boolean;
  brief: boolean;
  lastTool: Tool;
  showRcon: boolean;
  demoChipDismissed: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  grid: true,
  showPings: true,
  sound: false,
  brief: false,
  lastTool: "select",
  showRcon: false,
  demoChipDismissed: false,
};

const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

export function loadPrefs(): Prefs {
  const raw = readJson<Record<string, unknown>>(KEY_PREFS);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const lastTool = (TOOLS as readonly string[]).includes(raw.lastTool as string)
    ? (raw.lastTool as Tool)
    : DEFAULT_PREFS.lastTool;
  return {
    v: 1,
    grid: bool(raw.grid, DEFAULT_PREFS.grid),
    showPings: bool(raw.showPings, DEFAULT_PREFS.showPings),
    sound: bool(raw.sound, DEFAULT_PREFS.sound),
    brief: bool(raw.brief, DEFAULT_PREFS.brief),
    lastTool,
    showRcon: bool(raw.showRcon, DEFAULT_PREFS.showRcon),
    demoChipDismissed: bool(raw.demoChipDismissed, DEFAULT_PREFS.demoChipDismissed),
  };
}

/** Merge a patch into the stored prefs; returns the new prefs. */
export function savePrefs(patch: Partial<Omit<Prefs, "v">>): Prefs {
  const next: Prefs = { ...loadPrefs(), ...patch, v: 1 };
  writeJson(KEY_PREFS, next);
  return next;
}
