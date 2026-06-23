"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useTour } from "./TourProvider";

/**
 * Side-panel "TUTORIAL" entry, rendered below ACCOUNT. Restarts the
 * walkthrough on demand. Styled to read as a nav item (matching NavLinks)
 * but it's a real button — it kicks the tour from step 1, routing to the
 * dashboard first so the dashboard-anchored steps have live targets.
 *
 * Replaying does NOT re-arm the first-run auto-show; the DB "seen" flag is
 * untouched by a manual restart.
 */
export function TourReplayButton({
  onNavigate,
  className,
}: {
  /** Called after the tour starts — lets the mobile menu close itself. */
  onNavigate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { start } = useTour();

  return (
    <button
      type="button"
      data-tour="nav-tutorial"
      onClick={() => {
        router.push("/dashboard");
        start();
        onNavigate?.();
      }}
      className={cn(
        // Mirror NavLinks' inactive item styling (min-h-11 touch target,
        // left accent border, h1 pixel font) so it sits flush in the rail.
        "flex min-h-11 w-full items-center border-l-2 border-transparent px-4 py-2 text-left font-h1 text-h1 uppercase tracking-[0.18em] text-fg transition-colors hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan",
        className,
      )}
    >
      Tutorial
    </button>
  );
}
