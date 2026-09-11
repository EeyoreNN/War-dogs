import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { terrainUrl } from "./url";

describe("terrainUrl", () => {
  it("builds the cached route URL with defaults", () => {
    expect(terrainUrl("zestafona")).toBe(
      `/terrain/zestafona.svg?size=1024&zone=none&grid=0&labels=1&v=${site.version}`,
    );
  });
  it("encodes every option", () => {
    expect(terrainUrl("ozeti", { size: 320, zone: "houses", grid: true, labels: false })).toBe(
      `/terrain/ozeti.svg?size=320&zone=houses&grid=1&labels=0&v=${site.version}`,
    );
  });
});
