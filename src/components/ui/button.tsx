import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "discord";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-active shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
  secondary:
    "border border-line-strong bg-bg-1 text-fg hover:border-line-hi hover:bg-bg-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-2",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
  discord:
    "bg-[#5865F2] text-white hover:bg-[#6a76f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-11 px-5 text-[13px]",
  lg: "h-13 px-7 text-[14px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props} />
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
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
