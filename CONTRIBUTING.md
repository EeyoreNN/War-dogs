# Contributing

Thanks for helping. This is a small fan project with a high bar: everything on the landing page
has to be true in the browser, and every route has to work with `npm run dev` alone.

## Before you start

- Read `CLAUDE.md` (project conventions) and skim `docs/SPEC.md` — the spec is the source of truth
  for copy, contracts and page behaviour.
- **No new dependencies.** Everything needed is installed; prefer what is there.
- No copyrighted game assets: no map art, no screenshots of the game or of other sites. Map imagery
  is procedurally generated in-app.
- Read from `src/config/site.ts`; never hardcode the domain, invite link or contact address.

## Workflow

```bash
npm install
npm run dev            # http://localhost:3000
npm run dev:relay      # optional relay on :8787
npm run check          # typecheck + lint + unit tests — run before you consider work done
npm run build && npm run check:bundle
npm run e2e            # Playwright, desktop + Pixel 7
```

- Server Components by default; add `"use client"` only where hooks or browser APIs are needed.
- Pure logic goes in `src/lib/<domain>` with a unit test next to it; UI in
  `src/components/<domain>`; pages in `src/app/<route>`.
- Modules the relay compiles (`src/lib/geo.ts`, `src/lib/map/*`, `src/lib/realtime/*`,
  `src/lib/room/*`, `src/config/site.ts`, `server/**`) use relative imports only — no `@/`, no DOM,
  React or Next imports. `npm run build:relay` enforces it.
- Next 16: `params` / `searchParams` are Promises; `next/dynamic(…, { ssr: false })` only inside a
  `"use client"` file; no `useSearchParams` on a statically prerendered page (read
  `window.location` in a mount effect instead). Run `npx next typegen` after adding a route.

## Design and accessibility

- Use the token utilities from `src/app/globals.css` (`bg-bg-1`, `text-fg-muted`, `border-line`,
  `text-accent`, `display display-2`, `eyebrow`, `label-mono`, `panel`, `hud-corners`) — never raw
  hex. Amber is for CTAs, eyebrows, active states and focus rings; never for body text.
- Any surface uses at most two textures. Nothing animates continuously except the LIVE dot and
  active pings; every motion respects `prefers-reduced-motion`.
- Keyboard path for every pointer interaction, `aria-label` on every icon button, native
  `<dialog>` with focus return, one polite live region. Text ≥ 4.5:1 (asserted in
  `src/lib/a11y/contrast.test.ts`), touch targets ≥ 40 px (44 on mobile bars). See
  `docs/accessibility.md`.
- Responsive from 360 px; no horizontal scroll on any route.

## Copy

Short, direct, second person, no marketing fluff. Sentence case for body text; headlines use the
`display` utility. Say what the software does, never what it hopes to do: the FAQ, Terms and
Privacy pages must stay true for this codebase (no accounts, no database, kick has no rejoin
block).

## Pull requests

- Small, focused commits with a message that says why.
- `npm run check` and `npm run build` green; add or update tests for anything in `src/lib`.
- Include screenshots at 1440 and 390 px for UI changes.
- If a change touches a shared contract (`docs/SPEC.md` §3), say so in the description and keep
  the signature unless the PR is about changing it.
- Formatting is Prettier (`npm run format`); CI runs `format:check`.
