import Link from "next/link";
import { Map as MapIcon, ArrowRight } from "lucide-react";
import { ContourBackdrop } from "@/components/site/contour-backdrop";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DiscordIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/config/site";
import { CodeField } from "./code-field";
import { HeroFrameShell } from "./hero-frame-shell";
import { RecentRooms } from "./RecentRooms";

/**
 * Phase 1 placeholder for the map: WP3's `<HeroFrame><HeroStatic/></HeroFrame>` replaces this in
 * Phase 2 (§4.1). A skeleton, not a stand-in map.
 */
function HeroMapPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col gap-3 p-4">
      <div className="flex gap-3">
        <Skeleton className="h-full w-10 shrink-0 rounded-md" />
        <Skeleton className="min-h-0 flex-1 rounded-md" />
        <div className="hidden w-32 shrink-0 flex-col gap-2 sm:flex">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <span className="sr-only">Map preview loading</span>
    </div>
  );
}

/** Section 1 (§4.1): copy, CTAs, the code field, the rejoin card and the tier-3 map frame. */
export function Hero() {
  const configured = Boolean(site.discord.clientId);
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-10 pb-[clamp(3rem,6vw,5rem)] lg:pt-20"
    >
      <ContourBackdrop />
      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <p className="mb-3 eyebrow">Discord Activity · Free · Fan-made</p>
            <h1
              id="hero-title"
              className="display display-1 text-balance text-fg lg:text-[clamp(3.5rem,5vw,4.75rem)]"
            >
              The tactical map for your Wardogs Discord
            </h1>
            <p className="mx-auto mt-4 max-w-xl lede text-balance lg:mx-0">
              Open it in a voice channel. Everyone in the call draws on the same map.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
              {configured ? (
                <ButtonLink href="/add" size="lg" className="w-full sm:w-auto">
                  <DiscordIcon size={18} />
                  Add to your server
                </ButtonLink>
              ) : (
                <ButtonLink href="/demo" size="lg" className="w-full sm:w-auto">
                  Try the live demo
                </ButtonLink>
              )}
              <Link
                href="/add?to=account"
                className="text-sm text-fg-muted underline decoration-line-hi underline-offset-4 transition-colors hover:text-fg hover:decoration-accent"
              >
                Not an admin? Add it to your own account instead.
              </Link>
              <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:justify-center lg:justify-start">
                {configured ? null : (
                  <ButtonLink
                    href="/add"
                    variant="secondary"
                    className="col-span-2 gap-3 text-[12px] sm:text-[13px]"
                  >
                    <DiscordIcon size={16} className="text-[#5865F2]" />
                    Add to your server
                    <Badge tone="warn">Setup required</Badge>
                  </ButtonLink>
                )}
                <ButtonLink
                  href="/create"
                  variant="secondary"
                  className="gap-1.5 px-3 text-[12px] sm:gap-2 sm:px-5 sm:text-[13px]"
                >
                  <MapIcon size={16} aria-hidden="true" />
                  Open a war room
                </ButtonLink>
                <ButtonLink
                  href="/join"
                  variant="secondary"
                  className="gap-1.5 px-3 text-[12px] sm:gap-2 sm:px-5 sm:text-[13px]"
                >
                  Join a war room
                  <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
              </div>
              <CodeField id="hero-code" className="mt-3 w-full max-w-xs text-left" />
              <RecentRooms className="mt-3 w-full max-w-md text-left" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <HeroFrameShell>
              <HeroMapPlaceholder />
            </HeroFrameShell>
          </div>
        </div>
      </Container>
    </section>
  );
}
