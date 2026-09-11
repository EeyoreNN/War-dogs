// BroadcastChannel transport (§5.2): channel `wardogs:<ROOM>`. Where BroadcastChannel is missing
// the factory returns the memory transport on a private bus (this tab only); the pill says LOCAL.
import { createMemoryBus, createMemoryTransport } from "./memory";
import { BROADCAST_TIMING, createPeerTransport, type Channel } from "./peer";
import type { Transport, TransportOptions, WireMessage } from "./transport";

export const channelName = (room: string): string => `wardogs:${room}`;

export function hasBroadcastChannel(): boolean {
  return typeof BroadcastChannel === "function";
}

export function createBroadcastTransport(opts: TransportOptions): Transport {
  if (!hasBroadcastChannel())
    return createMemoryTransport(createMemoryBus(), opts, BROADCAST_TIMING);
  const openChannel = (room: string): Channel => {
    const bc = new BroadcastChannel(channelName(room));
    return {
      post: (msg: WireMessage) => bc.postMessage(msg),
      onMessage: (cb) => {
        const handler = (e: MessageEvent) => cb(e.data);
        bc.addEventListener("message", handler);
        return () => bc.removeEventListener("message", handler);
      },
      close: () => bc.close(),
    };
  };
  return createPeerTransport("broadcast", openChannel, opts, BROADCAST_TIMING);
}
