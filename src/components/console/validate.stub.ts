/*
 * Local test double for WP5's `validateIni` (§3.10 signature) so the console's config
 * endpoints work before merge 1. Replaced by `import { validateIni } from "@/lib/config-ini/validate"`
 * in Phase 2 and deleted. Covers the checks the simulator's ConfigResult needs: sections and
 * keys with line numbers, ScorePeriod range, the network-listener password rule, TLS warning.
 */

export interface IniIssue {
  line: number | null;
  level: "error" | "warning";
  code: string;
  message: string;
  key?: string;
}
export interface IniValidation {
  ok: boolean;
  issues: IniIssue[];
  sections: { name: string; keys: { key: string; value: string; line: number }[] }[];
  stripped: string[];
  warnings: string[];
}

export function parseIni(text: string): IniValidation["sections"] {
  const sections: IniValidation["sections"] = [];
  let cur: IniValidation["sections"][number] | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) return;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      cur = { name: sec[1], keys: [] };
      sections.push(cur);
      return;
    }
    const eq = line.indexOf("=");
    if (eq < 0) return;
    if (!cur) {
      cur = { name: "", keys: [] };
      sections.push(cur);
    }
    cur.keys.push({ key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim(), line: i + 1 });
  });
  return sections;
}

export function validateIni(text: string): IniValidation {
  const sections = parseIni(text);
  const issues: IniIssue[] = [];
  const warnings: string[] = [];
  const find = (key: string) => {
    for (const s of sections) for (const k of s.keys) if (k.key === key) return k;
    return null;
  };
  const score = find("ScorePeriod");
  if (score) {
    const n = Number(score.value);
    if (!Number.isInteger(n) || n < 18 || n > 30)
      issues.push({
        line: score.line,
        level: "error",
        code: "range",
        key: "ScorePeriod",
        message: "ScorePeriod must be a whole number from 18 to 30.",
      });
  }
  const bind = find("BindAddress");
  const password = find("Password");
  const hash = find("PasswordHash");
  const hashSet = Boolean(hash && hash.value.replace(/"/g, "").trim());
  if (bind?.value === "0.0.0.0" && password?.value && !hashSet)
    issues.push({
      line: bind.line,
      level: "error",
      code: "network-password",
      key: "BindAddress",
      message: "network listener needs PasswordHash",
    });
  const enabled = find("bEnabled");
  if (enabled?.value.toLowerCase() === "true" && bind?.value === "0.0.0.0") {
    issues.push({
      line: enabled.line,
      level: "warning",
      code: "tls",
      key: "bEnabled",
      message: "TLS cert and key required",
    });
    warnings.push("TLS cert and key required");
  }
  const min = find("MinimumRequiredPlayers");
  const max = find("MaxPlayers");
  if (min && max && Number(min.value) > Number(max.value)) {
    issues.push({
      line: min.line,
      level: "warning",
      code: "min-gt-max",
      key: "MinimumRequiredPlayers",
      message: "MinimumRequiredPlayers is above MaxPlayers.",
    });
    warnings.push("MinimumRequiredPlayers is above MaxPlayers.");
  }
  return { ok: issues.every((i) => i.level !== "error"), issues, sections, stripped: [], warnings };
}
