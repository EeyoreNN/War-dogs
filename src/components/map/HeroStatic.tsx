// Server component (§3.13): the finished demo plan as a static MapPreview — the LCP element and
// the no-JS fallback for the home hero.
import { heroFinalState } from "@/lib/map/scenario";
import { cn } from "@/lib/utils";
import { HeroChrome } from "./HeroChrome";
import { MapPreview } from "./MapPreview";

export function HeroStatic({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <HeroChrome />
      <div className="relative min-h-0 flex-1">
        <MapPreview
          state={heroFinalState()}
          priority
          fit="cover"
          title="The shared map replaying a demo plan on Zestafona"
        />
      </div>
    </div>
  );
}
