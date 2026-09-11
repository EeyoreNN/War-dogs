// Supply request lifecycle (§3.4). Pure: every transition returns a patch or an error code.
import type { Point } from "../geo";
import { isCommand } from "./roster";
import type {
  ClientId,
  Focus,
  LayerId,
  RequestKind,
  RequestPatch,
  RequestPriority,
  RosterMember,
  SupplyRequest,
} from "./types";

export type RequestError = "not-open" | "not-claimed" | "not-yours" | "already-delivered";

export const REQUEST_ERROR_TEXT: Record<RequestError, string> = {
  "not-open": "Someone already claimed this request.",
  "not-claimed": "This request is not claimed.",
  "not-yours": "Only the claimer or a commander can do that.",
  "already-delivered": "This request was already delivered.",
};

export const AGING_AFTER_MS = 60_000;
export const STALE_AFTER_MS = 120_000;
export const PRUNE_AFTER_MS = 30 * 60_000;

export function createRequest(input: {
  id: string;
  kind: RequestKind;
  priority: RequestPriority;
  by: ClientId;
  byName: string;
  at: Point | null;
  note: string;
  layer: LayerId;
  now: number;
}): SupplyRequest {
  return {
    id: input.id,
    kind: input.kind,
    status: "open",
    priority: input.priority,
    by: input.by,
    byName: input.byName,
    claimedBy: null,
    claimedByName: null,
    createdAt: input.now,
    claimedAt: null,
    deliveredAt: null,
    etaSec: null,
    at: input.at,
    note: input.note,
    layer: input.layer,
  };
}

const isClaimerOrCommand = (r: SupplyRequest, by: RosterMember) =>
  r.claimedBy === by.id || isCommand(by);

/** open → claimed */
export function claim(
  r: SupplyRequest,
  by: RosterMember,
  now: number,
  etaSec: number | null = null,
): RequestPatch | RequestError {
  if (r.status === "delivered") return "already-delivered";
  if (r.status !== "open") return "not-open";
  return {
    status: "claimed",
    claimedBy: by.id,
    claimedByName: by.callsign,
    claimedAt: now,
    etaSec: etaSec ?? null,
  };
}

/** claimed → delivered; claimer or commander/co-commander */
export function deliver(
  r: SupplyRequest,
  by: RosterMember,
  now: number,
): RequestPatch | RequestError {
  if (r.status === "delivered") return "already-delivered";
  if (r.status !== "claimed") return "not-claimed";
  if (!isClaimerOrCommand(r, by)) return "not-yours";
  return { status: "delivered", deliveredAt: now };
}

/** claimed → open; claimer or commander/co-commander */
export function release(r: SupplyRequest, by: RosterMember): RequestPatch | RequestError {
  if (r.status === "delivered") return "already-delivered";
  if (r.status !== "claimed") return "not-claimed";
  if (!isClaimerOrCommand(r, by)) return "not-yours";
  return { status: "open", claimedBy: null, claimedByName: null, claimedAt: null, etaSec: null };
}

/** claimer only */
export function setEta(
  r: SupplyRequest,
  by: RosterMember,
  etaSec: number | null,
): RequestPatch | RequestError {
  if (r.status === "delivered") return "already-delivered";
  if (r.status !== "claimed") return "not-claimed";
  if (r.claimedBy !== by.id) return "not-yours";
  return { etaSec };
}

/** requester or commander/co-commander */
export function canEdit(r: SupplyRequest, by: RosterMember): boolean {
  return r.by === by.id || isCommand(by);
}

/** open: < 60 s fresh, < 120 s aging, else stale; every other status is fresh. */
export function ageState(r: SupplyRequest, now: number): "fresh" | "aging" | "stale" {
  if (r.status !== "open") return "fresh";
  const age = now - r.createdAt;
  if (age < AGING_AFTER_MS) return "fresh";
  if (age < STALE_AFTER_MS) return "aging";
  return "stale";
}

/** Seconds left on the promised ETA (may be negative); null without a claim or an ETA. */
export function etaRemaining(r: SupplyRequest, now: number): number | null {
  if (r.status !== "claimed" || r.claimedAt === null || r.etaSec === null) return null;
  return r.etaSec - (now - r.claimedAt) / 1000;
}

export function suggestedFocus(kind: RequestKind): Focus[] {
  switch (kind) {
    case "fuel":
    case "ammo":
      return ["pilot", "driver"];
    case "medical":
      return ["medic"];
    default:
      return [];
  }
}

/** Urgent first, then kinds matching my focus, then oldest first. Stable. */
export function rankRequests(
  list: SupplyRequest[],
  me: RosterMember | null,
  now: number,
): SupplyRequest[] {
  void now;
  const focus = me?.focus ?? null;
  const key = (r: SupplyRequest): [number, number, number] => [
    r.priority === "urgent" ? 0 : 1,
    focus !== null && suggestedFocus(r.kind).includes(focus) ? 0 : 1,
    r.createdAt,
  ];
  return list
    .map((r, i) => ({ r, i, k: key(r) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.i - b.i)
    .map((x) => x.r);
}

export type RequestFilter = "all" | "open" | "mine" | "done";

/** all = open + claimed; open = open only; mine = by me OR claimed by me (any status); done = delivered. */
export function filterRequests(
  list: SupplyRequest[],
  filter: RequestFilter,
  me: ClientId | null,
): SupplyRequest[] {
  switch (filter) {
    case "all":
      return list.filter((r) => r.status !== "delivered");
    case "open":
      return list.filter((r) => r.status === "open");
    case "mine":
      return me === null ? [] : list.filter((r) => r.by === me || r.claimedBy === me);
    case "done":
      return list.filter((r) => r.status === "delivered");
  }
}

/** Delivered more than 30 minutes ago. */
export function shouldPrune(r: SupplyRequest, now: number): boolean {
  return r.status === "delivered" && r.deliveredAt !== null && now - r.deliveredAt > PRUNE_AFTER_MS;
}
