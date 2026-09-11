import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/room/",
        "/r/",
        "/activity",
        "/add",
        "/terrain/",
        "/demo/admin/live",
        "/demo/admin/rotation",
        "/demo/admin/history",
        "/demo/admin/bans",
        "/demo/admin/audit",
      ],
    },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
