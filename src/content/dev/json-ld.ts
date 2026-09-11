import { site } from "@/config/site";

const author = { "@type": "Organization", name: `${site.name} community` } as const;

/** TechArticle + BreadcrumbList (Home › Dev hub › page) for a docs route (§6.4). */
export function docJsonLd(doc: {
  path: string;
  title: string;
  description: string;
  /** `dateModified`; defaults to `site.updated`. */
  updated?: string;
}): Record<string, unknown>[] {
  const url = `${site.url}${doc.path}`;
  const crumbs = [
    { name: "Home", item: `${site.url}/` },
    { name: "Dev hub", item: `${site.url}/dev` },
  ];
  if (doc.path !== "/dev") crumbs.push({ name: doc.title, item: url });
  return [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: doc.title,
      description: doc.description,
      url,
      mainEntityOfPage: url,
      dateModified: doc.updated ?? site.updated,
      inLanguage: "en",
      isAccessibleForFree: true,
      author,
      publisher: author,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.item,
      })),
    },
  ];
}
