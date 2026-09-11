"use client";

// The visible node list (§4.3.10): a `role="listbox"` after the map in tab order, collapsed to a
// one-line disclosure and expanded on keyboard focus. Arrow keys move (selection follows and the
// map centres), Shift+arrows nudge, Delete removes, Enter renames markers / text.
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { canDraw } from "@/lib/map/roster";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { nudgeNode, removeNodes } from "./actions";
import { describeNode, isEditable, nodeAnchor } from "./lib/describe";
import { widthMetresFor } from "./lib/zone";
import { useUiStore } from "./ui-store";

export function NodeList({ className }: { className?: string }) {
  const state = useRoomStore((s) => s.state);
  const me = useRoomStore(selectMe);
  const selection = useRoomStore((s) => s.selection);
  const select = useRoomStore((s) => s.select);
  const brief = useRoomStore((s) => s.brief);
  const api = useUiStore((s) => s.viewportApi);
  const uiSet = useUiStore((s) => s.set);
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const ids = state?.order ?? [];
  const count = ids.length;
  const widthMetres = state ? widthMetresFor(state.settings) : null;
  const allowed = state ? canDraw(me, state.settings) && !brief : false;

  const activeIndex = Math.max(0, selection ? ids.indexOf(selection) : 0);

  React.useEffect(() => {
    const api = {
      focus() {
        setOpen(true);
        requestAnimationFrame(() => listRef.current?.focus());
      },
    };
    useUiStore.getState().set({ nodeListApi: api });
    return () => useUiStore.getState().set({ nodeListApi: null });
  }, []);

  const focusOption = (i: number) => {
    const id = ids[i];
    if (!id || !state) return;
    select(id);
    api?.centreOn(nodeAnchor(state.nodes[id]));
    listRef.current?.querySelector<HTMLElement>(`[data-option="${id}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!state) return;
    const i = activeIndex;
    const step = e.shiftKey ? 0.05 : 0.01;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (e.shiftKey && selection && allowed) {
          nudgeNode(selection, 0, e.key === "ArrowDown" ? step : -step);
          return;
        }
        focusOption(e.key === "ArrowDown" ? Math.min(count - 1, i + 1) : Math.max(0, i - 1));
        return;
      }
      case "ArrowLeft":
      case "ArrowRight":
        if (e.shiftKey && selection && allowed) {
          e.preventDefault();
          nudgeNode(selection, e.key === "ArrowRight" ? step : -step, 0);
        }
        return;
      case "Home":
        e.preventDefault();
        focusOption(0);
        return;
      case "End":
        e.preventDefault();
        focusOption(count - 1);
        return;
      case "Delete":
      case "Backspace":
        if (selection && allowed) {
          e.preventDefault();
          const next = ids[Math.min(count - 2, i)] ?? null;
          removeNodes([selection]);
          if (next && next !== selection) select(next);
        }
        return;
      case "Enter": {
        const id = selection ?? ids[i];
        const n = id ? state.nodes[id] : null;
        if (n && isEditable(n) && allowed) {
          e.preventDefault();
          uiSet({
            textEditor: {
              at: n.at,
              nodeId: n.id,
              initial: n.t === "marker" ? n.label : n.text,
              kind: n.t === "marker" ? "label" : "text",
            },
          });
        }
        return;
      }
      case "Escape":
        setOpen(false);
        return;
      default:
        return;
    }
  };

  return (
    <div
      className={cn("shrink-0 border-t border-line bg-bg-1", className)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="node-list"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-1.5 px-3 text-left font-mono text-[11px] tracking-[0.12em] text-fg-muted uppercase hover:text-fg"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-90")}
        />
        Things on the map ({count})
      </button>
      <div
        id="node-list"
        ref={listRef}
        role="listbox"
        aria-label="Things on the map"
        aria-activedescendant={selection ? `node-opt-${selection}` : undefined}
        tabIndex={0}
        hidden={!open}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target === e.currentTarget && count) focusOption(activeIndex);
        }}
        className="max-h-40 scrollbar-thin overflow-y-auto outline-none"
      >
        {count === 0 ? (
          <p className="px-3 pb-2 text-sm text-fg-muted">Nothing on the map yet.</p>
        ) : (
          ids.map((id) => {
            const n = state!.nodes[id];
            return (
              <div
                key={id}
                id={`node-opt-${id}`}
                data-option={id}
                role="option"
                aria-selected={selection === id}
                tabIndex={-1}
                onClick={() => {
                  select(id);
                  api?.centreOn(nodeAnchor(n));
                }}
                className={cn(
                  "cursor-default truncate px-3 py-1 text-[13px] text-fg-muted hover:bg-bg-2 focus-visible:bg-bg-2",
                  selection === id && "bg-accent-soft text-fg",
                )}
              >
                {describeNode(n, widthMetres)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
