import { describe, expect, it } from "vitest";
import nextConfig, { NOINDEX_SOURCES, securityHeaders } from "./next.config";

const get = (headers: { key: string; value: string }[], key: string) =>
  headers.find((h) => h.key === key)?.value;
const csp = (headers: { key: string; value: string }[]) =>
  Object.fromEntries(
    (get(headers, "Content-Security-Policy") ?? "")
      .split("; ")
      .filter(Boolean)
      .map((d) => [d.split(" ")[0], d.slice(d.indexOf(" ") + 1)]),
  );

describe("securityHeaders (§7.6)", () => {
  const relay = "wss://relay.example.com";

  it("emits no CSP outside production (Turbopack dev needs eval / inline handlers)", () => {
    const headers = securityHeaders("site", false);
    expect(get(headers, "Content-Security-Policy")).toBeUndefined();
    expect(get(headers, "X-Frame-Options")).toBe("DENY");
    expect(get(headers, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("site: connect-src admits the relay origin from NEXT_PUBLIC_RELAY_URL and nothing is framed", () => {
    process.env.NEXT_PUBLIC_RELAY_URL = `${relay}/ws`;
    const d = csp(securityHeaders("site", true));
    expect(d["connect-src"]).toBe(`'self' ${relay} https://discord.com https://*.discord.com`);
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
  });

  it("site: no relay configured → connect-src has no relay entry, never a wildcard", () => {
    delete process.env.NEXT_PUBLIC_RELAY_URL;
    const d = csp(securityHeaders("site", true));
    expect(d["connect-src"]).toBe("'self' https://discord.com https://*.discord.com");
    process.env.NEXT_PUBLIC_RELAY_URL = "not a url";
    expect(csp(securityHeaders("site", true))["connect-src"]).not.toContain("not a url");
  });

  it("activity: framed by Discord only, no X-Frame-Options / COOP, Discord RPC allowed", () => {
    process.env.NEXT_PUBLIC_RELAY_URL = relay;
    const headers = securityHeaders("activity", true);
    expect(get(headers, "X-Frame-Options")).toBeUndefined();
    expect(get(headers, "Cross-Origin-Opener-Policy")).toBeUndefined();
    const d = csp(headers);
    expect(d["frame-ancestors"]).toBe(
      "https://discord.com https://*.discord.com https://discordsays.com https://*.discordsays.com",
    );
    expect(d["connect-src"]).toContain("wss://*.discordsays.com");
  });

  it("console: any https / wss RCON endpoint plus the relay", () => {
    process.env.NEXT_PUBLIC_RELAY_URL = relay;
    expect(csp(securityHeaders("console", true))["connect-src"]).toBe(
      `'self' https: wss: ${relay}`,
    );
  });
});

describe("headers() routing", () => {
  it("routes site / console / activity kinds and adds X-Robots-Tag to the disallowed HTML routes", async () => {
    const rows = await nextConfig.headers!();
    const source = (s: string) => rows.filter((r) => r.source === s);
    expect(source("/((?!activity).*)")).toHaveLength(1);
    expect(source("/rcon-api(.*)")).toHaveLength(1);
    expect(source("/activity(.*)")).toHaveLength(1);
    for (const s of NOINDEX_SOURCES) {
      expect(source(s)[0]?.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
    }
    expect(NOINDEX_SOURCES).toEqual([
      "/room/:path*",
      "/activity",
      "/add",
      "/demo/admin/:tab(live|rotation|history|bans|audit)",
    ]);
  });

  it("redirects /r/:code to /room/:code and a Discord frame_id on / to /activity", async () => {
    const rows = await nextConfig.redirects!();
    expect(rows).toContainEqual({
      source: "/r/:code",
      destination: "/room/:code",
      permanent: true,
    });
    expect(rows.find((r) => r.source === "/")).toMatchObject({ destination: "/activity" });
  });
});
