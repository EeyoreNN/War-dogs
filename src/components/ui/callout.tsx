import * as React from "react";
import { Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutTone = "note" | "warning" | "danger";

const tones: Record<
  CalloutTone,
  {
    box: string;
    icon: React.ComponentType<{
      size?: number;
      className?: string;
      "aria-hidden"?: boolean | "true";
    }>;
    iconClass: string;
  }
> = {
  note: { box: "border-l-accent bg-accent-soft", icon: Info, iconClass: "text-accent" },
  warning: { box: "border-l-warn bg-warn/10", icon: TriangleAlert, iconClass: "text-warn" },
  danger: {
    box: "border-l-danger bg-danger/10",
    icon: OctagonAlert,
    iconClass: "text-danger-text",
  },
};

export function Callout({
  tone = "note",
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, iconClass } = tones[tone];
  return (
    <aside
      role="note"
      className={cn(
        "flex gap-3 rounded-md border-l-[3px] px-4 py-3 text-[15px] leading-relaxed text-fg",
        box,
        className,
      )}
    >
      <Icon size={18} aria-hidden="true" className={cn("mt-0.5 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-1 label-mono text-fg">{title}</p> : null}
        <div className="text-fg-muted [&_a]:text-fg [&_a]:underline [&_strong]:text-fg">
          {children}
        </div>
      </div>
    </aside>
  );
}
