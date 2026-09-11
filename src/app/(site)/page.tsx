import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { MotionProvider } from "@/components/site/motion";
import { ExitCards } from "@/components/home/exit-cards";
import { Faq } from "@/components/home/faq";
import { faqJsonLd } from "@/components/home/faq-data";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { site } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    images: [{ url: "/opengraph-image", alt: `${site.name} — ${site.tagline}` }],
  },
  twitter: { images: ["/twitter-image"] },
};

export default function HomePage() {
  return (
    <MotionProvider>
      <Hero />
      <HowItWorks />
      <ExitCards />
      <Faq />
      <JsonLd data={faqJsonLd()} />
    </MotionProvider>
  );
}
