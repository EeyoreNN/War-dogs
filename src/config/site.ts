/**
 * Single place to rebrand or repoint the site.
 * Everything user-facing (name, domain, links, contact) reads from here.
 */
export const site = {
  name: "wardogs.tech",
  shortName: "WARDOGS",
  tld: ".TECH",
  tagline: "The tactical map every Wardogs server needs",
  description:
    "Draw the plan. Call the drop. Everyone sees it. A shared tactical map for Wardogs squads that opens inside a Discord voice channel. Free, fan-made, nothing to install.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardogs.tech",
  version: "0.2.0",
  updated: "2026-09-11",
  game: {
    name: "Wardogs",
    developer: "Bulkhead",
    publisher: "Team17",
    teams: ["Lonestar", "Valkyra", "Manticore"] as const,
    maps: ["Zestafona", "Bakurani", "Ozeti"] as const,
  },
  links: {
    /** Public community invite. Override with NEXT_PUBLIC_DISCORD_INVITE. */
    discord: process.env.NEXT_PUBLIC_DISCORD_INVITE ?? "https://discord.gg/FhWDZQn9Gy",
    github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/EeyoreNN/War-dogs",
  },
  discord: {
    /** Discord application id used by /add and the Activity. Unset = setup page. */
    clientId: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "",
  },
  /** Contact for legal pages. Empty = "reach us on the community Discord". */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  legalUpdated: "11 September 2026",
} as const;

export type Team = (typeof site.game.teams)[number];
export type MapName = (typeof site.game.maps)[number];

export const nav = [
  { href: "/#how", label: "How it works" },
  { href: "/demo", label: "Demo" },
  { href: "/dev", label: "Developers" },
] as const;

/** Discord OAuth install URLs. integration_type 0 = guild install, 1 = user install. */
export function discordInstallUrl(to: "server" | "account" = "server"): string | null {
  if (!site.discord.clientId) return null;
  const params = new URLSearchParams({
    client_id: site.discord.clientId,
    integration_type: to === "account" ? "1" : "0",
    scope: to === "account" ? "applications.commands identify" : "applications.commands",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
