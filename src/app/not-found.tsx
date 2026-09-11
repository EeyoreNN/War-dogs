import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { ContourBackdrop } from "@/components/site/contour-backdrop";
import { CodeField } from "@/components/home/code-field";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

/** Sits outside every route group (§4.11), so it composes the site shell itself. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col vignette">
      <a
        href="#main"
        className="sr-only rounded bg-accent px-3 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="relative overflow-hidden py-[clamp(4rem,8vw,7rem)]">
          <ContourBackdrop />
          <Container className="relative max-w-3xl">
            <p className="mb-3 eyebrow">404</p>
            <h1 className="display display-2 text-balance text-fg">Nothing at this position</h1>
            <p className="mt-4 max-w-xl lede">
              The page you asked for is not on the map. If you were sent a war room link, the code
              goes after <code className="font-mono text-[15px] text-fg">/room/</code>.
            </p>
            <CodeField id="nf-code" size="lg" className="mt-8 max-w-xs" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/demo" size="lg">
                Try the live demo
              </ButtonLink>
              <ButtonLink href="/join" variant="secondary" size="lg">
                Join a war room
              </ButtonLink>
              <ButtonLink href="/" variant="ghost" size="lg">
                Home
              </ButtonLink>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
