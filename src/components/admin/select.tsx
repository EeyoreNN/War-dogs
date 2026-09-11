import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A native `<select>` styled like `Input` (dashboard forms only). */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-md border border-line-strong bg-bg-1 pr-10 pl-4 text-[15px] text-fg transition-colors outline-none focus:border-accent",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fg-faint"
      />
    </span>
  );
});

export function SectionHeading({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="display display-4 text-fg">{title}</h2>
        {children ? <p className="mt-1 text-sm text-fg-muted">{children}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const th = "py-2 pr-3 text-left font-medium whitespace-nowrap";
export const thNum = "py-2 pr-3 text-right font-medium whitespace-nowrap";
export const td = "py-2.5 pr-3 align-middle";
export const tdNum = "py-2.5 pr-3 text-right mono-data align-middle";
export const zebra = "border-t border-line odd:bg-[rgba(255,255,255,0.02)]";
