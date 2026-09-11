import type * as React from "react";

/** One h2 section of a docs page; `body` is server-rendered React. */
export interface DocSectionData {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** A typed docs page module under `src/content/dev/*` (§3.15). */
export interface Doc {
  slug: string;
  title: string;
  unofficialLine: string;
  eyebrow: string;
  intro: React.ReactNode;
  sections: DocSectionData[];
  jsonLd: "TechArticle";
}
