import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// jsdom ships no SubtleCrypto: install Node's webcrypto so SHA-256 and getRandomValues work in
// every suite. Node-only suites (`server/**`, sockets) start with `// @vitest-environment node`.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
