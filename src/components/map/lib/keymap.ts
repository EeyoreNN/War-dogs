// Appendix A — the single source of the keyboard and gesture map, rendered in Controls & help.
// `Mod` is replaced by the platform modifier through <Kbd>.
import { MARKER_KINDS, MARKER_META, type MarkerKind, type Tool } from "@/lib/map/types";

export interface KeymapRow {
  keys: string[];
  action: string;
  context: string;
}

export const KEYMAP: readonly KeymapRow[] = [
  {
    keys: ["V", "P", "A", "L", "C", "R", "T", "M"],
    action: "select, pen, arrow, line, circle, rect, text, measure",
    context: "tools",
  },
  {
    keys: ["1–8"],
    action: "FOB, Rally, LZ, OBJ, Enemy FOB, Enemy troops, Danger, Pin",
    context: "markers (also 1–4 = kind inside the New request dialog)",
  },
  { keys: ["N"], action: "new request", context: "anywhere in the app" },
  {
    keys: ["X", "Shift+X"],
    action:
      "arm the ping tool (next click or tap pings; Enter pings at the crosshair; Esc disarms); Shift+X pings at the crosshair now",
    context: "anywhere",
  },
  {
    keys: ["G", "F", "0", "+", "−"],
    action: "grid, fullscreen, fit, zoom in, zoom out",
    context: "view",
  },
  { keys: ["B"], action: "brief mode", context: "anywhere" },
  { keys: ["Mod+Z", "Mod+Shift+Z", "Ctrl+Y"], action: "undo, redo", context: "own ops" },
  {
    keys: ["Mod+C"],
    action: "copy room link",
    context: "map focused, nothing selected, no text selection",
  },
  { keys: ["Mod+Shift+E"], action: "export PNG", context: "command roles" },
  { keys: ["Delete", "Backspace"], action: "remove selection", context: "selection" },
  {
    keys: ["Arrow keys"],
    action: "pan map / nudge selection 1 % (Shift 5 %) / move in node list",
    context: "map focused",
  },
  {
    keys: ["Enter"],
    action:
      "place the current marker at the crosshair / set point A then B for shapes, lines, measure / start and commit a pen stroke / open the text input / commit text / rename",
    context: "map focused / editing",
  },
  {
    keys: ["Esc"],
    action: "cancel placement, deselect, close dialog or sheet",
    context: "anywhere",
  },
  { keys: ["?"], action: "Controls & help", context: "anywhere" },
  {
    keys: ["Space+drag", "middle-drag", "wheel", "Ctrl+wheel"],
    action: "pan, pan, zoom, zoom",
    context: "pointer",
  },
  {
    keys: ["Shift+drag"],
    action: "snap 15° / constrain square-circle",
    context: "line, arrow, measure, rect, circle",
  },
  {
    keys: ["One finger", "two fingers", "long-press", "double-tap"],
    action: "tool / pan+zoom / marker palette / ping (on empty map)",
    context: "touch",
  },
];

export const TOOL_HOTKEY: Record<
  Exclude<Tool, "marker" | "request" | "ping">,
  { key: string; label: string }
> = {
  select: { key: "v", label: "Select" },
  pen: { key: "p", label: "Pen" },
  arrow: { key: "a", label: "Arrow" },
  line: { key: "l", label: "Line" },
  circle: { key: "c", label: "Circle" },
  rect: { key: "r", label: "Rect" },
  text: { key: "t", label: "Text" },
  measure: { key: "m", label: "Measure" },
};

/** Marker kind for a digit key `1`–`8` in palette order, else null. */
export function markerForDigit(key: string): MarkerKind | null {
  if (!/^[1-8]$/.test(key)) return null;
  const kind = MARKER_KINDS[Number(key) - 1];
  return MARKER_META[kind].hotkey === key ? kind : null;
}

/** Tool for a single letter hotkey (case-insensitive), else null. */
export function toolForKey(key: string): Tool | null {
  const k = key.toLowerCase();
  for (const [tool, def] of Object.entries(TOOL_HOTKEY)) if (def.key === k) return tool as Tool;
  return null;
}

/** True when the event target is a text field, so single-key shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "submit", "range", "file"].includes(type);
  }
  return false;
}
