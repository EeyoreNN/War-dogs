import type { Viewport } from "next";
import { Toaster } from "@/components/ui/toast";

// Chromeless app shell (§3.14): one skip link to `#main` (the form pages have no map, so a
// `#map` target here would be dead on /create and /join — the map app renders its own
// `Skip to map` once the map exists), `#main` with no fixed height and no overflow rule —
// /create, /join and /activity are ordinary scrolling documents; MapApp owns `h-dvh
// overflow-hidden` on its own root.
export const viewport: Viewport = {
  themeColor: "#141311",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
      >
        Skip to content
      </a>
      <main id="main" className="flex min-h-dvh flex-col">
        {children}
      </main>
      <Toaster position="top" />
    </>
  );
}
