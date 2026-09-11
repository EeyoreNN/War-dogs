/**
 * Copy text to the clipboard; `false` when the API is missing (insecure context, old WebView)
 * or refuses (permission, inert iframe). One guard for `CopyButton`, the top bar's room-code
 * copy and the plan export, so the fallback behaviour cannot drift.
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (typeof clipboard?.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
