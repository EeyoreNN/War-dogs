import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "min-h-24 w-full rounded-md border border-line-strong bg-bg-1 px-4 py-3 text-[15px] leading-relaxed text-fg transition-colors outline-none placeholder:text-fg-faint focus:border-accent aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
});
