import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_RELAY } from "../storage/keys";
import { A } from "../map/test-fixtures";
import {
  createRelayTransport,
  createTransport,
  DEFAULT_CONNECT_TIMEOUT_MS,
  RELAY_RETRY_MS,
  resolveRelayUrl,
} from "./index";
import { activityRelayUrl, isInsideDiscord } from "./discord-env";

const identity = { client: A, callsign: "Alpha", focus: null, ink: "blue" as const };

class NeverOpens {
  static count = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  static openNext = false;
  constructor(public url: string) {
    NeverOpens.count++;
    if (NeverOpens.openNext) setTimeout(() => this.open(), 10);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("resolveRelayUrl precedence", () => {
  const env = process.env.NEXT_PUBLIC_RELAY_URL;
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    if (env === undefined) delete process.env.NEXT_PUBLIC_RELAY_URL;
    else process.env.NEXT_PUBLIC_RELAY_URL = env;
    localStorage.clear();
  });
  it("undefined without env or override; env otherwise", () => {
    delete process.env.NEXT_PUBLIC_RELAY_URL;
    expect(resolveRelayUrl()).toBeUndefined();
    process.env.NEXT_PUBLIC_RELAY_URL = "wss://relay.example";
    expect(resolveRelayUrl()).toBe("wss://relay.example");
  });
  it("override beats env; 'off' forces LOCAL; junk is ignored", () => {
    process.env.NEXT_PUBLIC_RELAY_URL = "wss://relay.example";
    localStorage.setItem(KEY_RELAY, "ws://127.0.0.1:8787");
    expect(resolveRelayUrl()).toBe("ws://127.0.0.1:8787");
    localStorage.setItem(KEY_RELAY, '"ws://127.0.0.1:8787"');
    expect(resolveRelayUrl()).toBe("ws://127.0.0.1:8787");
    localStorage.setItem(KEY_RELAY, "off");
    expect(resolveRelayUrl()).toBeUndefined();
    localStorage.setItem(KEY_RELAY, "http://evil");
    expect(resolveRelayUrl()).toBe("wss://relay.example");
  });
  it("inside Discord with a relay configured → the /relay mapping on the discordsays host", () => {
    process.env.NEXT_PUBLIC_RELAY_URL = "wss://relay.example";
    window.history.pushState({}, "", "/?frame_id=abc&instance_id=i1");
    expect(isInsideDiscord()).toBe(true);
    expect(activityRelayUrl()).toBe(`wss://${window.location.host}/relay`);
    expect(resolveRelayUrl()).toBe(`wss://${window.location.host}/relay`);
    localStorage.setItem(KEY_RELAY, "off");
    expect(resolveRelayUrl()).toBe(`wss://${window.location.host}/relay`);
    window.history.pushState({}, "", "/");
    expect(isInsideDiscord()).toBe(false);
  });
});

describe("createTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    NeverOpens.count = 0;
    NeverOpens.openNext = false;
    vi.stubGlobal("WebSocket", NeverOpens);
    vi.stubGlobal("BroadcastChannel", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("is broadcast without a relay url", () => {
    expect(createTransport({ getState: () => null }).kind).not.toBe("ws");
  });
  it("falls back to LOCAL after 3 s and upgrades on the 30 s retry", async () => {
    const t = createRelayTransport({ relayUrl: "ws://relay", getState: () => null });
    const statuses: string[] = [];
    t.onStatus((s) => statuses.push(s));
    await t.join("ABC234", identity, 0, null);
    expect(t.status).toBe("connecting");
    vi.advanceTimersByTime(DEFAULT_CONNECT_TIMEOUT_MS + 10);
    expect(t.status).toBe("local");
    expect(t.fellBack).toBe(true);
    expect(statuses).toContain("local");
    NeverOpens.openNext = true;
    const before = NeverOpens.count;
    vi.advanceTimersByTime(RELAY_RETRY_MS + 100);
    expect(NeverOpens.count).toBe(before + 1);
    expect(t.status).toBe("live");
    expect(t.fellBack).toBe(false);
    expect(statuses.at(-1)).toBe("live");
    t.leave();
  });
});
