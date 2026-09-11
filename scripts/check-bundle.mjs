#!/usr/bin/env node
/**
 * First-load JS budget check (§7.3). Run after `next build`.
 *
 * Next 16 under Turbopack emits no per-route client manifest (`build-manifest.json` only lists
 * root chunks), so this reads every prerendered page under `.next/server/app/**\/*.html`,
 * collects the `<script src="/_next/static/…">` tags that lack `noModule`, gzips each referenced
 * file once (level 9) and sums per page. Lazy chunks are measured through their entry modules:
 * each entry renders `data-bundle="wd:<name>"` on its root element — a literal that survives
 * minification — so the entry chunk is found by that string inside `.next/static/chunks/*.js`
 * and summed with the chunks it references — plus the sibling chunks named next to it in any
 * parent's Turbopack async loader list (`Promise.all(["static/chunks/…", …].map(l))`); when
 * several parents load the entry with different sibling sets, the largest cost is reported, not
 * counting chunks the loading page already has in its first-load scripts.
 *
 * Exit code 1 when any route or lazy bundle is over budget. Budgets are gzip bytes.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;

/** Route budgets by group (§7.3). */
const ROUTE_BUDGETS = {
  site: 190 * KB, // (site) marketing / docs / legal routes
  app: 200 * KB, // (app) shells before their lazy chunk
  admin: 200 * KB, // (admin) pages before the dashboard chunk
};

/** Lazy bundle budgets, keyed by the `data-bundle` marker (§7.3). */
const LAZY_BUDGETS = {
  // Measured true graphs (Turbopack sibling chunks included). The map app and the console both
  // carry the shared zod chunk (~87 kB gz) for boundary validation; budgets hold the measured
  // baseline plus ~10 % headroom.
  "wd:map-app": 200 * KB,
  "wd:hero": 60 * KB,
  "wd:dashboard": 90 * KB,
  "wd:console": 130 * KB,
  "wd:validator": 100 * KB,
};

/** Routes that are not (site): everything else is. */
const APP_ROUTES = ["/create", "/join", "/demo", "/activity", "/room"];
const ADMIN_PREFIX = "/demo/admin";

const root = process.cwd();
const nextDir = join(root, ".next");
const appDir = join(nextDir, "server", "app");
const chunksDir = join(nextDir, "static", "chunks");

if (!existsSync(appDir)) {
  console.error("check-bundle: .next/server/app not found — run `next build` first.");
  process.exit(2);
}

/* ---------- helpers ---------- */

function walk(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, pred, out);
    else if (pred(p)) out.push(p);
  }
  return out;
}

const gzipCache = new Map();
function gzipSize(staticPath) {
  // staticPath is like "static/chunks/abc.js" (relative to .next)
  if (gzipCache.has(staticPath)) return gzipCache.get(staticPath);
  const file = join(nextDir, staticPath);
  let size = 0;
  if (existsSync(file)) size = gzipSync(readFileSync(file), { level: 9 }).length;
  gzipCache.set(staticPath, size);
  return size;
}

function routeOf(htmlFile) {
  const rel = relative(appDir, htmlFile)
    .split(sep)
    .join("/")
    .replace(/\.html$/, "");
  if (rel === "index") return "/";
  return "/" + rel;
}

function groupOf(route) {
  if (route.startsWith(ADMIN_PREFIX)) return "admin";
  if (APP_ROUTES.some((r) => route === r || route.startsWith(r + "/"))) return "app";
  return "site";
}

const fmt = (bytes) => `${(bytes / KB).toFixed(1).padStart(6)} kB`;

/* ---------- per-route first-load JS ---------- */

const htmlFiles = walk(appDir, (p) => p.endsWith(".html")).filter((p) => !p.includes(`${sep}_`));
const scriptTag = /<script\b([^>]*)\bsrc="\/_next\/(static\/[^"]+\.js)"([^>]*)>/g;

const routeRows = [];
for (const html of htmlFiles) {
  const route = routeOf(html);
  if (route.includes("_not-found")) continue;
  const src = readFileSync(html, "utf8");
  const scripts = new Set();
  for (const m of src.matchAll(scriptTag)) {
    const attrs = `${m[1]} ${m[3]}`;
    if (/\bnomodule\b/i.test(attrs)) continue; // legacy polyfill: modern browsers skip it
    scripts.add(m[2]);
  }
  const total = [...scripts].reduce((n, s) => n + gzipSize(s), 0);
  const group = groupOf(route);
  routeRows.push({
    route,
    group,
    scripts: scripts.size,
    loaded: new Set([...scripts].map((sc) => join(nextDir, sc))),
    total,
    budget: ROUTE_BUDGETS[group],
  });
}
routeRows.sort((a, b) => a.route.localeCompare(b.route));

