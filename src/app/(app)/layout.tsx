import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { TourProvider } from "@/components/tour";
import { InstallBanner } from "@/components/pwa";
import { MockProvider } from "@/mock/MockProvider";
import { auth } from "@/auth";
import { loadAppData } from "@/lib/appData";
import { hasSeenTutorial } from "@/db/queries/users";

/**
 * Signed-in surface. Server component: resolves the real session, loads the
 * owner-scoped data behind the kit's data seam, and hands it to the provider
 * (which merges it over the fixtures). Signed-out visitors (e.g. the preview)
 * get `signedIn=false` + pure fixtures so the redesign still demos end-to-end.
 *
 * REBUILD-WIP — auth gating is enforced in proxy.ts (currently pass-through
 * while the kit's AuthView is wired to the real sign-in). Once that lands,
 * this layout can assume a signed-in user.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [data, seenTutorial] = userId
    ? await Promise.all([loadAppData(userId), hasSeenTutorial(userId)])
    : [undefined, true];
  const signedIn = Boolean(userId);

  return (
    <MockProvider variant="populated" signedIn={signedIn} data={data}>
      <TourProvider seen={seenTutorial} signedIn={signedIn}>
        <AppShell signedIn={signedIn}>{children}</AppShell>
        {signedIn && <InstallBanner />}
      </TourProvider>
    </MockProvider>
  );
}
