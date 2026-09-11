import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/site/legal";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${site.name} keeps about you, why, for how long, and how to remove it. No account, no database, no cookies.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This page says what wardogs.tech keeps about you, why, for how long, and how to remove it. It is written to be read, not to cover us. The short version: there is no account and no database, and nothing is stored unless you choose to."
      related={{ href: "/terms", label: "Terms of Service" }}
      sections={[
        {
          title: "What stays in your browser",
          body: (
            <p>
              Your callsign, focus and ink colour; the war rooms you have opened and their plans;
              your preferences; any map image you upload; the actions you take in the dashboard
              demo. All of it is in this browser&apos;s storage. Clearing site data removes it.
            </p>
          ),
        },
        {
          title: "What a relay sees",
          body: (
            <p>
              If this instance runs a relay, it receives the room code, the callsigns and the
              drawings of the people in a room so it can pass them to each other. It keeps them in
              memory only, drops a room six hours after the last activity, and writes nothing to
              disk. It does not log IP addresses beyond what its host does by default.
            </p>
          ),
        },
        {
          title: "The Discord app",
          body: (
            <p>
              Inside a Discord voice channel the app reads the call&apos;s instance id to put
              everyone in the same room. It does not read your messages, your server list or your
              roles. If Discord sign-in is configured and you use it, Discord shows you exactly what
              is shared; we do not store it on a server.
            </p>
          ),
        },
        {
          title: "Cookies",
          body: <p>None. No advertising, no analytics, no tracking.</p>,
        },
        {
          title: "Who else sees data",
          body: (
            <p>
              The site is hosted on Vercel; a relay, when configured, runs where its operator puts
              it. Nobody buys, rents or is otherwise given your data.
            </p>
          ),
        },
        {
          title: "Removing your data",
          body: (
            <p>
              Clear this site&apos;s data in your browser. A relay forgets a room on its own within
              six hours of the last activity.
            </p>
          ),
        },
        {
          title: "Age",
          body: (
            <p>
              Discord requires its users to be at least 13, and so do we. We do not knowingly keep
              data about anyone younger.
            </p>
          ),
        },
        {
          title: "Changes and contact",
          body: (
            <p>
              When this policy changes, the date at the top changes with it. Questions and requests:{" "}
              <ContactLine />. wardogs.tech is unofficial: not affiliated with Bulkhead, Team17 or
              Discord.
            </p>
          ),
        },
      ]}
    />
  );
}
