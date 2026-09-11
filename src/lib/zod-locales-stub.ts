/**
 * Replaces zod's `v4/locales/index.js` barrel at build time (next.config.ts `resolveAlias`,
 * §7.3). Every zod entry does `export * as locales from "../locales/index.js"`, and the
 * namespace export keeps all 64 locale tables (~90 kB gzip) in the shared chunk even though the
 * app only ever uses English. `z.config(z.locales.en())` keeps working; other locales are not
 * shipped.
 */
export { default as en } from "zod/v4/locales/en.js";
