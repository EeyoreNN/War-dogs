// Synchronous in-memory bus for unit tests and the convergence test (§5.2).
import { createPeerTransport, MEMORY_TIMING, type Channel, type PeerTiming } from "./peer";
import type { MemoryBus, Transport, TransportOptions, Unsubscribe, WireMessage } from "./transport";

export function createMemoryBus(): MemoryBus {
  const subs = new Map<object, (msg: WireMessage) => void>();
  return {
    publish(from, msg) {
      for (const [self, cb] of [...subs]) if (self !== from) cb(msg);
    },
    subscribe(self, cb): Unsubscribe {
      subs.set(self, cb);
      return () => {
        subs.delete(self);
      };
    },
  };
}

/** Every message crosses the bus as a JSON clone so shared references cannot leak between clients. */
export function createMemoryTransport(
  bus: MemoryBus,
  opts: TransportOptions,
  timing: PeerTiming = MEMORY_TIMING,
  now?: () => number,
): Transport {
  const openChannel = (): Channel => {
    const self = {};
    let unsub: Unsubscribe | null = null;
    return {
      post: (msg) => bus.publish(self, JSON.parse(JSON.stringify(msg)) as WireMessage),
      onMessage: (cb) => {
        unsub = bus.subscribe(self, cb);
        return () => unsub?.();
      },
      close: () => {
        unsub?.();
        unsub = null;
      },
    };
  };
  return createPeerTransport("memory", openChannel, opts, timing, now);
}
