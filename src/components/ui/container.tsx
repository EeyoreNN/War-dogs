import * as React from "react";
import { cn } from "@/lib/utils";

/** Page gutter: 24 px on phones, 40 px tablets, 64 px desktop, capped at 1280 px (§2.2). */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16", className)}
      {...props}
    />
  );
}
