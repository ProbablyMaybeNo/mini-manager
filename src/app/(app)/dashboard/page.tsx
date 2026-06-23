import { Suspense } from "react";
import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/appData";
import { zeroSessionStats } from "@/mock/fixtures";
import { DashboardClient } from "./DashboardClient";

// The dashboard reflects the signed-in user's live data, so it must render
// per-request rather than being statically cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await currentUserId();
  const data = await loadAppData(userId);

  return (
    // DashboardClient reads `useSearchParams` (the ?tour=create handoff from
    // the walkthrough's final step), which Next requires under a Suspense
    // boundary — matches the focus / recipes / collection pages.
    <Suspense fallback={null}>
      <DashboardClient
        projects={data.projects ?? []}
        events={data.events ?? []}
        activity={data.activity ?? []}
        sessionStats={data.sessionStats ?? zeroSessionStats}
        projectMinutes={data.projectMinutes ?? {}}
      />
    </Suspense>
  );
}
