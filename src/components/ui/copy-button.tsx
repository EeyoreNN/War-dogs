"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./button";
import { announce } from "./live-region";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const COPIED_MS = 2000;

/**
 * Copies `text`; the icon swaps to a check for 2 s and "Copied" is announced once. When the
 * clipboard API is unavailable (insecure context, old WebView) it degrades to a selectable input.
 */
export function CopyButton({
  text,
  label = "Copy",
  size = "md",
  variant = "ghost",
  className,
  onCopied,
}: {
  text: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary" | "chip";
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [fallback, setFallback] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  React.useEffect(() => {
    if (fallback) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallback]);

  const copy = async () => {
    if (!(await copyText(text))) {
      setFallback(true);
      return;
    }
    setCopied(true);
    announce("Copied");
    onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  if (fallback) {
    return (
      <input
        ref={fallbackRef}
        readOnly
        value={text}
        aria-label={`${label}: select the text and copy it`}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-8 max-w-full rounded-sm border border-line-strong bg-bg-1 px-2 font-mono text-[12px] text-fg",
          className,
        )}
      />
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={className}
    >
      {copied ? (
        <Check size={16} aria-hidden="true" className="text-ok" />
      ) : (
        <Copy size={16} aria-hidden="true" />
      )}
      <span>{copied ? "Copied" : label}</span>
    </Button>
  );
}
