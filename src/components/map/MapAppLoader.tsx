"use client";

// The only module that dynamically imports MapApp (§3.13). `children` (the static shell) stays
// visible until MapApp calls `onReady` in its first effect, then gets `hidden` — same box, no CLS.
// The page's single h1 lives here (visually hidden, server-rendered): the static shell is
// aria-hidden and MapApp mounts late, so neither can own the document heading.
import * as React from "react";
import dynamic from "next/dynamic";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { MapAppProps } from "./MapApp";

const MapApp = dynamic(() => import("./MapApp"), { ssr: false, loading: () => null });

/** "Live demo · war room DEMO" / "War room ABC234" / "Discord activity · war room ABC234". */
export function pageHeading(mode: MapAppProps["mode"], code: string): string {
  if (mode === "demo") return `Live demo · war room ${code}`;
  if (mode === "activity") return `Discord activity · war room ${code}`;
  return `War room ${code}`;
}

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
      <VisuallyHidden as="div">
        <h1>{pageHeading(props.mode, props.code)}</h1>
      </VisuallyHidden>
      <div hidden={ready} data-shell-wrapper="">
        {children}
      </div>
      <MapApp {...props} onReady={onReady} />
    </>
  );
}
