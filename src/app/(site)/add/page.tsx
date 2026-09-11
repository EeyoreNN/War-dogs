import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Callout } from "@/components/ui/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ContourBackdrop } from "@/components/site/contour-backdrop";
import { discordInstallUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "Add to Discord",
  description:
    "Add the wardogs.tech map to your Discord server or your own account, or set up your own Discord application for a self-hosted instance.",
  alternates: { canonical: "/add" },
  robots: { index: false, follow: false },
};

const STEPS = [
  <>
    Create an application at{" "}
    <a
      href="https://discord.com/developers/applications"
      target="_blank"
      rel="noopener noreferrer"
      className="text-fg underline decoration-line-hi underline-offset-4 hover:decoration-accent"
    >
      discord.com/developers/applications
    </a>
    .
  </>,
  <>
    Under <strong className="font-semibold text-fg">Activities</strong>, enable Activities and add a
    URL mapping: prefix <code className="mono-data text-[13px] text-fg">/</code> → your site origin
    (for example <code className="mono-data text-[13px] text-fg">https://wardogs.example.com</code>
    ). If you run a relay, add a second mapping: prefix{" "}
    <code className="mono-data text-[13px] text-fg">/relay</code> → the relay origin.
  </>,
  <>
    Under <strong className="font-semibold text-fg">OAuth2</strong>, note the Client ID. Add{" "}
    <code className="mono-data text-[13px] text-fg">applications.commands</code> to the default
    install scopes. Enable both Guild Install and User Install.
  </>,
  <>
    Set{" "}
    <code className="mono-data text-[13px] text-fg">
      NEXT_PUBLIC_DISCORD_CLIENT_ID=&lt;client id&gt;
    </code>{" "}
    in the site&apos;s environment and redeploy. If you run a relay, set{" "}
    <code className="mono-data text-[13px] text-fg">NEXT_PUBLIC_RELAY_URL</code> too, and add{" "}
    <code className="mono-data text-[13px] text-fg">https://&lt;client id&gt;.discordsays.com</code>{" "}
    to the relay&apos;s <code className="mono-data text-[13px] text-fg">RELAY_ALLOWED_ORIGINS</code>
    .
  </>,
  <>In Discord, join a voice channel, press Start an Activity, pick your app.</>,
];

/**
 * `/add` (§4.6): redirects to the Discord install URL when a client id is configured; otherwise
 * renders the setup page an unconfigured self-host shows.
 */
export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const { to: toParam } = await searchParams;
  const to = toParam === "account" ? "account" : "server";
  const url = discordInstallUrl(to);
  if (url) redirect(url);

  return (
    <section className="relative overflow-hidden py-[clamp(4rem,8vw,7rem)]">
      {/* Behind the title block only (§2.5): bounded and faded out before the first body section. */}
      <ContourBackdrop className="h-[420px] [mask-image:linear-gradient(to_bottom,#000_50%,transparent)]" />
      <Container className="relative max-w-3xl">
        <p className="mb-3 eyebrow">Setup required</p>
        <h1 className="display display-2 text-balance text-fg">
          This instance has no Discord app configured
        </h1>
        <p className="mt-4 max-w-2xl lede">
          Point it at your own Discord application and the Add buttons and the voice-channel
          Activity start working. It takes about five minutes.
        </p>

        <Card className="mt-10 p-6 lg:p-7">
          <ol className="flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="pt-1 mono-data text-[13px] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] leading-relaxed text-fg-muted">{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Callout tone="note" className="mt-6">
          Members cannot launch it? That is almost always the Use Activities permission on the voice
          channel. See the <Link href="/discord-help">Discord help page</Link>.
        </Callout>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/demo" size="lg">
            Try the live demo
          </ButtonLink>
          <ButtonLink href="/dev" variant="secondary" size="lg">
            Read the docs
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
