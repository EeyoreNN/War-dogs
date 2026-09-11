"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  body: string;
  icon?: React.ReactNode;
}

/** `role="radiogroup"` of card-sized options; arrow keys move the selection. */
export function RadioCards<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 1,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: RadioCardOption<T>[];
  columns?: 1 | 2;
  "aria-label": string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = options.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % n;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}
    >
      <input type="hidden" name={name} value={value} />
      {options.map((o, i) => {
        const checked = o.value === value;
        const focusable = checked || (checkedIndex === -1 && i === 0);
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="flex items-start gap-3 panel p-4 text-left transition-colors hover:border-line-hi aria-checked:border-accent aria-checked:bg-accent-soft"
          >
            {o.icon ? (
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-accent">
                {o.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block display display-4 text-fg">{o.title}</span>
              <span className="mt-1 block text-sm text-fg-muted">{o.body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
