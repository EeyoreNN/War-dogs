import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith(".woff2"));
const layout = readFileSync(join(dir, "..", "layout.tsx"), "utf8");

/** Table tags of a WOFF2 file (the directory is uncompressed; only table data is brotli). */
function woff2Tables(buf: Buffer): string[] {
  const KNOWN =
    "cmap,head,hhea,hmtx,maxp,name,OS/2,post,cvt ,fpgm,glyf,loca,prep,CFF ,VORG,EBDT,EBLC,gasp,hdmx,kern,LTSH,PCLT,VDMX,vhea,vmtx,BASE,GDEF,GPOS,GSUB,EBSC,JSTF,MATH,CBDT,CBLC,COLR,CPAL,SVG ,sbix,acnt,avar,bdat,bloc,bsln,cvar,fdsc,feat,fmtx,fvar,gvar,hsty,just,lcar,mort,morx,opbd,prop,trak,Zapf,Silf,Glat,Gloc,Feat,Sill".split(
      ",",
    );
  const base128 = (i: number): [number, number] => {
    let v = 0;
    for (let n = 0; n < 5; n++) {
      const b = buf[i++]!;
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return [v, i];
    }
    throw new Error("bad UIntBase128");
  };
  expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2");
  const numTables = buf.readUInt16BE(12);
  const tags: string[] = [];
  let i = 48;
  for (let t = 0; t < numTables; t++) {
    const flags = buf[i++]!;
    let tag: string;
    if ((flags & 0x3f) === 63) {
      tag = buf.subarray(i, i + 4).toString("latin1");
      i += 4;
    } else tag = KNOWN[flags & 0x3f]!;
    [, i] = base128(i); // origLength
    const transform = (flags >> 6) & 3;
    const isGlyfLoca = tag === "glyf" || tag === "loca";
    if ((isGlyfLoca && transform === 0) || (!isGlyfLoca && transform !== 0)) [, i] = base128(i);
    tags.push(tag.trim());
  }
  return tags;
}

describe("src/app/fonts", () => {
  it("ships no duplicate faces (every woff2 has a distinct hash)", () => {
    const hashes = files.map((f) =>
      createHash("sha256")
        .update(readFileSync(join(dir, f)))
        .digest("hex"),
    );
    expect(new Set(hashes).size).toBe(files.length);
  });

  it("declares every shipped file in layout.tsx and no file that is not shipped", () => {
    const declared = [...layout.matchAll(/\.\/fonts\/([\w-]+\.woff2)/g)].map((m) => m[1]);
    expect([...declared].sort()).toEqual([...files].sort());
  });

  it("JetBrains Mono is one variable face so 500 / 700 mono text really renders heavier", () => {
    const mono = files.filter((f) => f.startsWith("jetbrains"));
    expect(mono).toEqual(["jetbrains-mono-latin.woff2"]);
    expect(woff2Tables(readFileSync(join(dir, mono[0]!)))).toEqual(
      expect.arrayContaining(["fvar", "gvar"]),
    );
    expect(layout).toMatch(/jetbrains-mono-latin\.woff2", weight: "400 700"/);
  });

  it("only the Saira weight that renders (800, the `display` utility) is shipped", () => {
    expect(files.filter((f) => f.startsWith("saira"))).toEqual(["saira-condensed-800-latin.woff2"]);
  });

  it("mono is not preloaded (§7.3): it is below the fold on every marketing page", () => {
    const jetbrains = layout.slice(
      layout.indexOf("const jetbrains"),
      layout.indexOf("export const metadata"),
    );
    expect(jetbrains).toMatch(/preload: false/);
  });
});
