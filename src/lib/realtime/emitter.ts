// A tiny typed listener set shared by the transports.
import type { Unsubscribe } from "./transport";

export interface Emitter<T> {
  on(cb: (v: T) => void): Unsubscribe;
  emit(v: T): void;
  clear(): void;
  readonly size: number;
}

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(v: T) => void>();
  return {
    on(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emit(v) {
      for (const cb of [...listeners]) {
        try {
          cb(v);
        } catch (e) {
          if (process.env.NODE_ENV !== "production") console.error("[wardogs] listener threw", e);
        }
      }
    },
    clear() {
      listeners.clear();
    },
    get size() {
      return listeners.size;
    },
  };
}
