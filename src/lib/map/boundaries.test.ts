// Architectural boundaries (§7.1): no `useRoomStore.setState` in components, no `@/` import in the
// relay-reachable set, and no zod reachable from the home page's client islands.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every local file reachable from `entry` (inclusive) plus the bare package names imported on the way. */
function reachable(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (files.has(f)) continue;
    files.add(f);
    for (const spec of importsOf(f)) {
      const r = resolveImport(f, spec);
      if (r) stack.push(r);
      else if (!spec.startsWith(".") && !spec.startsWith("@/"))
        packages.add(
          spec.split("/")[0].startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : spec.split("/")[0],
        );
    }
  }
  return { files, packages };
}

const RELAY_REACHABLE = [
  "src/lib/geo.ts",
  "src/lib/terrain/types.ts",
  "src/lib/map/types.ts",
  "src/lib/map/keys.ts",
  "src/lib/map/teams.ts",
  "src/lib/map/ids.ts",
  "src/lib/map/reduce.ts",
  "src/lib/map/schema.ts",
  "src/lib/realtime/transport.ts",
  "src/lib/realtime/schema.ts",
  "src/lib/room/code.ts",
  "src/lib/room/schema.ts",
  "src/config/site.ts",
];

describe("boundaries", () => {
  it("no component calls useRoomStore.setState", () => {
    const offenders = walk(path.join(SRC, "components")).filter((f) =>
      readFileSync(f, "utf8").includes("useRoomStore.setState"),
    );
    expect(offenders).toEqual([]);
  });

  it("the relay-reachable set uses relative imports only (no @/ alias, no DOM/React/Next)", () => {
    const relay = path.join(ROOT, "server", "relay.ts");
    const entries = [...RELAY_REACHABLE.map((p) => path.join(ROOT, p)), relay].filter((f) =>
      existsSync(f),
    );
    for (const entry of entries) {
      const { files, packages } = reachable(entry);
      for (const f of files) {
        const src = readFileSync(f, "utf8");
        expect(
          src,
          `${path.relative(ROOT, f)} (reached from ${path.relative(ROOT, entry)}) uses the @/ alias`,
        ).not.toMatch(/from\s+["']@\//);
      }
      for (const pkg of packages) {
        expect(
          ["react", "react-dom", "next", "zustand", "motion", "lucide-react", "perfect-freehand"],
          `${path.relative(ROOT, entry)} reaches ${pkg}`,
        ).not.toContain(pkg);
      }
    }
  });

  it("no zod reachable from the home page's client islands and the zod-free storage modules", () => {
    const entries = [
      ...walk(path.join(SRC, "components", "home")),
      path.join(SRC, "lib", "storage", "identity.ts"),
      path.join(SRC, "lib", "storage", "rooms.ts"),
      path.join(SRC, "lib", "room", "code.ts"),
    ].filter((f) => existsSync(f));
    for (const entry of entries) {
      const { packages, files } = reachable(entry);
      expect(
        packages,
        `${path.relative(ROOT, entry)} reaches zod via ${[...files].map((f) => path.relative(ROOT, f)).join(", ")}`,
      ).not.toContain("zod");
    }
  });
});
