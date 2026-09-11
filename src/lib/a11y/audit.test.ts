import { beforeEach, describe, expect, it } from "vitest";
import { auditPage } from "./audit";

describe("auditPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("passes a well-formed page", () => {
    document.body.innerHTML = `
      <main><h1>Title</h1>
        <button aria-label="Close"><svg></svg></button>
        <a href="/x">Go</a>
        <label for="i">Name</label><input id="i" />
        <img src="a.png" alt="" />
        <div tabindex="0"></div>
      </main>`;
    expect(auditPage()).toEqual([]);
  });

  it("reports every rule", () => {
    document.body.innerHTML = `
      <div>
        <button></button>
        <a href="/x"><svg></svg></a>
        <input type="text" />
        <img src="a.png" />
        <p id="dup"></p><p id="dup"></p>
        <h1>a</h1><h1>b</h1>
        <div tabindex="3"></div>
      </div>`;
    const rules = auditPage().map((i) => i.rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        "button-name",
        "link-name",
        "input-label",
        "img-alt",
        "duplicate-id",
        "main-missing",
        "h1-count",
        "positive-tabindex",
      ]),
    );
  });

  it("ignores hidden content and closed dialogs", () => {
    document.body.innerHTML = `
      <main><h1>T</h1>
        <div hidden><button></button></div>
        <dialog><button></button></dialog>
        <span aria-hidden="true"><a href="/x"></a></span>
      </main>`;
    expect(auditPage()).toEqual([]);
  });

  it("is self-contained so Playwright can serialise it", () => {
    const src = auditPage.toString();
    expect(src).not.toMatch(/\bimport\b/);
    expect(src).not.toMatch(/require\(/);
  });
});
