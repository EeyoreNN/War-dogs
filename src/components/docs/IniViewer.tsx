import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { INI_KEYS, INI_SECTIONS, parseIni, unquote } from "@/lib/config-ini/validate";

/**
 * The annotated template (§4.9): one `<details>` per section, each key as a row — key mono
 * accent, default chip, applies-when chip, description — plus the value the template ships when
 * it differs from the default. Server component; reads `INI_KEYS` so it cannot drift from the
 * validator.
 */
export function IniViewer({ template }: { template: string }) {
  const parsed = parseIni(template);
  return (
    <div className="not-prose flex flex-col gap-3">
      {INI_SECTIONS.map((section, i) => {
        const keys = INI_KEYS.filter((k) => k.section === section.name);
        const inTemplate = parsed.find((s) => s.name === section.name);
        return (
          <details
            key={section.name}
            open={i === 0}
            className="group rounded-md border border-line bg-bg-1 open:border-line-strong"
          >
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 select-none sm:px-5">
              <span className="text-[15px] font-semibold text-fg">{section.label}</span>
              <code className="font-mono text-[12px] text-fg-muted">[{section.name}]</code>
              <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
                {keys.length} key{keys.length === 1 ? "" : "s"}
              </span>
            </summary>
            <ul className="border-t border-line">
              {keys.map((k) => {
                const set = inTemplate?.keys.filter((x) => x.key === k.key) ?? [];
                const value = set.length ? unquote(set[set.length - 1].value) : null;
                const shows =
                  value !== null &&
                  value !== "" &&
                  value !== unquote(k.default) &&
                  k.type !== "list";
                return (
                  <li
                    key={k.key}
                    className="grid gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:px-5"
                  >
                    <div className="min-w-0">
                      <code className="font-mono text-[13px] font-medium break-all text-accent">
                        {k.key}
                      </code>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone="muted" title="Default">
                          {k.default}
                        </Badge>
                        {k.applies !== "—" ? (
                          <Badge tone="accent" title="Applies">
                            {k.applies}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[14px] leading-relaxed text-fg-muted">
                      {k.description}
                      {shows ? (
                        <span className="mt-1 block font-mono text-[12px] text-fg-faint">
                          template: {value}
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
