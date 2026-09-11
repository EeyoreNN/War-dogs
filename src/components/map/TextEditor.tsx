"use client";

// Inline text / label editor (§4.3.3): a foreignObject in the world group, screen-constant, with
// Enter to commit, Shift+Enter for a newline (text only), Esc to cancel. Never exported.
import * as React from "react";
import { MAX_LABEL_CHARS, MAX_TEXT_CHARS, MAX_TEXT_LINES, type Point } from "@/lib/map/types";
import { screenTransform } from "./lib/screen";

export function clampText(value: string, kind: "text" | "label"): string {
  if (kind === "label") return value.replace(/\n/g, " ").slice(0, MAX_LABEL_CHARS);
  const lines = value.split("\n").slice(0, MAX_TEXT_LINES);
  return lines.join("\n").slice(0, MAX_TEXT_CHARS);
}

export function TextEditor({
  at,
  kind,
  initial,
  onCommit,
  onCancel,
}: {
  at: Point;
  kind: "text" | "label";
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(clampText(value, kind).trim());
    else onCancel();
  };

  return (
    <foreignObject
      data-export="skip"
      x={0}
      y={0}
      width={1}
      height={1}
      style={{ overflow: "visible" }}
    >
      <div
        data-screen=""
        style={{
          transform: screenTransform(at),
          transformOrigin: "0 0",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        <textarea
          ref={ref}
          aria-label={kind === "label" ? "Marker label" : "Text on the map"}
          rows={kind === "label" ? 1 : 2}
          value={value}
          maxLength={kind === "label" ? MAX_LABEL_CHARS : MAX_TEXT_CHARS}
          onChange={(e) => setValue(clampText(e.target.value, kind))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            } else if (e.key === "Enter" && (kind === "label" || !e.shiftKey)) {
              e.preventDefault();
              finish(true);
            }
          }}
          onBlur={() => finish(true)}
          onPointerDown={(e) => e.stopPropagation()}
          className="block w-56 resize-none rounded-md border border-accent bg-bg-1/95 px-2 py-1 font-sans text-[15px] leading-snug text-fg shadow-panel outline-none"
          style={{ marginTop: kind === "label" ? 20 : -14 }}
        />
      </div>
    </foreignObject>
  );
}
