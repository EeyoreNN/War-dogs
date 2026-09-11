# wardogs.tech — project conventions

A fan-made companion site for the game Wardogs (Bulkhead / Team17): a shared tactical map that
opens inside a Discord voice channel, war rooms for squads, a server-admin dashboard demo, and a
dev hub for people running dedicated servers. Unofficial; not affiliated with the game's makers.

## Stack

- Next.js 16 (App Router, Turbopack, React 19, TypeScript strict). `src/app` routes, `@/*` alias.
- Tailwind CSS v4 with design tokens in `src/app/globals.css` (`@theme inline`). Use the token
  utilities (`bg-bg-1`, `text-fg-muted`, `border-line`, `text-accent`, `font-display`, `display`,
  `eyebrow`, `label-mono`, `panel`, `bg-grid`) instead of raw hex values.
- Fonts are self-hosted via `next/font/local` in `src/app/layout.tsx` (Saira Condensed = display,
  Barlow = UI, JetBrains Mono = data). Never load fonts from a CDN.
- State: `zustand`. Icons: `lucide-react` (brand icons live in `src/components/ui/icons.tsx`).
  Motion: the `motion` package (`import { motion } from "motion/react"`). Freehand ink:
  `perfect-freehand`. Validation: `zod`. Realtime relay: `ws` in `server/`.
- Tests: `vitest` (+ Testing Library, jsdom) for units; `@playwright/test` for e2e in `tests/e2e`.
- Site-wide config (name, links, Discord client id, teams, maps) lives in `src/config/site.ts`.
  Read from it; never hardcode the domain, invite link or contact address.

## Commands

- `npm run dev` — web on :3000. `npm run dev:relay` — websocket relay on :8787. `npm run dev:all`.
- `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test` · `npm run e2e`.
- `npm run check` runs typecheck + lint + unit tests. Run it before you consider work done.
- `npx next typegen` regenerates route types (`LayoutProps`, `PageProps`) without a full build.

## Conventions

- Server Components by default; add `"use client"` only where hooks or browser APIs are needed.
- Pages compose `SiteHeader` / `SiteFooter` from `src/components/site` and primitives from
  `src/components/ui` (Button, ButtonLink, Card, Container, Badge, Input, Label, Logo).
- Copy voice: short, direct, second person, no marketing fluff. Sentence case for body, the
  `display` utility (uppercase condensed) for headlines, `eyebrow` for section labels.
- Accessibility is required: semantic landmarks, labelled controls, focus-visible styling, keyboard
  paths for every pointer interaction, `prefers-reduced-motion` respected, 4.5:1 contrast for text.
- Responsive from 360px up. No horizontal scroll. Touch targets ≥ 40px.
- No copyrighted game assets (no map art from the game, no screenshots of the upstream site). Map
  imagery is procedurally generated in-app.
- Next 16 notes: `middleware.ts` is now `proxy.ts`; `next lint` is gone (use `npm run lint`);
  request APIs (`params`, `searchParams`, `cookies()`) are async; typed route helpers
  `PageProps<"/path">` / `LayoutProps<"/path">` are global.
- Do not add dependencies without a reason stated in the PR; prefer what is already installed.
- Keep files small and colocated: `src/lib/<domain>` for pure logic (unit-tested),
  `src/components/<domain>` for UI, `src/app/<route>` for pages.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
