import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("copyText", () => {
  afterEach(() => setClipboard(undefined));

  it("resolves true after a successful write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText("ABC234")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("ABC234");
  });

  it("resolves false when the API is missing (insecure context, old WebView)", async () => {
    setClipboard(undefined);
    await expect(copyText("x")).resolves.toBe(false);
    setClipboard({});
    await expect(copyText("x")).resolves.toBe(false);
  });

  it("resolves false when the write is refused, without throwing", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException("denied")) });
    await expect(copyText("x")).resolves.toBe(false);
  });
});
