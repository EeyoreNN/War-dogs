import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/config/site";

// Placeholder home page; replaced by the marketing build.
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Container className="py-24 text-center">
          <p className="mb-6 eyebrow">Scaffold</p>
          <h1 className="mx-auto max-w-4xl display text-6xl sm:text-7xl">
            The tactical map for your Wardogs Discord
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-fg-muted">{site.description}</p>
          <div className="mt-10 flex justify-center gap-3">
            <ButtonLink href="/add">Add to your server</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              Open the demo
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
