"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Endpoint } from "@/lib/openapi/parse";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";

type Filter = "all" | "read" | "write";

const METHOD_TONE: Record<Endpoint["method"], BadgeTone> = {
  get: "ok",
  post: "info",
  put: "warn",
  patch: "accent",
  delete: "danger",
};

/** Matches method, path, group and summary; case-insensitive substring, no dependency. */
export function filterEndpoints(endpoints: Endpoint[], filter: Filter, query: string): Endpoint[] {
  const q = query.trim().toLowerCase();
  return endpoints.filter((e) => {
    if (filter === "read" && e.write) return false;
    if (filter === "write" && !e.write) return false;
    if (!q) return true;
    return (
      e.method.includes(q) ||
      e.path.toLowerCase().includes(q) ||
      e.tag.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      (e.description?.toLowerCase().includes(q) ?? false)
    );
  });
}

function bodyNote(e: Endpoint): string | null {
  if (!e.body) return null;
  if (e.body.contentType.startsWith("text/")) return "Body: the config document as text/plain.";
  const keys = Object.keys(e.body.schema.properties ?? {});
  if (keys.length === 0) return `Body: ${e.body.contentType}.`;
  const req = new Set(e.body.schema.required ?? []);
  return `Body: { ${keys.map((k) => (req.has(k) ? k : `${k}?`)).join(", ")} }`;
}

/** The generated endpoint table on /rcon-reference (§4.9): filter chips, search, deep links. */
export function EndpointTable({ endpoints }: { endpoints: Endpoint[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(
    () => filterEndpoints(endpoints, filter, query),
    [endpoints, filter, query],
  );
  const id = React.useId();

  return (
    <div className="not-prose">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter by access" className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["read", "Read"],
              ["write", "Write"],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} selected={filter === v} onClick={() => setFilter(v)}>
              {label}
            </Chip>
          ))}
        </div>
        <div role="search" className="relative min-w-0 flex-1 basis-56">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search endpoints by path, method or description
          </label>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint"
          />
          <Input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search path, method or description"
            autoComplete="off"
            className="h-10 pl-9 font-mono text-[13px]"
          />
        </div>
        <p
          className="font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase"
          aria-live="polite"
        >
          {rows.length} of {endpoints.length} endpoints
        </p>
      </div>

      <div className="-mx-6 mt-4 scrollbar-thin overflow-x-auto sm:mx-0">
        <table className="docs-table min-w-[640px]">
          <caption className="sr-only">Every endpoint under /v1</caption>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Path</th>
              <th scope="col">Group</th>
              <th scope="col">Access</th>
              <th scope="col">Description &amp; body</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-fg-muted">
                  Nothing matches “{query}”. Try a path segment like <code>players</code>.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const note = bodyNote(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <Badge tone={METHOD_TONE[e.method]}>{e.method}</Badge>
                    </td>
                    <td>
                      <Link
                        href={`/rcon-api?endpoint=${encodeURIComponent(e.id)}`}
                        className="font-mono text-[13px] text-fg underline decoration-line-hi underline-offset-4 hover:text-accent hover:decoration-accent"
                      >
                        {e.path.split(/(\{[^}]+\})/).map((part, i) =>
                          part.startsWith("{") ? (
                            <span key={i} className="text-accent">
                              {part}
                            </span>
                          ) : (
                            <React.Fragment key={i}>{part}</React.Fragment>
                          ),
                        )}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap capitalize">{e.tag}</td>
                    <td>
                      <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                        {e.write ? "Write" : "Read"}
                      </span>
                    </td>
                    <td>
                      <span className="text-fg">{e.summary}</span>
                      {note ? (
                        <span className="mt-1 block font-mono text-[12px] text-fg-muted">
                          {note}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
