import { describe, expect, it } from "vitest";
import { createHistory, popRedo, popUndo, pushHistory, HISTORY_CAP } from "./history";
import { op, marker, A } from "./test-fixtures";
import type { HistoryEntry } from "./history";

const entry = (n: number): HistoryEntry => ({
  op: op({ t: "node.add", nodes: [marker(`M${n}`)] }, n, A),
  inverse: [{ t: "node.remove", ids: [`M${n}`] }],
});

describe("history", () => {
  it("undo pops the last entry to redo and redo pushes it back", () => {
    let h = pushHistory(createHistory(), entry(1));
    h = pushHistory(h, entry(2));
    const u = popUndo(h);
    expect(u.entry?.inverse).toEqual([{ t: "node.remove", ids: ["M2"] }]);
    expect(u.history.undo.length).toBe(1);
    expect(u.history.redo.length).toBe(1);
    const r = popRedo(u.history);
    expect(r.entry?.op.t).toBe("node.add");
    expect(r.history.undo.length).toBe(2);
    expect(r.history.redo.length).toBe(0);
    expect(popRedo(r.history).entry).toBeNull();
    expect(popUndo(createHistory()).entry).toBeNull();
  });
  it("caps at 200 and clears redo on a new push", () => {
    let h = createHistory();
    for (let i = 0; i < HISTORY_CAP + 10; i++) h = pushHistory(h, entry(i));
    expect(h.undo.length).toBe(HISTORY_CAP);
    expect(h.undo[0].op.seq).toBe(10);
    const u = popUndo(h);
    expect(u.history.redo.length).toBe(1);
    const pushed = pushHistory(u.history, entry(999));
    expect(pushed.redo).toEqual([]);
    expect(pushHistory(createHistory(), entry(1), 1).undo.length).toBe(1);
  });
});
