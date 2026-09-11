import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Wardogs map",
    description: site.description,
    display: "standalone",
    background_color: "#141311",
    theme_color: "#141311",
    start_url: "/join",
    icons: [
      // Next's manifest type has no "any maskable"; two entries express the same thing.
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
