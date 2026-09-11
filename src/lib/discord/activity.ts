// The only importer of @discord/embedded-app-sdk (§4.7, §7.3); loaded by ActivityShell alone.
export interface ActivityContext {
  instanceId: string;
  channelId: string | null;
  guildId: string | null;
  openExternal: (url: string) => void;
}

/** Discord's iframe passes these on the URL (`frame_id`, `instance_id`, `channel_id`, `guild_id`). */
export function activityParams(search: string): {
  instanceId: string | null;
  channelId: string | null;
  guildId: string | null;
} {
  const q = new URLSearchParams(search);
  return {
    instanceId: q.get("instance_id"),
    channelId: q.get("channel_id"),
    guildId: q.get("guild_id"),
  };
}

/**
 * `new DiscordSDK(clientId)` → `ready()`; null on failure or when not embedded. `openExternal`
 * wraps `sdk.commands.openExternalLink` (in-app navigation is impossible inside the frame).
 */
export async function initActivity(clientId: string): Promise<ActivityContext | null> {
  if (typeof window === "undefined" || !clientId) return null;
  const params = activityParams(window.location.search);
  if (!params.instanceId) return null;
  try {
    const { DiscordSDK } = await import("@discord/embedded-app-sdk");
    const sdk = new DiscordSDK(clientId);
    await sdk.ready();
    return {
      instanceId: sdk.instanceId || params.instanceId,
      channelId: sdk.channelId ?? params.channelId,
      guildId: sdk.guildId ?? params.guildId,
      openExternal: (url) => {
        void sdk.commands.openExternalLink({ url }).catch(() => undefined);
      },
    };
  } catch {
    return null;
  }
}