/* ---------- lazy bundles via data-bundle markers ---------- */

const chunkFiles = existsSync(chunksDir) ? walk(chunksDir, (p) => p.endsWith(".js")) : [];
const chunkText = new Map(chunkFiles.map((p) => [p, readFileSync(p, "utf8")]));
const chunkRef = /static\/chunks\/[\w./-]+\.js/g;

function chunkGraph(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const p = queue.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    const text = chunkText.get(p) ?? "";
    for (const m of text.matchAll(chunkRef)) {
      const dep = join(nextDir, m[0]);
      if (dep !== p && chunkText.has(dep)) queue.push(dep);
    }
  }
  return [...seen];
}

/** Every `["static/chunks/…", …]` array literal in any chunk (Turbopack's async loader lists). */
const loaderList =
  /\[\s*"static\/chunks\/[\w./-]+\.js"(?:\s*,\s*"static\/chunks\/[\w./-]+\.js")*\s*\]/g;
const loaderLists = []; // { parent, list }
for (const [parent, text] of chunkText) {
  for (const m of text.matchAll(loaderList)) {
    const list = [...m[0].matchAll(chunkRef)].map((r) => join(nextDir, r[0]));
    if (list.length > 1 && list.every((p) => chunkText.has(p))) loaderLists.push({ parent, list });
  }
}

const lazyRows = [];
for (const [marker, budget] of Object.entries(LAZY_BUDGETS)) {
  const needle = `data-bundle="${marker}"`;
  const entries = chunkFiles.filter(
    (p) =>
      chunkText.get(p).includes(needle) || chunkText.get(p).includes(`"data-bundle":"${marker}"`),
  );
  if (entries.length === 0) {
    lazyRows.push({ marker, budget, total: null, chunks: 0 });
    continue;
  }
  // Turbopack loads a dynamic import as `Promise.all(["static/chunks/a.js", …].map(l))` in the
  // parent: the entry chunk plus its sibling chunks. Each loader list that names the entry is one
  // way a page can pay for this bundle; report the largest (some pages share more with the shell).
  // Chunks a page already has in its first-load scripts are not paid again by the lazy import.
  const lists = loaderLists.filter(({ list }) => list.some((p) => entries.includes(p)));
  const candidates = lists.length ? lists : [{ parent: null, list: [] }];
  let best = { total: -1, chunks: 0 };
  for (const { parent, list } of candidates) {
    const graph = new Set([...list, ...entries].flatMap(chunkGraph));
    const pages = routeRows.filter((r) => r.loaded.has(parent));
    for (const loaded of pages.length ? pages.map((r) => r.loaded) : [new Set()]) {
      const paid = [...graph].filter((p) => !loaded.has(p));
      const total = paid.reduce((n, p) => n + gzipSize(relative(nextDir, p)), 0);
      if (total > best.total) best = { total, chunks: paid.length };
    }
  }
  lazyRows.push({ marker, budget, total: best.total, chunks: best.chunks });
}

/* ---------- report ---------- */

let failed = false;
console.log("\nFirst-load JS per route (module scripts in prerendered HTML, gzip -9)\n");
console.log(
  `${"route".padEnd(28)} ${"group".padEnd(6)} ${"scripts".padEnd(7)} ${"size".padStart(9)} ${"budget".padStart(9)}  status`,
);
for (const r of routeRows) {
  const over = r.total > r.budget;
  if (over) failed = true;
  console.log(
    `${r.route.padEnd(28)} ${r.group.padEnd(6)} ${String(r.scripts).padEnd(7)} ${fmt(r.total)} ${fmt(r.budget)}  ${over ? "OVER" : "ok"}`,
  );
}

console.log(
  "\nLazy bundles (entry chunk found by data-bundle marker + its loader-list siblings + referenced chunks; largest loader list)\n",
);
for (const l of lazyRows) {
  if (l.total === null) {
    console.log(
      `${l.marker.padEnd(28)} ${"—".padStart(9)} ${fmt(l.budget)}  not present in this build`,
    );
    continue;
  }
  const over = l.total > l.budget;
  if (over) failed = true;
  console.log(
    `${l.marker.padEnd(28)} ${fmt(l.total)} ${fmt(l.budget)}  ${over ? "OVER" : "ok"} (${l.chunks} chunks)`,
  );
}

const home = routeRows.find((r) => r.route === "/");
if (home)
  console.log(
    `\nHome first-load JS: ${fmt(home.total)} (baseline in scripts/bundle-baseline.json)`,
  );

if (failed) {
  console.error("\ncheck-bundle: over budget.");
  process.exit(1);
}
console.log("\ncheck-bundle: all within budget.");
