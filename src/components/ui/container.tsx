import * as React from "react";
import { cn } from "@/lib/utils";

/** Page gutter: 24px on phones, 40px tablets, 80px desktop, capped at 1440px. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-20", className)}
      {...props}
    />
  );
}
