import { Badge, type BadgeTone } from "@/components/ui/badge";

const TONE: Record<string, BadgeTone> = {
  GET: "ok",
  POST: "info",
  PUT: "warn",
  PATCH: "warn",
  DELETE: "danger",
};

/** HTTP method badge with the §2.3 semantic colours (GET ok, POST info, PUT/PATCH warn, DELETE danger). */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const m = method.toUpperCase();
  return (
    <Badge tone={TONE[m] ?? "muted"} className={className}>
      {m}
    </Badge>
  );
}
