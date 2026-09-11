import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, History, Radio, ShieldCheck } from "lucide-react";
import { LiveCardIsland } from "@/components/admin/live-server-card";
import { ButtonLink } from "@/components/ui/button";
import { CardBody, CardEyebrow, CardTitle, LinkCard } from "@/components/ui/card";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Dashboard demo",
  description: "Run a Wardogs server from one dashboard. An early build, open to anyone.",
  alternates: { canonical: "/demo/admin" },
  openGraph: {
    title: "Dashboard demo",
    description: "Run a Wardogs server from one dashboard. An early build, open to anyone.",
    url: "/demo/admin",
  },
};

const features = [
  {
    href: "/demo/admin/live",
    eyebrow: "Live",
    title: "Run the match",
    body: "Whisper a player, kick one, move them to another faction, or override the map. The scoreboard updates within seconds because the demo server answers the same RCON calls a real one does.",
    icon: Radio,
  },
  {
    href: "/demo/admin/history",
    eyebrow: "History",
    title: "Read three days back",
    body: "Every match on record with its final board and how the score moved, every player's sessions and playtime, a leaderboard. The official console keeps none of this.",
    icon: History,
  },
  {
    href: "/demo/admin/audit",
    eyebrow: "Accountability",
    title: "See who did what",
    body: "You hold the admin role here. Every action you take lands in the audit trail under your visitor name, with the exact RCON call it would have sent.",
    icon: ShieldCheck,
  },
] as const;

const notes = [
  {
    title: "Shared",
    body: "Everyone who opens this link is on the same simulated server: same clock, same seed. What you change is shared with the other tabs in this browser.",
  },
  {
    title: "Heals itself",
    body: "Kicked players come back. Bans you place expire in an hour. Rotation, config and everything visitors wrote reset at 04:00Z.",
  },
  {
    title: "Not real",
    body: "A test server the app runs itself, in your browser. The roster is fictional. Real communities would sign in with Discord and hold real ranks.",
  },
] as const;

export default function AdminDemoPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
      <section className="relative max-w-5xl pt-14 pb-10 sm:pt-20 lg:pt-24">
        <h1 className="display display-1 text-fg">
          Run a Wardogs <br />
          server from <br />
          one dashboard
        </h1>
        <p className="mt-5 display display-3 text-accent">
          An early build, open to anyone. Click around and tell us what is wrong.
        </p>
        <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-fg-muted">
          wardogs.tech is building the admin dashboard the official console is not: live control,
          history that stays, ranks instead of a shared password. This is that dashboard, pointed at
          a simulated test server that plays King of the Hill around the clock. You open it as a
          visitor holding the admin role. Nothing you do here reaches a real server or a real
          player.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ButtonLink href="/demo/admin/live" size="lg" className="w-full sm:w-auto">
            Open the dashboard
            <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
          <p className="font-mono text-[12px] tracking-[0.16em] text-fg-muted uppercase">
            No sign-in · nothing to install
          </p>
        </div>
      </section>

      <section aria-label="Live server" className="pb-10">
        <LiveCardIsland />
      </section>

      <section
        aria-label="What the dashboard does"
        className="grid gap-4 pb-12 sm:gap-6 md:grid-cols-3"
      >
        {features.map(({ href, eyebrow, title, body, icon: Icon }) => (
          <LinkCard key={href} href={href} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon size={16} aria-hidden="true" className="text-accent" />
              <CardEyebrow>{eyebrow}</CardEyebrow>
            </div>
            <CardTitle>{title}</CardTitle>
            <CardBody>{body}</CardBody>
          </LinkCard>
        ))}
      </section>

      <section aria-label="Notes" className="grid gap-6 border-t border-line py-10 md:grid-cols-3">
        {notes.map((n) => (
          <div key={n.title} className="border-l-2 border-accent pl-4">
            <p className="eyebrow">{n.title}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{n.body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 pb-10 sm:flex-row sm:items-center sm:gap-6">
        <ButtonLink href="/demo/admin/live" size="lg" className="w-full sm:w-auto">
          Open the dashboard
          <ArrowRight size={18} aria-hidden="true" />
        </ButtonLink>
        <Link
          href="/"
          className="font-mono text-[12px] tracking-[0.16em] text-fg-muted uppercase underline-offset-4 hover:text-fg hover:underline"
        >
          What wardogs.tech is
        </Link>
      </section>

      <footer className="border-t border-line py-8">
        <p className="text-sm text-fg-muted">
          {site.name} is unofficial and not affiliated with {site.game.developer} or{" "}
          {site.game.publisher}. The map is drawn by this site; nothing here is game art.
        </p>
      </footer>
    </div>
  );
}
