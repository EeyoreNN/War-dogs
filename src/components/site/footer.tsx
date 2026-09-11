import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-line", className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-20">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
            v{site.version}
          </span>
        </div>
        <p className="text-sm text-fg-faint">
          Fan-made. Not affiliated with {site.game.developer} or {site.game.publisher}.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <a
            className="text-fg-muted transition-colors hover:text-fg"
            href={site.links.discord}
            target="_blank"
            rel="noopener noreferrer"
          >
            Community Discord
          </a>
          <a
            className="text-fg-muted transition-colors hover:text-fg"
            href={site.links.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <Link className="text-fg-muted transition-colors hover:text-fg" href="/terms">
            Terms
          </Link>
          <Link className="text-fg-muted transition-colors hover:text-fg" href="/privacy">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
