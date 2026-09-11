"use client";

// Renders `children` (the server-rendered HeroStatic) until the HeroPlayer chunk has loaded, then
// swaps it in place (§3.13). Never loads the player under prefers-reduced-motion or off-screen.
import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const HeroPlayer = dynamic(() => import("./HeroPlayer"), { ssr: false, loading: () => null });

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function HeroFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [wantPlayer, setWantPlayer] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWantPlayer(true);
          io.disconnect();
        }
      },
      { rootMargin: "80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onReady = React.useCallback(() => setReady(true), []);

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="link"
      aria-label="Live preview of the shared map; press Enter to open the demo"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) router.push("/demo");
      }}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      <div hidden={ready} className="absolute inset-0">
        {children}
      </div>
      {wantPlayer ? <HeroPlayer className="absolute inset-0" onReady={onReady} /> : null}
    </div>
  );
}
