"use client";

// Upload your own map (§4.3.6): PNG / JPEG / WebP ≤ 8 MB → letterbox → full + shared variants →
// IDB → settings.update { mapSource } → chunked broadcast of the shared bytes (§5.7).
import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { putMap } from "@/lib/storage/idb";
import { now, useRoomStore } from "@/store/room";
import { updateSettings } from "./actions";
import { processUpload } from "./lib/upload";
import { resetUploadedBitmaps } from "./useTerrain";

export function UploadMap() {
  const source = useRoomStore((s) => s.state?.settings.mapSource ?? null);
  const shareMap = useRoomStore((s) => s.shareMap);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await processUpload(file);
      if ("code" in result) {
        toast(result.message, { tone: "danger" });
        return;
      }
      await putMap(result.hash, {
        shared: result.shared,
        full: result.full,
        w: result.w,
        h: result.h,
        mime: result.mime,
        name: result.name,
        at: now(),
      });
      resetUploadedBitmaps();
      updateSettings({
        mapSource: {
          kind: "upload",
          hash: result.hash,
          w: result.w,
          h: result.h,
          mime: result.mime,
          name: result.name,
        },
      });
      shareMap(result.sharedBytes, {
        hash: result.hash,
        mime: result.mime,
        w: result.w,
        h: result.h,
      });
      toast(`Map "${result.name}" is now the room's map.`, { tone: "ok" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        PNG, JPEG or WebP up to 8 MB. It is letterboxed to a square, shared with the room at 1024 px
        and kept in this browser at full size. Uploaded maps have no scale, so Measure shows map
        fractions.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload your own map"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <Upload size={16} aria-hidden="true" />
          Upload your own map
        </Button>
        {source?.kind === "upload" ? (
          <Button
            variant="ghost"
            onClick={() => updateSettings({ mapSource: { kind: "builtin" } })}
          >
            Use built-in map
          </Button>
        ) : null}
      </div>
      {source?.kind === "upload" ? (
        <p className="font-mono text-[11px] tracking-[0.06em] text-fg-muted">
          Current: {source.name} · {source.w}×{source.h}
        </p>
      ) : null}
    </div>
  );
}
