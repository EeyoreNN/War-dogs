// The /create and /join page shell (§4.4, §4.5): masked grid background, centred column, lockup,
// H1 and a tier-3 panel with HUD corners. Server-renderable.
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export function FormShell({
  title,
  children,
  className,
  style,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="relative flex-1 bg-bg-0" style={style}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grid bg-grid-masked"
      />
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-[760px] flex-col items-center px-4 pt-10 pb-28 sm:px-6 sm:pt-16 sm:pb-16",
          className,
        )}
      >
        <Link href="/" aria-label={`${site.name} home`} className="rounded-sm">
          <Logo size="lg" />
        </Link>
        <h1 className="mt-6 text-center display display-2 text-balance text-fg">{title}</h1>
        <div className="hud-corners mt-8 w-full max-w-[640px] rounded-xl bg-bg-1/90 p-5 shadow-panel backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-line-strong" />
      <span className="font-mono text-[11px] tracking-[0.2em] text-fg-muted">OR</span>
      <span className="h-px flex-1 bg-line-strong" />
    </div>
  );
}

/** A group label that is not a <label> (radio groups carry `aria-label` themselves). */
export function GroupLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("mb-2 block label-mono text-fg-muted", className)}>{children}</span>;
}
