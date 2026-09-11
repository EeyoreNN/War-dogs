import type { NextConfig } from "next";

type HeaderKind = "site" | "console" | "activity";
type Header = { key: string; value: string };

/** Origin of NEXT_PUBLIC_RELAY_URL (`ws:` / `wss:` as given) for connect-src; never a bare wildcard. */
function relayOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_RELAY_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const DISCORD_FRAME_ANCESTORS =
  "https://discord.com https://*.discord.com https://discordsays.com https://*.discordsays.com";
const DISCORD_CONNECT =
  "https://discord.com https://*.discord.com wss://*.discord.gg https://*.discordsays.com wss://*.discordsays.com";

function contentSecurityPolicy(kind: HeaderKind): string {
  const relay = relayOrigin();
  const connect =
    kind === "activity"
      ? `'self' ${DISCORD_CONNECT}`
      : kind === "console"
        ? `'self' https: wss:${relay ? ` ${relay}` : ""}`
        : `'self'${relay ? ` ${relay}` : ""} https://discord.com https://*.discord.com`;
  const frameAncestors = kind === "activity" ? DISCORD_FRAME_ANCESTORS : "'none'";
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Security headers (§7.6). The CSP is emitted only in production: Turbopack dev / HMR needs eval
 * and inline handlers, and a dev-time violation would blank the site. Everything else applies
 * in dev too.
 */
export function securityHeaders(kind: HeaderKind, isProd: boolean): Header[] {
  const headers: Header[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ];
  if (kind !== "activity") {
    headers.push(
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    );
  }
  if (isProd) headers.push({ key: "Content-Security-Policy", value: contentSecurityPolicy(kind) });
  return headers;
}

/**
 * Routes robots.txt disallows (§6.3) also carry `<meta name="robots" content="noindex">` (§6.1),
 * but a crawler never fetches a disallowed URL, so the meta alone cannot stop a pasted room link
 * from being indexed as a bare URL. `X-Robots-Tag` is honoured from the response headers
 * without reading the body. `/r/:code` and `/terrain/` serve no HTML and need nothing here.
 */
export const NOINDEX_SOURCES = [
  "/room/:path*",
  "/activity",
  "/add",
  "/demo/admin/:tab(live|rotation|history|bans|audit)",
];

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `next dev` would otherwise append its own block to CLAUDE.md on every start.
  agentRules: false,
  // `next dev` refuses cross-origin dev resources; both loopback spellings are used locally.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: {
    resolveAlias: {
      // zod's entries `export * as locales from "../locales/index.js"`: the namespace export drags
      // all 64 locale tables into the shared chunk (§7.3). The stub ships only `en`.
      "../locales/index.js": "./src/lib/zod-locales-stub.ts",
    },
  },
  async headers() {
    // Later entries override earlier ones per header key, so the specific routes come last.
    return [
      { source: "/((?!activity).*)", headers: securityHeaders("site", isProd) },
      { source: "/rcon-api(.*)", headers: securityHeaders("console", isProd) },
      // The Discord Activity route must be embeddable inside discord.com; everything else is not.
      { source: "/activity(.*)", headers: securityHeaders("activity", isProd) },
      ...NOINDEX_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
  async redirects() {
    return [
      // Short room links.
      { source: "/r/:code", destination: "/room/:code", permanent: true },
      // Discord opens the root of the URL mapping with its query; the Activity lives at /activity.
      {
        source: "/",
        has: [{ type: "query", key: "frame_id" }],
        destination: "/activity",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
