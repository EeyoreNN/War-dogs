"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { DiscordIcon } from "@/components/ui/icons";
import { nav, site } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  // The menu is "open for" a pathname; navigating away closes it without an effect.
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) =>
      setOpenFor((prev) => {
        const wasOpen = prev === pathname;
        const willOpen = typeof next === "function" ? next(wasOpen) : next;
        return willOpen ? pathname : null;
      }),
    [pathname],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  return (
    <header className={cn("relative z-40", className)}>
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-10 lg:px-20 lg:py-7">
        <Link href="/" aria-label={`${site.name} home`} className="rounded-sm">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={site.links.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[15px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <DiscordIcon className="text-[#5865F2]" />
            Our Discord
          </a>
          <ButtonLink
            href="/add"
            variant="secondary"
            size="sm"
            className="ml-2 h-10 px-4 text-[12px]"
          >
            <DiscordIcon size={16} className="text-[#5865F2]" />
            Add to Discord
          </ButtonLink>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-strong bg-bg-1 text-fg hover:bg-bg-2 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-full z-50 border-t border-line bg-bg-0/95 backdrop-blur lg:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1 px-6 py-4 sm:px-10">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-lg font-medium text-fg hover:bg-bg-1"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md px-3 py-3 text-lg font-medium text-fg hover:bg-bg-1"
            >
              <DiscordIcon className="text-[#5865F2]" /> Our Discord
            </a>
            <ButtonLink href="/add" variant="primary" className="mt-3">
              <DiscordIcon size={16} /> Add to Discord
            </ButtonLink>
          </nav>
        </div>
      )}
    </header>
  );
}
