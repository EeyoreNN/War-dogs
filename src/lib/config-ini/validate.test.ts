import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INI_KEYS,
  INI_SECTIONS,
  parseIni,
  parseRotationEntry,
  unquote,
  validateIni,
} from "./validate";

const template = readFileSync(join(process.cwd(), "src/content/ServerSettings.ini"), "utf8");

const set = (text: string, key: string, value: string) =>
  text.replace(new RegExp(`^${key.replace("+", "\\+")}=.*$`, "m"), `${key}=${value}`);

describe("parseIni", () => {
  it("splits the template into its seven sections with line numbers", () => {
    const sections = parseIni(template);
    expect(sections.map((s) => s.name)).toEqual(INI_SECTIONS.map((s) => s.name));
    const rcon = sections.find((s) => s.name === "/Script/WDRCON.WDRCONSettings")!;
    const bind = rcon.keys.find((k) => k.key === "BindAddress")!;
    expect(bind.value).toBe("127.0.0.1");
    expect(template.split("\n")[bind.line - 1]).toBe("BindAddress=127.0.0.1");
  });

  it("skips comments and blank lines, keeps `+` list keys and quoted values", () => {
    const s = parseIni('; c\n\n[A]\n# d\n+List="x"\nKey = "v = w"\n');
    expect(s).toEqual([
      {
        name: "A",
        keys: [
          { key: "+List", value: '"x"', line: 5 },
          { key: "Key", value: '"v = w"', line: 6 },
        ],
      },
    ]);
    expect(unquote('"v = w"')).toBe("v = w");
  });

  it("puts keys before any section into an unnamed section", () => {
    expect(parseIni("Orphan=1\n[A]\nK=2")[0]).toEqual({
      name: "",
      keys: [{ key: "Orphan", value: "1", line: 1 }],
    });
  });

  it("merges a repeated section header", () => {
    const s = parseIni("[A]\nK=1\n[B]\nX=1\n[A]\nJ=2");
    expect(s.map((x) => x.name)).toEqual(["A", "B"]);
    expect(s[0].keys.map((k) => k.key)).toEqual(["K", "J"]);
  });
});

