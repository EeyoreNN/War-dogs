// The dispatch permission table (§5.1): what each role may emit. Housekeeping bypasses it.
import { canEdit } from "@/lib/map/requests";
import { canDraw, editableLayer, isCommand } from "@/lib/map/roster";
import type {
  ClientId,
  LayerId,
  OpBody,
  RoomState,
  RosterMember,
  RosterPatch,
} from "@/lib/map/types";

export type Mode = "room" | "demo" | "activity";

const SELF_KEYS: (keyof RosterPatch)[] = [
  "online",
  "callsign",
  "focus",
  "ink",
  "squad",
  "drawRequested",
  "lastSeen",
];
const OTHER_KEYS: (keyof RosterPatch)[] = ["canDraw", "drawRequested", "role"];

const layerEditable = (layer: LayerId, me: RosterMember, s: RoomState): boolean =>
  isCommand(me) || layer === editableLayer(s.settings, me);

/** true when `me` may emit `body` against `state`. */
export function canDispatch(
  body: OpBody,
  me: RosterMember | null,
  state: RoomState,
  self: ClientId,
  mode: Mode,
): boolean {
  void mode;
  switch (body.t) {
    case "node.add":
      return (
        !!me &&
        canDraw(me, state.settings) &&
        body.nodes.every((n) => layerEditable(n.layer, me, state))
      );
    case "node.update": {
      if (!me || !canDraw(me, state.settings)) return false;
      const n = state.nodes[body.id];
      if (!n) return false;
      if (!layerEditable(n.layer, me, state)) return false;
      return body.patch.layer === undefined || layerEditable(body.patch.layer, me, state);
    }
    case "node.remove":
      return (
        !!me &&
        canDraw(me, state.settings) &&
        body.ids.every((id) => !state.nodes[id] || layerEditable(state.nodes[id].layer, me, state))
      );
    case "layer.clear":
      if (!me || !canDraw(me, state.settings)) return false;
      if (isCommand(me)) return true;
      return (
        state.settings.squadMode &&
        body.layer === editableLayer(state.settings, me) &&
        body.layer !== "team"
      );
    case "request.add":
      return body.request.by === self;
    case "request.update": {
      if (!me) return false;
      const r = state.requests[body.id];
      if (!r) return false;
      if (canEdit(r, me) || r.claimedBy === self) return true;
      return (
        r.status === "open" && body.patch.status === "claimed" && body.patch.claimedBy === self
      );
    }
    case "request.remove": {
      if (!me) return false;
      const r = state.requests[body.id];
      return !!r && canEdit(r, me);
    }
    case "roster.upsert":
      return body.member.id === self || isCommand(me);
    case "roster.update": {
      const keys = Object.keys(body.patch) as (keyof RosterPatch)[];
      if (body.id === self) {
        // Self: identity keys; command roles may also clear their own flags and step down.
        return keys.every(
          (k) =>
            SELF_KEYS.includes(k) ||
            (isCommand(me) && (k === "canDraw" || k === "drawRequested")) ||
            (k === "role" && me?.role === "commander" && body.patch.role !== "commander"),
        );
      }
      if (!isCommand(me)) return false;
      if (!keys.every((k) => OTHER_KEYS.includes(k))) return false;
      if (body.patch.role === "commander" && me?.role !== "commander") return false;
      return true;
    }
    case "roster.remove":
      return body.id !== self && isCommand(me);
    case "settings.update":
      return isCommand(me);
  }
}
