import { describe, expect, it } from "vitest";
import { activityParams, initActivity } from "./activity";

describe("activity", () => {
  it("reads the frame params", () => {
    expect(activityParams("?frame_id=f&instance_id=i-123&channel_id=c1&guild_id=g1")).toEqual({
      instanceId: "i-123",
      channelId: "c1",
      guildId: "g1",
    });
    expect(activityParams("")).toEqual({ instanceId: null, channelId: null, guildId: null });
  });
  it("returns null without a client id or outside the frame (no SDK import)", async () => {
    expect(await initActivity("")).toBeNull();
    expect(await initActivity("123")).toBeNull();
  });
});
