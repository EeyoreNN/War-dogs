import { BookOpen, Eye, ShieldCheck } from "lucide-react";
import { CardBody, CardEyebrow, CardTitle, LinkCard } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Rise } from "@/components/site/motion";

const CARDS = [
  {
    eyebrow: "Just looking",
    icon: Eye,
    title: "The live demo",
    body: "A shared map with people in it right now. No sign-in.",
    href: "/demo",
  },
  {
    eyebrow: "Run a server",
    icon: BookOpen,
    title: "Docs for server owners",
    body: "The RCON reference, the config guide and an API console. Public, no account.",
    href: "/dev",
  },
  {
    eyebrow: "Coming soon",
    icon: ShieldCheck,
    title: "Server admin in the same Discord",
    body: "Live players, match history, bans with evidence. In closed testing; click around the preview.",
    href: "/demo/admin",
  },
] as const;

/** Three tier-2 link cards (§4.1). */
export function ExitCards() {
  return (
    <section aria-label="Where to next" className="py-[clamp(4rem,8vw,7rem)]">
      <Container>
        <ul className="grid gap-4 md:grid-cols-3 md:gap-6" role="list">
          {CARDS.map((c, i) => (
            <Rise key={c.href} as="li" index={i} className="flex">
              <LinkCard href={c.href} className="flex w-full flex-col pr-12">
                <CardEyebrow className="mb-4">{c.eyebrow}</CardEyebrow>
                <div className="flex items-start gap-3">
                  <c.icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-muted" />
                  <CardTitle className="text-balance">{c.title}</CardTitle>
                </div>
                <CardBody className="mt-4">{c.body}</CardBody>
              </LinkCard>
            </Rise>
          ))}
        </ul>
      </Container>
    </section>
  );
}
