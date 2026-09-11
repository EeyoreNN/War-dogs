import * as React from "react";

/** The row of stat chips under a docs intro: mono label, strong value (e.g. `RCON API · /v1 · 35 endpoints`). */
export function Stats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="not-prose mt-6 flex flex-wrap gap-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline gap-2 rounded-sm border border-line bg-bg-1 px-3 py-1.5"
        >
          <dt className="font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase">
            {s.label}
          </dt>
          <dd className="font-mono text-[12px] text-fg">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
