"use client";

// The only module that dynamically imports MapApp (§3.13). `children` (the static shell) stays
// visible until MapApp calls `onReady` in its first effect, then gets `hidden` — same box, no CLS.
import * as React from "react";
import dynamic from "next/dynamic";
import type { MapAppProps } from "./MapApp";

const MapApp = dynamic(() => import("./MapApp"), { ssr: false, loading: () => null });

export default function MapAppLoader({
  children,
  onReady: onReadyProp,
  ...props
}: MapAppProps & { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const onReady = React.useCallback(() => {
    setReady(true);
    onReadyProp?.();
  }, [onReadyProp]);
  return (
    <>
      <div hidden={ready} data-shell-wrapper="">
        {children}
      </div>
      <MapApp {...props} onReady={onReady} />
    </>
  );
}
