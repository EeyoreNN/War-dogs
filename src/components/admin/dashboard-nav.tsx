"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const DASHBOARD_TABS = [
  { href: "/demo/admin/live", label: "Live" },
  { href: "/demo/admin/rotation", label: "Rotation" },
  { href: "/demo/admin/history", label: "History" },
  { href: "/demo/admin/bans", label: "Bans" },
  { href: "/demo/admin/audit", label: "Audit" },
] as const;

/** Route-level navigation: links with `aria-current`, mono chips, a 1 px accent underline. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-1 scrollbar-thin overflow-x-auto">
      <ul className="flex min-w-max items-end gap-1 border-b border-line px-1">
        {DASHBOARD_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center px-2.5 font-mono text-[12px] tracking-[0.14em] uppercase transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-[160ms] hover:text-fg sm:px-3 sm:after:inset-x-3",
                  active ? "text-fg after:scale-x-100" : "text-fg-muted",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
