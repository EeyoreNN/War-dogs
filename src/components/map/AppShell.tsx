// The server-rendered app shell (§4.2, §4.3): the same chrome boxes the live app draws — top bar
// 48 px, rail 80 px, panels 320 px on desktop; 44 px top bar and a 56 px bottom bar on phones —
// so MapApp mounts in place with no layout shift. No hooks: server components render it.
import { Package, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export const RAIL_SKELETON = 9;

export function AppShellStatic({
  code,
  badge,
  centre,
  children,
  className,
}: {
  code: string;
  badge?: string;
  /** `ZESTAFONA · DEFAULT` */
  centre?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-app-shell=""
      className={cn("flex h-dvh flex-col overflow-hidden bg-bg-0 text-fg", className)}
      aria-hidden="true"
    >
      <div className="hud-corners flex h-11 shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-3 md:h-12">
        <LogoMark size={22} />
        <span className="hidden font-mono text-[11px] tracking-[0.18em] text-fg-muted uppercase md:inline">
          War room
        </span>
        <span className="inline-flex h-8 items-center gap-2 rounded-md bg-bg-2 px-2.5 font-mono text-[14px] font-medium tracking-[0.12em] text-fg">
          {code}
        </span>
        {badge ? <Badge tone="accent">{badge}</Badge> : null}
        {centre ? (
          <span className="mx-auto hidden font-mono text-[11px] tracking-[0.16em] text-fg-muted uppercase md:inline">
            {centre}
          </span>
        ) : (
          <span className="mx-auto" />
        )}
        <Badge tone="muted">Connecting…</Badge>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-20 shrink-0 flex-col items-center gap-2 border-r border-line bg-bg-1 py-3 md:flex">
          {Array.from({ length: RAIL_SKELETON }, (_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-md" />
          ))}
        </div>
        <div className="relative min-w-0 flex-1 bg-bg-0">{children}</div>
        <div className="hidden w-80 shrink-0 flex-col border-l border-line bg-bg-1 md:flex">
          <div className="flex h-12 items-center gap-2 border-b border-line px-4">
            <Package size={16} className="text-fg-muted" />
            <span className="label-mono text-fg">Requests</span>
          </div>
          <div className="flex-1" />
          <div className="flex h-12 items-center gap-2 border-t border-b border-line px-4">
            <Users size={16} className="text-fg-muted" />
            <span className="label-mono text-fg">Roster</span>
          </div>
          <div className="flex-1" />
          <div className="px-4 py-2 font-mono text-[10px] text-fg-faint">v{site.version}</div>
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-line bg-bg-1 md:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/** Centred square map box for the static shells (the live app fits the same box). */
export function ShellMapArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-0">
      <div
        className="relative aspect-square max-h-full max-w-full"
        style={{ width: "min(100%, 100dvh)" }}
      >
        {children}
      </div>
    </div>
  );
}