describe("validateIni", () => {
  it("validates the shipped template with zero errors and nothing stripped", () => {
    const r = validateIni(template);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.stripped).toEqual([]);
  });

  it("strips an unknown key with a warning and the line number", () => {
    const text = template.replace("ServerName=My Wardogs Server", "ServerName=X\nServerMotd=hi");
    const r = validateIni(text);
    expect(r.ok).toBe(true);
    expect(r.stripped).toEqual(["/Script/WDGame.WDGameSession.ServerMotd"]);
    const issue = r.issues.find((i) => i.code === "unknown-key")!;
    expect(issue.level).toBe("warning");
    expect(issue.key).toBe("ServerMotd");
    expect(text.split("\n")[issue.line! - 1]).toBe("ServerMotd=hi");
    expect(r.warnings).toContain(issue.message);
  });

  it("strips an unknown section", () => {
    const r = validateIni(`${template}\n[/Script/Nope.Settings]\nA=1\nB=2\n`);
    expect(r.stripped).toEqual(["[/Script/Nope.Settings]"]);
    expect(r.issues.find((i) => i.code === "unknown-section")?.message).toMatch(/2 keys/);
  });

  it("flags ScorePeriod=40 as an out-of-range error", () => {
    const r = validateIni(set(template, "ScorePeriod", "40"));
    expect(r.ok).toBe(false);
    const issue = r.issues.find((i) => i.code === "range")!;
    expect(issue.key).toBe("ScorePeriod");
    expect(issue.level).toBe("error");
    expect(issue.message).toMatch(/18–30/);
  });

  it("accepts ScorePeriod at both ends of the range", () => {
    expect(validateIni(set(template, "ScorePeriod", "18")).ok).toBe(true);
    expect(validateIni(set(template, "ScorePeriod", "30")).ok).toBe(true);
  });

  it("rejects a non-integer int and a non-boolean bool", () => {
    const r = validateIni(
      set(template, "MaxPlayers", "lots").replace("bEnabled=false", "bEnabled=yes"),
    );
    const codes = r.issues.filter((i) => i.code === "type").map((i) => i.key);
    expect(codes).toContain("MaxPlayers");
    expect(codes).toContain("bEnabled");
  });

  it("errors on a network listener with a plaintext Password and no PasswordHash", () => {
    const text = set(set(template, "BindAddress", "0.0.0.0"), "Password", "hunter2");
    const r = validateIni(text);
    expect(r.ok).toBe(false);
    const issue = r.issues.find((i) => i.code === "network-needs-hash")!;
    expect(issue.message).toMatch(/network listener needs PasswordHash/i);
    expect(text.split("\n")[issue.line! - 1]).toBe("BindAddress=0.0.0.0");
    // A hash makes it legal.
    expect(
      validateIni(set(text, "PasswordHash", '"abc"')).issues.some(
        (i) => i.code === "network-needs-hash",
      ),
    ).toBe(false);
  });

  it("warns that TLS is required when the listener is enabled on 0.0.0.0", () => {
    const text = set(template, "BindAddress", "0.0.0.0").replace("bEnabled=false", "bEnabled=true");
    const issue = validateIni(text).issues.find((i) => i.code === "tls-required")!;
    expect(issue.level).toBe("warning");
    expect(issue.message).toMatch(/TLS cert and key required/);
    // The rotation section's bEnabled must not be confused with the listener's.
    expect(
      validateIni(set(template, "BindAddress", "0.0.0.0")).issues.some(
        (i) => i.code === "tls-required",
      ),
    ).toBe(false);
  });

  it("warns when MinimumRequiredPlayers exceeds MaxPlayers", () => {
    // The template ships MaxPlayers=32 and MinimumRequiredPlayers=60: the warning is expected there.
    const warned = validateIni(template).issues.find((i) => i.code === "min-over-max");
    expect(warned?.level).toBe("warning");
    expect(warned?.key).toBe("MinimumRequiredPlayers");
    expect(
      validateIni(set(template, "MaxPlayers", "100")).issues.some((i) => i.code === "min-over-max"),
    ).toBe(false);
  });

  it("checks rotation entries", () => {
    const good = parseRotationEntry(
      '(Map="Kavkazi",Experience="Bakurani_KOTH_01",Lighting="DayClear",ZoneAlternator="ZoneAlternator.Factory.Circle")',
    );
    expect(good).toEqual({
      ok: true,
      fields: {
        Map: "Kavkazi",
        Experience: "Bakurani_KOTH_01",
        Lighting: "DayClear",
        ZoneAlternator: "ZoneAlternator.Factory.Circle",
      },
    });
    expect(parseRotationEntry('(Map="Europe",Experiences="A+B",Lighting="DayLateGray")').ok).toBe(
      true,
    );
    expect(parseRotationEntry('Map="Kavkazi"')).toMatchObject({ ok: false });
    expect(parseRotationEntry('(Experience="x")')).toMatchObject({
      ok: false,
      reason: /Map is required/,
    });
    expect(parseRotationEntry('(Map="x")')).toMatchObject({ ok: false, reason: /Experience/ });
    expect(parseRotationEntry('(Map="x",Experience="a",Experiences="b")')).toMatchObject({
      ok: false,
    });
    expect(parseRotationEntry('(Map="x",Experience="a",Foo="b")')).toMatchObject({
      ok: false,
      reason: /unknown field Foo/,
    });
    expect(parseRotationEntry('(Map="x",Experience="a",Map="y")')).toMatchObject({
      ok: false,
      reason: /twice/,
    });
    expect(parseRotationEntry("(Map=x)")).toMatchObject({ ok: false });

    const bad = validateIni(
      template.replace(
        '+RotationEntries=(Map="Kavkazi",Experience="Bakurani_KOTH_01",Lighting="DayClear")',
        '+RotationEntries=(Map="Kavkazi")',
      ),
    );
    const issue = bad.issues.find((i) => i.code === "rotation-entry")!;
    expect(issue.level).toBe("error");
    expect(issue.key).toBe("+RotationEntries");
  });

  it("rejects a bad RotationMode and a malformed SteamID64", () => {
    const r = validateIni(
      set(template, "RotationMode", "Shuffle").replace(
        "MaxReservedSlots=20",
        'MaxReservedSlots=20\n+DefaultReservedPlayerIds="12345"\n+DefaultReservedPlayerIds="76561198000000001"',
      ),
    );
    expect(r.issues.find((i) => i.code === "enum")?.key).toBe("RotationMode");
    const ids = r.issues.filter((i) => i.code === "steamid");
    expect(ids).toHaveLength(1);
    expect(ids[0].message).toMatch(/12345/);
  });

  it("reports syntax errors, orphan keys, duplicates and an empty rotation", () => {
    const r = validateIni(
      "Orphan=1\n[/Script/Engine.GameSession]\ngarbage line\nMaxPlayers=10\nMaxPlayers=12\n[/Script/WDGame.WDServerMapRotationSettings]\nbEnabled=true\n",
    );
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("syntax");
    expect(codes).toContain("orphan-key");
    expect(codes).toContain("duplicate");
    expect(codes).toContain("empty-rotation");
    expect(r.issues.find((i) => i.code === "syntax")?.line).toBe(3);
    expect(r.stripped).toContain("Orphan");
  });

  it("warns on min/max cash inversions, a reserved-slot overflow and a non-URL banner", () => {
    const text = set(
      set(
        set(set(template, "ServerMinPlayerCash", "500"), "ServerMaxPlayerCash", "100"),
        "MaxReservedSlots",
        "64",
      ),
      "ServerImageURL",
      "banner.png",
    );
    const codes = validateIni(text).issues.map((i) => i.code);
    expect(codes).toContain("min-over-max");
    expect(codes).toContain("reserved-over-max");
    expect(codes).toContain("url");
  });

  it("handles an empty document", () => {
    expect(validateIni("")).toMatchObject({
      ok: true,
      issues: [],
      sections: [],
      stripped: [],
      warnings: [],
    });
  });
});

describe("INI_KEYS", () => {
  it("covers every key in the template and only those sections", () => {
    const sections = parseIni(template);
    for (const s of sections)
      for (const k of s.keys)
        expect(
          INI_KEYS.some((d) => d.section === s.name && d.key === k.key),
          `${s.name}.${k.key}`,
        ).toBe(true);
    expect(new Set(INI_KEYS.map((k) => k.section))).toEqual(
      new Set(INI_SECTIONS.map((s) => s.name)),
    );
  });

  it("gives every ranged key an int type and a sane range", () => {
    for (const k of INI_KEYS) {
      if (k.range) {
        expect(k.type).toBe("int");
        expect(k.range[0]).toBeLessThanOrEqual(k.range[1]);
      }
    }
    expect(INI_KEYS.find((k) => k.key === "ScorePeriod")?.range).toEqual([18, 30]);
  });
});
