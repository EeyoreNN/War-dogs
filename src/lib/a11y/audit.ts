/**
 * The in-page accessibility audit (§7.2 spec 10). `auditPage` is one self-contained function so
 * Playwright can ship it into a page with `page.evaluate(auditPage)` — it must not close over
 * anything outside its own body. It reports: buttons and links without accessible names, inputs
 * without labels, images without alt, duplicate ids, a missing `main`, an `h1` count ≠ 1, and
 * positive tabindex values.
 */
export interface Issue {
  rule:
    | "button-name"
    | "link-name"
    | "input-label"
    | "img-alt"
    | "duplicate-id"
    | "main-missing"
    | "h1-count"
    | "positive-tabindex";
  selector: string;
  detail?: string;
}

export function auditPage(): Issue[] {
  const issues: Issue[] = [];
  const doc = document;

  const path = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur !== doc.body && parts.length < 5) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) part += `#${cur.id}`;
      else {
        const parent: Element | null = cur.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  };

  const hidden = (el: Element): boolean => {
    if (el.closest("[hidden], [aria-hidden='true'], noscript, template")) return true;
    const dialog = el.closest("dialog");
    if (dialog && !dialog.hasAttribute("open")) return true;
    return false;
  };

  const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();

  const accessibleName = (el: Element): string => {
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const names = labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id))
        .filter((n): n is HTMLElement => !!n)
        .map((n) => text(n) || (n as HTMLInputElement).value || "");
      if (names.join(" ").trim()) return names.join(" ").trim();
    }
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const title = el.getAttribute("title");
    const inner = text(el);
    if (inner) return inner;
    const img = el.querySelector("img[alt], svg[aria-label], [aria-label]");
    if (img) {
      const alt = img.getAttribute("alt") ?? img.getAttribute("aria-label");
      if (alt && alt.trim()) return alt.trim();
    }
    if (title && title.trim()) return title.trim();
    return "";
  };

  for (const el of Array.from(doc.querySelectorAll("button, [role='button'], summary"))) {
    if (hidden(el)) continue;
    if (!accessibleName(el)) issues.push({ rule: "button-name", selector: path(el) });
  }
  for (const el of Array.from(doc.querySelectorAll("a[href], [role='link']"))) {
    if (hidden(el)) continue;
    if (!accessibleName(el)) issues.push({ rule: "link-name", selector: path(el) });
  }
  for (const el of Array.from(doc.querySelectorAll("input, select, textarea"))) {
    if (hidden(el)) continue;
    const input = el as HTMLInputElement;
    if (input.type === "hidden" || input.type === "submit" || input.type === "button") continue;
    const labelled =
      accessibleName(el) ||
      (input.id && doc.querySelector(`label[for="${CSS.escape(input.id)}"]`)) ||
      el.closest("label");
    if (!labelled) issues.push({ rule: "input-label", selector: path(el) });
  }
  for (const el of Array.from(doc.querySelectorAll("img"))) {
    if (hidden(el)) continue;
    if (!el.hasAttribute("alt")) issues.push({ rule: "img-alt", selector: path(el) });
  }
  const seen = new Map<string, number>();
  for (const el of Array.from(doc.querySelectorAll("[id]"))) {
    if (el.closest("template")) continue;
    seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  }
  for (const [id, n] of seen)
    if (n > 1) issues.push({ rule: "duplicate-id", selector: `#${id}`, detail: `${n} elements` });
  if (!doc.querySelector("main, [role='main']"))
    issues.push({ rule: "main-missing", selector: "body" });
  const h1s = Array.from(doc.querySelectorAll("h1")).filter((h) => !hidden(h));
  if (h1s.length !== 1)
    issues.push({ rule: "h1-count", selector: "body", detail: `${h1s.length} h1 elements` });
  for (const el of Array.from(doc.querySelectorAll("[tabindex]"))) {
    const v = Number(el.getAttribute("tabindex"));
    if (v > 0) issues.push({ rule: "positive-tabindex", selector: path(el), detail: String(v) });
  }
  return issues;
}
