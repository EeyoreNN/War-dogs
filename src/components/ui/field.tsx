import * as React from "react";
import { Label } from "./input";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  /** Id of the control; also the base for the helper / error ids. */
  htmlFor: string;
  helper?: string;
  error?: string;
  /** Rendered on the label row, right-aligned (e.g. a "Generate" button). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function joinIds(...ids: (string | undefined)[]) {
  const s = ids.filter(Boolean).join(" ");
  return s || undefined;
}

type WirableProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Label + control + helper / error. When `children` is a single element it receives `id`,
 * `aria-describedby` (helper and error ids) and `aria-invalid` automatically.
 */
export function Field({
  label,
  htmlFor,
  helper,
  error,
  trailing,
  children,
  className,
}: FieldProps) {
  const helperId = helper ? `${htmlFor}-helper` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  const control = React.isValidElement<WirableProps>(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? htmlFor,
        "aria-describedby": joinIds(errorId, helperId, children.props["aria-describedby"]),
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor} className="mb-0">
          {label}
        </Label>
        {trailing}
      </div>
      {control}
      {helper ? (
        <p id={helperId} className="mt-2 text-sm text-fg-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
