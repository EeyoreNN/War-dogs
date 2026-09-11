import type { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";
import { ContourBackdrop } from "@/components/site/contour-backdrop";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DiscordIcon } from "@/components/ui/icons";
import { site } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Phase 0 placeholder: hero title and the two CTAs. The full home page (§4.1) lands in Phase 1.
export default function HomePage() {
  const configured = Boolean(site.discord.clientId);
  return (
    <section className="relative pt-16 pb-[clamp(4rem,8vw,7rem)] lg:pt-24">
      <ContourBackdrop />
      <Container className="relative">
        <div className="max-w-3xl">
          <p className="mb-3 eyebrow">Discord Activity · Free · Fan-made</p>
          <h1 className="display display-1 text-fg">The tactical map for your Wardogs Discord</h1>
          <p className="mt-4 max-w-xl lede">
            Open it in a voice channel. Everyone in the call draws on the same map.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {configured ? (
              <ButtonLink href="/add" size="lg">
                <DiscordIcon size={18} />
                Add to your server
              </ButtonLink>
            ) : (
              <ButtonLink href="/demo" size="lg">
                Try the live demo
              </ButtonLink>
            )}
            <ButtonLink href="/create" variant="secondary" size="lg">
              <MapIcon size={18} aria-hidden="true" />
              Open a war room
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
