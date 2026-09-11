import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/config/site";
import { JsonLd } from "@/components/site/json-ld";
import { LiveRegion } from "@/components/ui/live-region";
import "./globals.css";

// Only the faces that render are shipped and preloaded (§7.3): the `display` utility is the
// sole Saira user and it is 800; the 600 / 700 files were fetched on every page for nothing.
const saira = localFont({
  src: [{ path: "./fonts/saira-condensed-800-latin.woff2", weight: "800", style: "normal" }],
  variable: "--font-saira",
  display: "swap",
  adjustFontFallback: "Arial",
});

const barlow = localFont({
  src: [
    { path: "./fonts/barlow-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
  adjustFontFallback: "Arial",
});

// One variable face (fvar/gvar, wght 100–800) covers every mono weight the UI asks for; the
// three per-weight files used to be byte-copies of it, so `font-medium` / `font-bold` mono text
// rendered at 400. `preload: false` per §7.3: mono is below the fold on every marketing page.
const jetbrains = localFont({
  src: [{ path: "./fonts/jetbrains-mono-latin.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline.toLowerCase()}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // No `alternates.canonical` here: Next merges metadata per top-level key, so a root canonical
  // would be inherited by every page that does not set one (§6.1: each page exports its own;
  // the noindex room / activity / dashboard pages must not claim the home page as canonical).
  manifest: "/manifest.webmanifest",
  keywords: ["Wardogs", "tactical map", "Discord activity", "war room", "RCON", "server admin"],
  // Likewise only the site-wide Open Graph / Twitter fields live here. `title`, `description`
  // and `url` are left to each page (Next falls back to the page's own title and description),
  // so /dev or /terms no longer unfurl as the home page.
  openGraph: {
    type: "website",
    siteName: site.name,
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name} — ${site.tagline}` },
    ],
  },
  // `twitter.images` falls back to `openGraph.images`, so a page with its own OG image gets it
  // on Twitter too; the home page pins `/twitter-image` itself.
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  themeColor: "#141311",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  url: site.url,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  isAccessibleForFree: true,
  author: { "@type": "Organization", name: "wardogs.tech community" },
};

// No skip link and no Toaster here: each route-group layout renders its own (§3.14) — the
// skip link so app routes are never left with a dead target, the Toaster so app / admin routes
// can place it top centre (§4.3.8) while marketing pages keep it bottom-right.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${barlow.variable} ${jetbrains.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-fg">
        {children}
        <LiveRegion />
        <JsonLd data={webSiteJsonLd} />
        <JsonLd data={softwareJsonLd} />
      </body>
    </html>
  );
}
