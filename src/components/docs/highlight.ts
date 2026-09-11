/**
 * A tiny tokenizer for the three languages the docs show (ini, json, http). Returns tokens
 * with a class name from docs.css; anything unknown is rendered as plain text. Pure.
 */
export type Token = { text: string; cls?: string };

const rules: Record<string, [RegExp, string | null][]> = {
  ini: [
    [/^[ \t]*[;#].*$|\/\/.*$/m, "tok-c"],
    [/^[ \t]*\[[^\]]+\]/m, "tok-s"],
    [/^[ \t]*\+?[A-Za-z_][\w.]*(?=[ \t]*=)/m, "tok-k"],
    [/"[^"\n]*"/, "tok-s"],
    [/\b(true|false)\b/, "tok-n"],
    [/\b\d+(?:\.\d+)?\b/, "tok-n"],
  ],
  json: [
    [/\/\/.*$/m, "tok-c"],
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "tok-k"],
    [/"(?:[^"\\]|\\.)*"/, "tok-s"],
    [/\b(?:true|false|null)\b/, "tok-n"],
    [/-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, "tok-n"],
    [/[{}[\]:,]/, "tok-p"],
  ],
  http: [
    [/\/\/.*$/m, "tok-c"],
    [/^(?:GET|POST|PUT|PATCH|DELETE)\b/m, "tok-m"],
    [/\{[A-Za-z_]+\}|<[a-z-]+>/, "tok-s"],
    [/^[A-Za-z-]+(?=:)/m, "tok-k"],
  ],
  bash: [
    [/#.*$/m, "tok-c"],
    [/^\$\s/m, "tok-p"],
    [/'[^'\n]*'|"[^"\n]*"/, "tok-s"],
    [/(?:^|\s)-{1,2}[A-Za-z][\w-]*/, "tok-k"],
  ],
};

export function tokenize(code: string, lang?: string): Token[] {
  const set = lang ? rules[lang] : undefined;
  if (!set) return [{ text: code }];
  const out: Token[] = [];
  let rest = code;
  while (rest.length) {
    let best: { index: number; len: number; cls: string | null } | null = null;
    for (const [re, cls] of set) {
      const m = re.exec(rest);
      if (m && m[0].length > 0 && (best === null || m.index < best.index)) {
        best = { index: m.index, len: m[0].length, cls };
      }
    }
    if (!best) {
      out.push({ text: rest });
      break;
    }
    if (best.index > 0) out.push({ text: rest.slice(0, best.index) });
    out.push({ text: rest.slice(best.index, best.index + best.len), cls: best.cls ?? undefined });
    rest = rest.slice(best.index + best.len);
  }
  return out;
}
