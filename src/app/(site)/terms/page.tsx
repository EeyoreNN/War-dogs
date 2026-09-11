import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/site/legal";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${site.name}: a community-built companion for Wardogs with no accounts and no database.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="wardogs.tech is a community-built companion for the game Wardogs: a shared tactical map, war rooms for squads, a demo of a dashboard for people who run Wardogs servers, and a Discord app that opens the map inside a voice channel. Using any of it means you agree to these terms."
      related={{ href: "/privacy", label: "Privacy Policy" }}
      sections={[
        {
          title: "Who we are, and who we are not",
          body: (
            <p>
              wardogs.tech is unofficial. It is not made by, endorsed by or affiliated with
              Bulkhead, Team17 or anyone else behind Wardogs. Game names appear here so the tool is
              useful to players; the maps are schematic drawings made by this site, not game art. If
              a rights holder asks, anything of theirs comes down.
            </p>
          ),
        },
        {
          title: "Accounts",
          body: (
            <p>
              There are none. You type a callsign; it lives in your browser. If this instance has
              Discord sign-in configured, we receive only what Discord shows you on the consent
              screen, and we keep nothing on a server.
            </p>
          ),
        },
        {
          title: "War rooms",
          body: (
            <p>
              A war room is identified by its code. Anyone with the code can open it and, depending
              on the commander&apos;s settings, draw on it. There is no account behind a callsign,
              so the code is the only protection: anyone in a room can remove anyone else from it,
              and someone removed can come back with the code. Do not share a code with people who
              should not see the plan. Rooms are kept in the browsers of the people in them and,
              where a relay is configured, in that relay&apos;s memory while the room is active.
            </p>
          ),
        },
        {
          title: "What you post",
          body: (
            <p>
              Callsigns, drawings, markers, labels and request notes are yours and your team&apos;s.
              Do not post anything you have no right to share, anything that identifies a private
              person beyond their in-game presence, or anything that harasses, threatens or demeans
              someone. Uploaded map images must be yours to use.
            </p>
          ),
        },
        {
          title: "The demos",
          body: (
            <p>
              The live demo is a shared room: treat it as a room with other people in it. The
              dashboard demo is a simulation that runs in your browser; nothing you do there reaches
              a real server or a real player.
            </p>
          ),
        },
        {
          title: "Acceptable use",
          body: (
            <p>
              Do not use wardogs.tech to cheat, to attack or overload the service or a relay, to
              impersonate another person or community, or to scrape or resell anything here.
            </p>
          ),
        },
        {
          title: "Availability and warranty",
          body: (
            <p>
              This is a free tool built by players in their own time. It is provided as is, with no
              promise that it will be available, accurate or free of faults. Wardogs itself changes;
              the server reference can go out of date when it does. To the extent the law allows,
              wardogs.tech is not liable for any loss arising from its use or unavailability.
            </p>
          ),
        },
        {
          title: "Ending things",
          body: (
            <p>
              We can change or shut down any part of the service, and a relay can drop a room that
              breaks these terms. You can leave at any time by closing the tab and clearing your
              browser&apos;s site data.
            </p>
          ),
        },
        {
          title: "Changes",
          body: (
            <p>
              When these terms change, the date at the top changes with them. Continuing to use the
              service after that is acceptance of the new terms.
            </p>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Questions, takedown requests and anything else: <ContactLine />.
            </p>
          ),
        },
      ]}
    />
  );
}
