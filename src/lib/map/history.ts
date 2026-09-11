// Undo / redo stacks (§3.4). Undo emits the inverse bodies as NEW ops; shared state is never rewound.
import type { Op, OpBody } from "./types";

export interface HistoryEntry {
  op: Op;
  inverse: OpBody[];
}
export interface History {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export const HISTORY_CAP = 200;

export function createHistory(): History {
  return { undo: [], redo: [] };
}

/** Push onto the undo stack (cap 200, oldest dropped) and clear redo. */
export function pushHistory(h: History, entry: HistoryEntry, cap = HISTORY_CAP): History {
  const undo = h.undo.length >= cap ? h.undo.slice(h.undo.length - cap + 1) : h.undo.slice();
  undo.push(entry);
  return { undo, redo: [] };
}

export function popUndo(h: History): { history: History; entry: HistoryEntry | null } {
  if (h.undo.length === 0) return { history: h, entry: null };
  const entry = h.undo[h.undo.length - 1];
  return { history: { undo: h.undo.slice(0, -1), redo: [...h.redo, entry] }, entry };
}

export function popRedo(h: History): { history: History; entry: HistoryEntry | null } {
  if (h.redo.length === 0) return { history: h, entry: null };
  const entry = h.redo[h.redo.length - 1];
  return { history: { undo: [...h.undo, entry], redo: h.redo.slice(0, -1) }, entry };
}
