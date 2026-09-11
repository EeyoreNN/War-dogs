import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

const link = "text-sm text-fg-muted transition-colors hover:text-fg";

/** 1 px accent rule at 30 %; lockup + version left, disclaimer centre (mono, muted), links right. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t border-accent/30", className)}>
      <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-16">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
            v{site.version}
          </span>
        </div>
        <p className="font-mono text-[12px] text-fg-muted lg:text-center">
          Fan-made. Not affiliated with {site.game.developer} or {site.game.publisher}.
        </p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:justify-end"
        >
          <a className={link} href={site.links.discord} target="_blank" rel="noopener noreferrer">
            Community Discord
          </a>
          <a className={link} href={site.links.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <Link className={link} href="/terms">
            Terms
          </Link>
          <Link className={link} href="/privacy">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
