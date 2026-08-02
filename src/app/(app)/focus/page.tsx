import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/appData";
import { zeroSessionStats } from "@/mock/fixtures";
import { FocusClient } from "./FocusClient";

export const dynamic = "force-dynamic";

/**
 * Server shell for the FOCUS route — loads the four slices the bench renders
 * and passes them down. Previously the bench read them from MockProvider,
 * which the app layout filled on every route in the app.
 */
export default async function FocusPage() {
  const userId = await currentUserId();
  const data = await loadAppData(userId);
  return (
    <FocusClient
      projects={data.projects ?? []}
      recipes={data.recipes ?? []}
      projectMinutes={data.projectMinutes ?? {}}
      sessionStats={data.sessionStats ?? zeroSessionStats}
    />
  );
}
