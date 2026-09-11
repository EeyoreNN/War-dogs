"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "right" | "bottom" | "left";

const HOVER_DELAY_MS = 400;

const sides: Record<Side, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
};

type ChildProps = {
  "aria-describedby"?: string;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
  onFocus?: React.FocusEventHandler;
  onBlur?: React.FocusEventHandler;
  onKeyDown?: React.KeyboardEventHandler;
};

/**
 * Wraps one focusable child. The tooltip shows after 400 ms of hover or immediately on focus,
 * hides on blur / mouse leave / Escape, and is wired through `aria-describedby`.
 */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: Side;
  children: React.ReactElement<ChildProps>;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (delay: number) => {
    clear();
    if (delay > 0) timer.current = setTimeout(() => setOpen(true), delay);
    else setOpen(true);
  };
  const hide = () => {
    clear();
    setOpen(false);
  };

  React.useEffect(() => clear, []);

  const props = children.props;
  const child = React.cloneElement(children, {
    "aria-describedby": [props["aria-describedby"], id].filter(Boolean).join(" "),
    onMouseEnter: (e: React.MouseEvent) => {
      props.onMouseEnter?.(e);
      show(HOVER_DELAY_MS);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      props.onFocus?.(e);
      show(0);
    },
    onBlur: (e: React.FocusEvent) => {
      props.onBlur?.(e);
      hide();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      props.onKeyDown?.(e);
      if (e.key === "Escape") hide();
    },
  });

  return (
    <span className="relative inline-flex">
      {child}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          "pointer-events-none absolute z-50 rounded-sm border border-line-strong bg-bg-2 px-2 py-1 font-mono text-[11px] leading-4 tracking-[0.06em] whitespace-nowrap text-fg shadow-panel",
          sides[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}
