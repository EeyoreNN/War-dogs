import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "discord" | "icon" | "chip";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-accent-hover active:bg-accent-active focus-visible:outline-offset-[3px] focus-visible:shadow-[0_0_0_1px_var(--bg-0),inset_0_1px_0_rgba(255,255,255,0.3)]",
  secondary:
    "border border-line-strong bg-bg-1 text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-line-hi hover:bg-bg-2",
  ghost: "text-fg-muted hover:bg-bg-2 hover:text-fg",
  danger: "border border-danger/40 bg-danger/15 text-danger hover:bg-danger/25",
  discord:
    "bg-[#5865F2] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[#6a76f4]",
  /* 40 x 40 ghost tool button; `active` -> amber wash + a 2 px left accent rule */
  icon: "text-fg-muted hover:bg-bg-2 hover:text-fg aria-pressed:bg-accent-soft aria-pressed:text-accent aria-pressed:shadow-[inset_2px_0_0_var(--accent)]",
  /* h-8 filter chip; `active` (selected) -> solid amber */
  chip: "h-8 rounded-sm border border-line-strong bg-bg-1 px-3 font-mono text-[11px] font-medium tracking-[0.14em] text-fg-muted hover:border-line-hi hover:text-fg aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink",
};

/* md is 40 px with a pointer, 44 px on touch; icon is the 40 px rail size */
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-10 px-5 text-[13px] pointer-coarse:min-h-11",
  lg: "h-13 px-7 text-[14px]",
  icon: "h-10 w-10 p-0",
};

function resolveSize(variant: ButtonVariant, size: ButtonSize): ButtonSize {
  if (variant === "icon") return "icon";
  if (variant === "chip") return "sm";
  return size;
}

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[resolveSize(variant, size)], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the label for a three-dot pulse, locks the width and sets `aria-busy`. */
  loading?: boolean;
  /** Pressed / selected state (`aria-pressed`); styled by the `icon` and `chip` variants. */
  active?: boolean;
  /** Trailing keycap hint, e.g. `"P"` or `"Mod+Z"`. */
  kbd?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    type = "button",
    loading = false,
    active,
    kbd,
    children,
    onClick,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      aria-pressed={active === undefined ? undefined : active}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span
            aria-hidden="true"
            className="absolute inset-0 inline-flex items-center justify-center gap-1"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
          <span className="sr-only">Loading</span>
        </>
      ) : (
        <>
          {children}
          {kbd ? <Kbd className="ml-1 text-current opacity-80">{kbd}</Kbd> : null}
        </>
      )}
    </button>
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Anchor styled as a button. External hrefs get target/rel automatically. */
export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: ButtonLinkProps) {
  const external = typeof href === "string" && /^https?:\/\//.test(href);
  return (
    <Link
      href={href}
      className={buttonClasses(variant, size, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}
