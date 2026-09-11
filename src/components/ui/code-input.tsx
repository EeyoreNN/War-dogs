"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Mirrors `isRoomCode` / `RESERVED_CODES` in src/lib/room/code.ts (WP1, §5.3) without importing it. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const RESERVED_CODES: readonly string[] = ["DEMO"];
const CELLS = 6;

/** Uppercase, strip everything outside `[A-Z2-9]`, cap at six characters. */
export function normalizeCodeInput(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, CELLS);
}

/** Enter submits a full valid code or a reserved one (`DEMO`). */
export function isSubmittableCode(value: string): boolean {
  return CODE_RE.test(value) || RESERVED_CODES.includes(value);
}

export interface CodeInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  error?: string;
  autoFocus?: boolean;
  /** Id of the first cell (so a `<label for>` / `Field` can point at it). */
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Six mono cells (`flex-1 min-w-0 max-w-12`, so six fit in 320 px): uppercase, paste support
 * (`x5gm-4q` / `X5GM 4Q`), auto-advance, Backspace steps back, Enter calls `onSubmit`.
 */
export function CodeInput({
  value,
  onChange,
  onSubmit,
  error,
  autoFocus,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: CodeInputProps) {
  const cellsRef = React.useRef<(HTMLInputElement | null)[]>([]);
  const code = normalizeCodeInput(value);
  const errorId = error ? `${id}-error` : undefined;
  const described = [errorId, describedBy].filter(Boolean).join(" ") || undefined;
  const isInvalid = Boolean(error) || invalid === true || invalid === "true";

  const focusCell = (index: number) => {
    const i = Math.max(0, Math.min(CELLS - 1, index));
    const el = cellsRef.current[i];
    el?.focus();
    el?.select();
  };

  const commit = (next: string) => {
    const clean = normalizeCodeInput(next);
    onChange(clean);
    focusCell(Math.min(clean.length, CELLS - 1));
  };

  const onCellChange = (index: number, raw: string) => {
    const typed = normalizeCodeInput(raw);
    if (!typed) return;
    commit(code.slice(0, index) + typed + code.slice(index + typed.length));
  };

  const onCellKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Backspace": {
        e.preventDefault();
        if (code[index]) {
          onChange(code.slice(0, index) + code.slice(index + 1));
          focusCell(index);
        } else {
          onChange(code.slice(0, -1));
          focusCell(index - 1);
        }
        return;
      }
      case "ArrowLeft":
        e.preventDefault();
        focusCell(index - 1);
        return;
      case "ArrowRight":
        e.preventDefault();
        focusCell(index + 1);
        return;
      case "Enter":
        if (onSubmit && isSubmittableCode(code)) {
          e.preventDefault();
          onSubmit();
        }
        return;
      default:
        return;
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    commit(e.clipboardData.getData("text"));
  };

  return (
    <div>
      <div className={cn("flex gap-2", error && "animate-shake")}>
        {Array.from({ length: CELLS }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              cellsRef.current[i] = el;
            }}
            id={i === 0 ? id : `${id}-${i + 1}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={code[i] ?? ""}
            aria-label={`Character ${i + 1} of ${CELLS}`}
            aria-invalid={isInvalid || undefined}
            aria-describedby={described}
            onChange={(e) => onCellChange(i, e.target.value)}
            onKeyDown={(e) => onCellKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(
              "h-14 max-w-12 min-w-0 flex-1 rounded-md border border-line-strong bg-bg-1 text-center font-mono text-xl tracking-[0.3em] text-fg uppercase transition-colors outline-none placeholder:text-fg-faint focus:border-accent",
              isInvalid && "border-danger",
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
