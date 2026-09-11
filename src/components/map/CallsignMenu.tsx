"use client";

// The callsign menu in the top bar (§4.3.2): Change callsign, Change focus, Ink colour, Leave room.
import * as React from "react";
import { ChevronDown, LogOut, Palette, Pencil, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CallsignSchema } from "@/lib/map/schema";
import { INK_COLORS, INK_HEX, INK_LABEL, type Focus, type InkColor } from "@/lib/map/types";
import { generateCallsign } from "@/lib/storage/identity";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/store/room";
import { useMapApp } from "./context";
import { initialOf } from "./lib/format";
import { FocusGrid } from "./forms/FocusPicker";

type Menu = "closed" | "open" | "callsign" | "focus" | "ink";

export function CallsignMenu({ compact }: { compact: boolean }) {
  const me = useRoomStore((s) => s.me);
  const updateIdentity = useRoomStore((s) => s.updateIdentity);
  const leave = useRoomStore((s) => s.leave);
  const { mode, go, rejoin } = useMapApp();
  const [menu, setMenu] = React.useState<Menu>("closed");
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const callsign = me?.callsign ?? "";

  React.useEffect(() => {
    if (menu !== "open") return;
    const onDoc = (e: PointerEvent) => {
      if (
        !listRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      )
        setMenu("closed");
    };
    document.addEventListener("pointerdown", onDoc);
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menu]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n =
        e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[n]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenu("closed");
      btnRef.current?.focus();
    }
  };

  const item = (label: string, icon: React.ReactNode, onSelect: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenu("closed");
        onSelect();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-fg hover:bg-bg-2 focus-visible:bg-bg-2",
        danger && "text-danger-text",
      )}
    >
      <span aria-hidden="true" className="text-fg-muted">
        {icon}
      </span>
      {label}
    </button>
  );

  const saveCallsign = () => {
    const r = CallsignSchema.safeParse(draft);
    if (!r.success) {
      setError("2 to 24 characters.");
      return;
    }
    updateIdentity({ callsign: r.data });
    setMenu("closed");
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu === "open"}
        aria-label={compact ? `${callsign}: your callsign menu` : undefined}
        onClick={() => setMenu(menu === "open" ? "closed" : "open")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md text-sm font-semibold text-fg hover:bg-bg-2",
          compact ? "w-8 justify-center bg-bg-2 font-mono" : "px-2",
        )}
      >
        {compact ? (
          <span aria-hidden="true">{initialOf(callsign)}</span>
        ) : (
          <>
            <span className="max-w-[140px] truncate">{callsign}</span>
            <ChevronDown size={14} aria-hidden="true" className="text-fg-muted" />
          </>
        )}
      </button>
      {menu === "open" ? (
        <div
          ref={listRef}
          role="menu"
          aria-label="Your callsign"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-50 mt-1 w-52 overflow-hidden rounded-md border border-line-strong bg-bg-1 py-1 shadow-panel"
        >
          {item("Change callsign", <Pencil size={15} />, () => {
            setDraft(callsign);
            setError(undefined);
            setMenu("callsign");
          })}
          {item("Change focus", <Target size={15} />, () => setMenu("focus"))}
          {item("Ink colour", <Palette size={15} />, () => setMenu("ink"))}
          <div className="my-1 border-t border-line" />
          {item(
            "Leave room",
            <LogOut size={15} />,
            () => {
              if (mode === "activity") rejoin();
              else {
                leave();
                go("/");
              }
            },
            true,
          )}
        </div>
      ) : null}

      <Dialog
        open={menu === "callsign"}
        onClose={() => setMenu("closed")}
        title="Change callsign"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMenu("closed")}>
              Cancel
            </Button>
            <Button onClick={saveCallsign}>Save</Button>
          </>
        }
      >
        <Field
          label="Callsign"
          htmlFor="callsign-edit"
          error={error}
          trailing={
            <Button
              variant="chip"
              onClick={() => setDraft(generateCallsign())}
              aria-label="Generate a callsign"
            >
              Dice
            </Button>
          }
        >
          <Input
            value={draft}
            maxLength={24}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCallsign();
            }}
          />
        </Field>
      </Dialog>

      <Dialog
        open={menu === "focus"}
        onClose={() => setMenu("closed")}
        title="Change focus"
        size="sm"
        description="What you are doing this match. Optional."
      >
        <FocusGrid
          value={me?.focus ?? null}
          onChange={(f: Focus | null) => {
            updateIdentity({ focus: f });
            setMenu("closed");
          }}
        />
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updateIdentity({ focus: null });
              setMenu("closed");
            }}
          >
            No focus
          </Button>
        </div>
      </Dialog>

      <Dialog open={menu === "ink"} onClose={() => setMenu("closed")} title="Ink colour" size="sm">
        <div role="radiogroup" aria-label="Ink colour" className="flex flex-wrap gap-2">
          {INK_COLORS.map((c: InkColor) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={me?.ink === c}
              aria-label={INK_LABEL[c]}
              onClick={() => {
                updateIdentity({ ink: c });
                setMenu("closed");
              }}
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-bg-2 aria-checked:bg-bg-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 rounded-full",
                  me?.ink === c && "ring-2 ring-fg ring-offset-2 ring-offset-bg-1",
                )}
                style={{ background: INK_HEX[c] }}
              />
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-fg-muted">Your ink colours your strokes and pings.</p>
      </Dialog>
    </div>
  );
}
