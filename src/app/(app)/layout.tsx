import type { Viewport } from "next";

// Chromeless app shell (§3.14): one skip link to the map, `#main` with no fixed height and no
// overflow rule — /create, /join and /activity are ordinary scrolling documents; MapApp owns
// `h-dvh overflow-hidden` on its own root.
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
        href="#map"
        className="sr-only rounded bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
      >
        Skip to map
      </a>
      <main id="main" className="flex min-h-dvh flex-col">
        {children}
      </main>
    </>
  );
}
