import * as React from "react";

export function VisuallyHidden({
  children,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  as?: "span" | "div";
}) {
  return <Tag className="sr-only">{children}</Tag>;
}
