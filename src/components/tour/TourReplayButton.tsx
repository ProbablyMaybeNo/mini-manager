"use client";

import { HelpCircle } from "lucide-react";
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
        // Mirror NavLinks' inactive item styling (icon+label, 44px row, mono)
        // so it sits flush in the V2 rail.
        "flex min-h-11 w-full items-center gap-3 pl-5 pr-3 text-left font-mono text-[13px] uppercase tracking-wide text-fg transition-colors hover:bg-fg/[0.04] hover:text-cyan",
        className,
      )}
    >
      <HelpCircle size={16} strokeWidth={2} className="shrink-0" aria-hidden />
      Tutorial
    </button>
  );
}
