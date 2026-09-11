import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/config/site";
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
  keywords: ["Wardogs", "tactical map", "Discord activity", "war room", "RCON", "server admin"],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline.toLowerCase()}`,
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline.toLowerCase()}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#141311",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${barlow.variable} ${jetbrains.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <a
          href="#main"
          className="sr-only rounded bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:ring-accent"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
