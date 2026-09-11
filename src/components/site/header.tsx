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

/** `true` once the document has scrolled past the 8 px sentinel (§2.9). */
function useScrolled(sentinel: React.RefObject<HTMLDivElement | null>) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinel]);
  return scrolled;
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The current hash, so `/#how` can be marked current (`usePathname` drops the fragment). */
function useHash() {
  return React.useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
}

export function isCurrentNav(href: string, pathname: string, hash: string): boolean {
  const [path, frag] = href.split("#");
  if (frag) return pathname === path && hash === `#${frag}`;
  return pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
}

/* nav underline (§2.4 #8): a 1 px accent rule grows from the left in 160 ms */
const navLink =
  "relative inline-flex h-16 items-center text-[15px] font-medium text-fg-muted transition-colors duration-150 hover:text-fg aria-[current=page]:text-fg after:absolute after:inset-x-0 after:bottom-4 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-[160ms] after:ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:after:scale-x-100 aria-[current=page]:after:scale-x-100";

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const hash = useHash();
  const sentinel = React.useRef<HTMLDivElement | null>(null);
  const scrolled = useScrolled(sentinel);
  const firstLink = React.useRef<HTMLAnchorElement | null>(null);
  const toggle = React.useRef<HTMLButtonElement | null>(null);

  // The menu is "open for" a pathname; navigating away closes it without an effect.
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = React.useCallback(
    (next: boolean) => setOpenFor(next ? pathname : null),
    [pathname],
  );

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    firstLink.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  const current = (href: string) => (isCurrentNav(href, pathname, hash) ? "page" : undefined);
  // Mirrors the hero (§4.1): with no Discord app configured the install CTA would only land on
  // the setup page, so the header's CTA becomes the demo instead.
  const configured = Boolean(site.discord.clientId);

  return (
    <>
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-2 w-px"
      />
      {/*
        The blur lives on a `before:` layer, not on the <header>: `backdrop-filter` (like
        `transform` / `filter`) makes an element the containing block for `position: fixed`
        descendants, which is what once shrank the mobile menu to the header's 56 px box. The menu
        is also rendered as a sibling of the header (below) so no header style can capture it.
      */}
      <header
        data-scrolled={scrolled || undefined}
        className={cn(
          "sticky top-0 z-40 border-b border-transparent transition-colors duration-200 before:absolute before:inset-0 before:-z-10 before:bg-bg-0/80 before:backdrop-blur-[12px] before:content-[''] data-scrolled:border-line",
          className,
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between px-6 sm:px-10 md:h-16 lg:px-16">
          <Link href="/" aria-label={`${site.name} home`} className="rounded-sm">
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current(item.href)}
                className={navLink}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(navLink, "gap-2")}
            >
              <DiscordIcon className="text-[#5865F2]" />
              Our Discord
            </a>
            {configured ? (
              <ButtonLink
                href="/add"
                variant="secondary"
                size="sm"
                className="ml-2 h-10 px-4 text-[12px]"
              >
                <DiscordIcon size={16} className="text-[#5865F2]" />
                Add to Discord
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/demo"
                variant="secondary"
                size="sm"
                className="ml-2 h-10 px-4 text-[12px]"
              >
                Try the live demo
              </ButtonLink>
            )}
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            {configured ? (
              <ButtonLink
                href="/add"
                variant="secondary"
                size="sm"
                className="h-10 px-3 text-[12px]"
              >
                <DiscordIcon size={16} className="text-[#5865F2]" />
                Add
              </ButtonLink>
            ) : (
              <ButtonLink
                href="/demo"
                variant="secondary"
                size="sm"
                className="h-10 px-3 text-[12px]"
              >
                Demo
              </ButtonLink>
            )}
            <button
              ref={toggle}
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-strong bg-bg-1 text-fg hover:bg-bg-2"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Full-height sheet under the 56 px bar (§2.9); a sibling of <header>, see the note above. */}
      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-14 bottom-0 z-50 flex flex-col border-t border-line bg-bg-0/95 backdrop-blur-[12px] lg:hidden"
        >
          <nav
            aria-label="Mobile"
            className="flex flex-1 flex-col overflow-y-auto px-6 py-4 sm:px-10"
          >
            {nav.map((item, i) => (
              <Link
                key={item.href}
                ref={i === 0 ? firstLink : undefined}
                href={item.href}
                aria-current={current(item.href)}
                className="rounded-md px-3 py-3 text-[20px] font-medium text-fg hover:bg-bg-1 aria-[current=page]:text-accent"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-md px-3 py-3 text-[20px] font-medium text-fg hover:bg-bg-1"
            >
              <DiscordIcon size={20} className="text-[#5865F2]" /> Our Discord
            </a>
            <div className="mt-auto pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {configured ? (
                <ButtonLink href="/add" variant="primary" size="lg" className="w-full">
                  <DiscordIcon size={18} /> Add to Discord
                </ButtonLink>
              ) : (
                <ButtonLink href="/demo" variant="primary" size="lg" className="w-full">
                  Try the live demo
                </ButtonLink>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
