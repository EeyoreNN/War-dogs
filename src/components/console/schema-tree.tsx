import type { SchemaNode } from "@/lib/openapi/parse";

function typeLabel(n: SchemaNode): string {
  if (n.type === "array") return `${n.items ? typeLabel(n.items) : "any"}[]`;
  if (n.enum) return n.enum.join(" | ");
  return n.type + (n.nullable ? " | null" : "") + (n.format ? ` (${n.format})` : "");
}

/** Collapsible rendering of a response / request schema. */
export function SchemaTree({
  schema,
  name,
  required,
  depth = 0,
}: {
  schema: SchemaNode;
  name?: string;
  required?: boolean;
  depth?: number;
}) {
  const children =
    schema.type === "array" && schema.items?.properties
      ? schema.items.properties
      : schema.properties;
  const childRequired =
    schema.type === "array" ? (schema.items?.required ?? []) : (schema.required ?? []);
  const row = (
    <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12px]">
      {name ? <span className="text-fg">{name}</span> : null}
      {required ? <span className="text-accent">*</span> : null}
      <span className="text-fg-faint">{typeLabel(schema)}</span>
      {schema.description ? (
        <span className="font-sans text-[12px] text-fg-muted">{schema.description}</span>
      ) : null}
    </span>
  );
  if (!children || Object.keys(children).length === 0) return <div className="py-0.5">{row}</div>;
  return (
    <details open={depth < 2} className="py-0.5">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block w-3 text-fg-faint" aria-hidden="true">
          ▸
        </span>
        {row}
      </summary>
      <div className="ml-4 border-l border-line pl-3">
        {Object.entries(children).map(([k, v]) => (
          <SchemaTree
            key={k}
            name={k}
            schema={v}
            required={childRequired.includes(k)}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  );
}
