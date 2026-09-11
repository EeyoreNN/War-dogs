import spec from "@/content/openapi.json";
import { parseSpec, type Endpoint, type ParsedSpec } from "./parse";

/** The parsed spec, once per bundle. */
let cached: ParsedSpec | null = null;
export function getSpec(): ParsedSpec {
  if (!cached) cached = parseSpec(spec);
  return cached;
}

const patternCache = new Map<string, { re: RegExp; keys: string[] }>();
function patternFor(e: Endpoint) {
  let hit = patternCache.get(e.id);
  if (!hit) {
    const keys: string[] = [];
    const re = new RegExp(
      `^${e.path.replace(/\{([^}]+)\}/g, (_, k: string) => {
        keys.push(k);
        return "([^/]+)";
      })}$`,
    );
    hit = { re, keys };
    patternCache.set(e.id, hit);
  }
  return hit;
}

/** Find the spec operation an RCON call (method + concrete path) corresponds to. */
export function matchEndpoint(
  method: string,
  path: string,
): { endpoint: Endpoint; values: Record<string, string> } | null {
  const m = method.toLowerCase();
  const clean = path.split("?")[0];
  for (const e of getSpec().endpoints) {
    if (e.method !== m) continue;
    const { re, keys } = patternFor(e);
    const hit = re.exec(clean);
    if (!hit) continue;
    const values: Record<string, string> = {};
    keys.forEach((k, i) => {
      try {
        values[k] = decodeURIComponent(hit[i + 1]);
      } catch {
        values[k] = hit[i + 1];
      }
    });
    return { endpoint: e, values };
  }
  return null;
}
