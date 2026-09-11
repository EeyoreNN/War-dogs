// User-initiated downloads (§4.3.6): an <a download> created at click time. Inert inside the
// Discord iframe — callers in activity mode show the "Downloads are blocked" dialog instead.
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// The clipboard guard is shared with `CopyButton` (§4.3.6): one implementation in `@/lib`.
export { copyText } from "@/lib/clipboard";

let audio: AudioContext | null = null;

/** A short click for new requests when sound is on — generated, no asset (§4.3.2). */
export function playClick(): void {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1320, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch {
    /* audio is best-effort */
  }
}
