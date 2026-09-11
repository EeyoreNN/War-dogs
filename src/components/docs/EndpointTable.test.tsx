import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getSpec } from "@/lib/openapi/match";
import { EndpointTable, filterEndpoints } from "./EndpointTable";
import { tokenize } from "./highlight";

const { endpoints } = getSpec();

describe("filterEndpoints", () => {
  it("filters by access and searches path, method, tag and summary", () => {
    expect(filterEndpoints(endpoints, "all", "")).toHaveLength(endpoints.length);
    const reads = filterEndpoints(endpoints, "read", "");
    const writes = filterEndpoints(endpoints, "write", "");
    expect(reads.length + writes.length).toBe(endpoints.length);
    expect(reads.every((e) => !e.write)).toBe(true);
    expect(filterEndpoints(endpoints, "all", "STATUS").some((e) => e.path === "/v1/status")).toBe(
      true,
    );
    expect(filterEndpoints(endpoints, "all", "delete").every((e) => e.method === "delete")).toBe(
      true,
    );
    expect(filterEndpoints(endpoints, "all", "zzz-nothing")).toEqual([]);
  });
});

describe("EndpointTable", () => {
  it("renders every row with a console deep link and filters on input", () => {
    render(<EndpointTable endpoints={endpoints} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(endpoints.length);
    expect(links[0].getAttribute("href")).toMatch(/^\/rcon-api\?endpoint=/);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bans" } });
    expect(screen.getAllByRole("link").length).toBeLessThan(endpoints.length);
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(screen.getAllByRole("link").every((l) => l.textContent?.includes("bans"))).toBe(true);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing-here" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });
});

describe("tokenize", () => {
  it("colours ini comments, sections, keys and values, and leaves unknown languages plain", () => {
    const t = tokenize("[A]\n; c\nKey=true\n", "ini");
    expect(t.find((x) => x.text === "[A]")?.cls).toBe("tok-s");
    expect(t.find((x) => x.text === "; c")?.cls).toBe("tok-c");
    expect(t.find((x) => x.text === "Key")?.cls).toBe("tok-k");
    expect(t.find((x) => x.text === "true")?.cls).toBe("tok-n");
    expect(t.map((x) => x.text).join("")).toBe("[A]\n; c\nKey=true\n");
    expect(tokenize("x", "nope")).toEqual([{ text: "x" }]);
    const j = tokenize('{ "a": 1 }', "json");
    expect(j.find((x) => x.text === '"a"')?.cls).toBe("tok-k");
    expect(j.find((x) => x.text === "1")?.cls).toBe("tok-n");
  });
});
