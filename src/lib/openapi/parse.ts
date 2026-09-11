/**
 * A small OpenAPI 3 reader for `src/content/openapi.json`: enough to list every operation,
 * resolve `$ref`s, build a form from a schema, and print copy-paste snippets. No dependency.
 */

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
export interface SchemaNode {
  type: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  enum?: string[];
  nullable?: boolean;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}
export interface Param {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  schema: SchemaNode;
  description?: string;
}
export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  params: Param[];
  body: { contentType: string; schema: SchemaNode; required: boolean } | null;
  responses: { status: string; description: string; schema: SchemaNode | null }[];
  auth: boolean;
  write: boolean;
}
export interface ParsedSpec {
  info: { title: string; version: string; updated: string };
  servers: { url: string; description: string }[];
  tags: string[];
  endpoints: Endpoint[];
}

const METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

function deref(node: unknown, root: Obj, seen: Set<string> = new Set()): Obj {
  if (!isObj(node)) return {};
  const ref = node.$ref;
  if (typeof ref !== "string") return node;
  if (seen.has(ref)) return { type: "object", description: `circular ${ref}` };
  seen.add(ref);
  const parts = ref.replace(/^#\//, "").split("/");
  let cur: unknown = root;
  for (const p of parts) cur = isObj(cur) ? cur[p] : undefined;
  return deref(cur, root, seen);
}

function toSchema(raw: unknown, root: Obj, depth = 0): SchemaNode {
  const s = deref(raw, root);
  // An untyped node (`items: {}`) means "anything"; report it as such rather than guessing.
  const node: SchemaNode = {
    type: str(s.type, isObj(s.properties) ? "object" : Array.isArray(s.enum) ? "string" : "any"),
  };
  if (isObj(s.properties) && depth < 12) {
    node.properties = {};
    for (const [k, v] of Object.entries(s.properties))
      node.properties[k] = toSchema(v, root, depth + 1);
  }
  if (s.items !== undefined && depth < 12) node.items = toSchema(s.items, root, depth + 1);
  if (Array.isArray(s.required))
    node.required = s.required.filter((x): x is string => typeof x === "string");
  if (Array.isArray(s.enum)) node.enum = s.enum.map(String);
  if (s.nullable === true) node.nullable = true;
  if (typeof s.description === "string") node.description = s.description;
  if (typeof s.format === "string") node.format = s.format;
  if (typeof s.minimum === "number") node.minimum = s.minimum;
  if (typeof s.maximum === "number") node.maximum = s.maximum;
  if (s.default !== undefined) node.default = s.default;
  return node;
}

/** Stable operation id: `post-v1-players-steamId-kick`. */
export function endpointId(method: string, path: string): string {
  return `${method.toLowerCase()}-${path
    .replace(/[{}]/g, "")
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

function parseParams(list: unknown, root: Obj): Param[] {
  if (!Array.isArray(list)) return [];
  const out: Param[] = [];
  for (const raw of list) {
    const p = deref(raw, root);
    const where = str(p.in);
    if (where !== "path" && where !== "query" && where !== "header") continue;
    out.push({
      name: str(p.name),
      in: where,
      required: where === "path" ? true : p.required === true,
      schema: toSchema(p.schema ?? { type: "string" }, root),
      ...(typeof p.description === "string" ? { description: p.description } : {}),
    });
  }
  return out;
}

export function parseSpec(spec: unknown): ParsedSpec {
  const root: Obj = isObj(spec) ? spec : {};
  const info = isObj(root.info) ? root.info : {};
  const rootSecured = Array.isArray(root.security) && root.security.length > 0;

  const servers: ParsedSpec["servers"] = [];
  if (Array.isArray(root.servers)) {
    for (const raw of root.servers) {
      if (!isObj(raw)) continue;
      let url = str(raw.url);
      if (isObj(raw.variables)) {
        for (const [name, v] of Object.entries(raw.variables)) {
          const def = isObj(v) ? str(v.default) : "";
          url = url.replace(`{${name}}`, def);
        }
      }
      servers.push({ url, description: str(raw.description) });
    }
  }

  const declaredTags: string[] = Array.isArray(root.tags)
    ? root.tags.map((t) => (isObj(t) ? str(t.name) : str(t))).filter(Boolean)
    : [];
  const tagSet = new Set<string>(declaredTags);

  const endpoints: Endpoint[] = [];
  const paths = isObj(root.paths) ? root.paths : {};
  for (const [path, item] of Object.entries(paths)) {
    if (!isObj(item)) continue;
    const shared = parseParams(item.parameters, root);
    for (const method of METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      const own = parseParams(op.parameters, root);
      const params = [
        ...shared.filter((s) => !own.some((o) => o.name === s.name && o.in === s.in)),
        ...own,
      ];
      const order = { path: 0, query: 1, header: 2 } as const;
      params.sort((a, b) => order[a.in] - order[b.in]);

      let body: Endpoint["body"] = null;
      const rb = deref(op.requestBody, root);
      if (isObj(rb.content)) {
        const [contentType, media] = Object.entries(rb.content)[0] ?? [];
        if (contentType && isObj(media)) {
          body = {
            contentType,
            schema: toSchema(media.schema ?? { type: "string" }, root),
            required: rb.required === true,
          };
        }
      }

      const responses: Endpoint["responses"] = [];
      if (isObj(op.responses)) {
        for (const [status, raw] of Object.entries(op.responses)) {
          const r = deref(raw, root);
          let schema: SchemaNode | null = null;
          if (isObj(r.content)) {
            const media = Object.values(r.content)[0];
            if (isObj(media) && media.schema !== undefined) schema = toSchema(media.schema, root);
          }
          responses.push({ status, description: str(r.description), schema });
        }
      }

      const tags = Array.isArray(op.tags) ? op.tags.map(String) : [];
      const tag = tags[0] ?? "Other";
      tagSet.add(tag);
      const auth = Array.isArray(op.security) ? op.security.length > 0 : rootSecured;

      endpoints.push({
        id:
          typeof op.operationId === "string" && op.operationId
            ? op.operationId
            : endpointId(method, path),
        method,
        path,
        tag,
        summary: str(op.summary),
        ...(typeof op.description === "string" ? { description: op.description } : {}),
        params,
        body,
        responses,
        auth,
        write: method !== "get",
      });
    }
  }

  return {
    info: {
      title: str(info.title),
      version: str(info.version),
      updated: str(info["x-lastUpdated"], str(info["x-updated"])),
    },
    servers,
    tags: [...tagSet],
    endpoints,
  };
}

/* ───────────────────────────── examples ───────────────────────────── */

const EXAMPLE_BY_NAME: Record<string, unknown> = {
  steamId: "76561198000000001",
  reason: "team killing",
  message: "Regroup at the Default zone.",
  faction: "Valkyra",
  lighting: "Day Clear",
  map: "zestafona",
  zoneAlternator: "default",
  experiences: ["King of the Hill"],
  imageUrl: "https://example.test/banner.png",
  scoreTick: 24,
  rotationEnabled: true,
  rotationMode: "ordered",
  limit: 50,
};

function exampleValue(schema: SchemaNode, name?: string): unknown {
  if (schema.enum && schema.enum.length) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;
  if (name && name in EXAMPLE_BY_NAME) return EXAMPLE_BY_NAME[name];
  switch (schema.type) {
    case "object": {
      if (!schema.properties) return {};
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties)) out[k] = exampleValue(v, k);
      return out;
    }
    case "array":
      return schema.items ? [exampleValue(schema.items)] : [];
    case "integer":
    case "number": {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? min + 10;
      return Math.min(max, Math.max(min, 1));
    }
    case "boolean":
      return false;
    default:
      return schema.format === "date-time" ? "2026-09-11T04:00:00Z" : "string";
  }
}

/** Deterministic example body: every property filled, enums at their first value. */
export function exampleFor(schema: SchemaNode): unknown {
  return exampleValue(schema);
}

/* ───────────────────────────── snippets ───────────────────────────── */

export function fillPath(path: string, values: Record<string, unknown>): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = values[name];
    return v === undefined || v === null || v === "" ? `{${name}}` : encodeURIComponent(String(v));
  });
}

function trimBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/** Full URL with path params filled and non-empty query params appended. */
export function buildUrl(e: Endpoint, base: string, values: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const p of e.params) {
    if (p.in !== "query") continue;
    const v = values[p.name];
    if (v === undefined || v === null || v === "") continue;
    qs.set(p.name, String(v));
  }
  const q = qs.toString();
  return `${trimBase(base)}${fillPath(e.path, values)}${q ? `?${q}` : ""}`;
}

function headerParams(e: Endpoint, values: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const p of e.params) {
    if (p.in !== "header") continue;
    const v = values[p.name];
    if (v === undefined || v === null || v === "") continue;
    out.push([p.name, String(v)]);
  }
  return out;
}

function serialiseBody(e: Endpoint, body: unknown): string | null {
  if (!e.body || body === undefined || body === null) return null;
  if (e.body.contentType === "application/json")
    return typeof body === "string" ? body : JSON.stringify(body, null, 2);
  return typeof body === "string" ? body : String(body);
}

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(
  e: Endpoint,
  base: string,
  token: string,
  values: Record<string, unknown>,
  body: unknown,
): string {
  const lines = [`curl -X ${e.method.toUpperCase()} ${sh(buildUrl(e, base, values))}`];
  if (e.auth) lines.push(`  -H ${sh(`Authorization: Bearer ${token || "<token>"}`)}`);
  for (const [k, v] of headerParams(e, values)) lines.push(`  -H ${sh(`${k}: ${v}`)}`);
  const payload = serialiseBody(e, body);
  if (payload !== null && e.body) {
    lines.push(`  -H ${sh(`Content-Type: ${e.body.contentType}`)}`);
    lines.push(`  --data-raw ${sh(payload)}`);
  }
  return lines.join(" \\\n");
}

export function toFetch(
  e: Endpoint,
  base: string,
  token: string,
  values: Record<string, unknown>,
  body: unknown,
): string {
  const headers: string[] = [];
  if (e.auth) headers.push(`    Authorization: ${JSON.stringify(`Bearer ${token || "<token>"}`)}`);
  for (const [k, v] of headerParams(e, values))
    headers.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const payload = serialiseBody(e, body);
  if (payload !== null && e.body)
    headers.push(`    "Content-Type": ${JSON.stringify(e.body.contentType)}`);
  const lines = [
    `const res = await fetch(${JSON.stringify(buildUrl(e, base, values))}, {`,
    `  method: ${JSON.stringify(e.method.toUpperCase())},`,
  ];
  if (headers.length) lines.push(`  headers: {`, headers.join(",\n"), `  },`);
  if (payload !== null) lines.push(`  body: ${JSON.stringify(payload)},`);
  lines.push(`});`, `console.log(res.status, await res.text());`);
  return lines.join("\n");
}

const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function toPowerShell(
  e: Endpoint,
  base: string,
  token: string,
  values: Record<string, unknown>,
  body: unknown,
): string {
  const method = e.method[0].toUpperCase() + e.method.slice(1);
  const headers: string[] = [];
  if (e.auth) headers.push(`Authorization = ${ps(`Bearer ${token || "<token>"}`)}`);
  for (const [k, v] of headerParams(e, values)) headers.push(`${ps(k)} = ${ps(v)}`);
  const payload = serialiseBody(e, body);
  const lines = [`Invoke-RestMethod -Method ${method} -Uri ${ps(buildUrl(e, base, values))}`];
  if (headers.length) lines.push(`  -Headers @{ ${headers.join("; ")} }`);
  if (payload !== null && e.body)
    lines.push(`  -ContentType ${ps(e.body.contentType)}`, `  -Body ${ps(payload)}`);
  return lines.join(" `\n");
}
