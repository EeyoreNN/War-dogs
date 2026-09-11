/** The six dev hub cards (§4.9), copy as written. */
export const DEV_CARDS: {
  eyebrow: string;
  title: string;
  body: string;
  route: string;
  href: string;
  download?: boolean;
}[] = [
  {
    eyebrow: "Reference",
    title: "Server Reference",
    body: "The RCON HTTP API and the ServerSettings.ini config, every endpoint and key documented.",
    route: "/rcon-reference →",
    href: "/rcon-reference",
  },
  {
    eyebrow: "Interactive",
    title: "API Console",
    body: "Browse every endpoint with live examples. Try it against the in-browser simulator or your own server.",
    route: "/rcon-api →",
    href: "/rcon-api",
  },
  {
    eyebrow: "Machine-readable",
    title: "OpenAPI Spec",
    body: "Generate a typed client in any language, or import it into Postman.",
    route: "/openapi.json →",
    href: "/openapi.json",
  },
  {
    eyebrow: "Download",
    title: "Config Template",
    body: "A commented starter ServerSettings.ini with every key at its default. Edit and drop it in.",
    route: "ServerSettings.ini ↓",
    href: "/ServerSettings.ini",
    download: true,
  },
  {
    eyebrow: "Troubleshooting",
    title: "Discord help",
    body: "The map will not launch in a voice channel: the permission that causes it, temp channels, and the one-minute test.",
    route: "/discord-help →",
    href: "/discord-help",
  },
  {
    eyebrow: "Reference",
    title: "Map guide",
    body: "How this site draws its maps, the coordinate system, grid references and what a commander's uploaded map can be.",
    route: "/map-guide →",
    href: "/map-guide",
  },
];
