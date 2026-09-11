import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/config/site";
import { JsonLd } from "@/components/site/json-ld";
import { LiveRegion } from "@/components/ui/live-region";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const saira = localFont({
  src: [
    { path: "./fonts/saira-condensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/saira-condensed-700-latin.woff2", weight: "700", style: "normal" },
    { path: "./fonts/saira-condensed-800-latin.woff2", weight: "800", style: "normal" },
  ],
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

const jetbrains = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
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
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  keywords: ["Wardogs", "tactical map", "Discord activity", "war room", "RCON", "server admin"],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline.toLowerCase()}`,
    description: site.description,
    url: site.url,
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name} — ${site.tagline}` },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline.toLowerCase()}`,
    description: site.description,
    images: [{ url: "/twitter-image", alt: `${site.name} — ${site.tagline}` }],
  },
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

// No skip link here: each route-group layout renders its own (§3.14), so app routes are never
// left with a dead `#main` target.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${barlow.variable} ${jetbrains.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-fg">
        {children}
        <Toaster />
        <LiveRegion />
        <JsonLd data={webSiteJsonLd} />
        <JsonLd data={softwareJsonLd} />
      </body>
    </html>
  );
}
