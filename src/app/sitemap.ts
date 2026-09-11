import type { MetadataRoute } from "next";
import { site } from "@/config/site";

type Entry = [
  path: string,
  priority: number,
  freq: MetadataRoute.Sitemap[number]["changeFrequency"],
];

const ENTRIES: Entry[] = [
  ["/", 1.0, "weekly"],
  ["/demo", 0.8, "daily"],
  ["/create", 0.6, "monthly"],
  ["/join", 0.6, "monthly"],
  ["/dev", 0.5, "monthly"],
  ["/rcon-reference", 0.5, "monthly"],
  ["/rcon-api", 0.5, "monthly"],
  ["/discord-help", 0.5, "monthly"],
  ["/map-guide", 0.5, "monthly"],
  ["/demo/admin", 0.5, "monthly"],
  ["/terms", 0.2, "yearly"],
  ["/privacy", 0.2, "yearly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(site.updated);
  return ENTRIES.map(([path, priority, changeFrequency]) => ({
    url: new URL(path, site.url).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
