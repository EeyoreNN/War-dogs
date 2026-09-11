import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      // The Discord Activity route must be embeddable inside discord.com; everything else is not.
      {
        source: "/((?!activity).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/activity(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://discord.com https://*.discord.com https://discordsays.com https://*.discordsays.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
