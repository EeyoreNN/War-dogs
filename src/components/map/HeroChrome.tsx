// The hero frame's own 32 px top bar (§4.1): mark, mono `WAR ROOM DEMO`, LIVE pip. Shared by
// HeroStatic (server) and HeroPlayer (client) so the swap is seamless.
import { LogoMark } from "@/components/ui/logo";

export function HeroChrome() {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-line bg-bg-1/95 px-3">
      <div className="flex items-center gap-2">
        <LogoMark size={16} />
        <span className="font-mono text-[10px] tracking-[0.18em] text-fg-muted uppercase">
          War room
        </span>
        <span className="rounded-sm bg-bg-2 px-1.5 font-mono text-[11px] font-medium tracking-[0.12em] text-fg">
          DEMO
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-ok/40 bg-ok/10 scanlines px-1.5 py-px font-mono text-[10px] tracking-[0.16em] text-ok uppercase">
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-ok" />
        Live
      </span>
    </div>
  );
}
