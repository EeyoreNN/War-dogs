# Package reports

Each work package files one report here when its phase is done (spec §8.1). The lead reads them
before each integration merge.

| File         | Package                                                              |
| ------------ | -------------------------------------------------------------------- |
| `core.md`    | WP1 — map engine, store, transports, storage, relay                  |
| `terrain.md` | WP2 — terrain generator, maps, `/terrain` route, OG renderer         |
| `map-ui.md`  | WP3 — map app, hero player, `/create`, `/join`, `/demo`, `/activity` |
| `admin.md`   | WP4 — server simulator, OpenAPI parser, API console, dashboard       |
| `docs.md`    | WP5 — dev hub content, config validator, docs shell                  |
| `site.md`    | WP6 — design system, site shell, home, add, legal, SEO, CI           |

## Format

```
# <package> — Phase <n> report

## Shipped
What exists and works, with paths. Gates run and their result.

## Deviations
Anything that differs from docs/SPEC.md, with the reason.

## Requests to other packages
Exact changes needed in files you do not own: file path + a diff or the exact text.

## Not done
What is missing, and what it is blocked on.
```

Keep it factual. A reviewer should be able to check every line against the tree.
