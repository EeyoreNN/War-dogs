"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveCodeRoute } from "./logic";
import { normalizeCode } from "./room-api.stub";

export interface CodeFieldProps {
  id: string;
  /** Visible label text; `"Have a code?"` on the home page and the 404. */
  label?: string;
  className?: string;
  /** Larger cells for the 404 page. */
  size?: "md" | "lg";
}

/**
 * The inline "Have a code?" form (§4.1): one mono uppercase `Input` with an icon submit.
 * Enter goes to `/room/<CODE>`, `/demo` for `DEMO`, otherwise shows the inline error.
 * Without JavaScript it submits as `GET /join?code=` (progressive enhancement).
 */
export function CodeField({ id, label = "Have a code?", className, size = "md" }: CodeFieldProps) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const errorId = `${id}-error`;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = resolveCodeRoute(value);
    if (result.ok) {
      setError(null);
      router.push(result.href);
    } else {
      setError(result.error);
      setShake((n) => n + 1);
    }
  };

  return (
    <form
      action="/join"
      method="get"
      noValidate
      onSubmit={onSubmit}
      className={cn("flex flex-col gap-2", className)}
    >
      <label htmlFor={id} className="label-mono">
        {label}
      </label>
      <div
        key={shake}
        className={cn("flex items-stretch gap-2", error && shake > 0 && "animate-shake")}
      >
        <input
          id={id}
          name="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABC234"
          aria-label="War room code"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(e) => {
            setValue(normalizeCode(e.target.value).slice(0, 6));
            if (error) setError(null);
          }}
          className={cn(
            "min-w-0 flex-1 rounded-md border border-line-strong bg-bg-1 font-mono tracking-[0.3em] text-fg uppercase transition-colors placeholder:tracking-[0.3em] placeholder:text-fg-faint focus:border-accent",
            size === "lg" ? "h-13 px-4 text-lg" : "h-12 px-4 text-[15px]",
            error && "border-danger",
          )}
        />
        <button
          type="submit"
          aria-label="Open war room"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md border border-line-strong bg-bg-1 text-fg transition-colors hover:border-line-hi hover:bg-bg-2",
            size === "lg" ? "h-13 w-13" : "h-12 w-12",
          )}
        >
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
