import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { TourProvider } from "@/components/tour";
import { InstallBanner } from "@/components/pwa";
import { MockProvider } from "@/mock/MockProvider";
import { auth } from "@/auth";
import { hasSeenTutorial } from "@/db/queries/users";
import { isProUser } from "@/lib/billing/enforce";
import { SubscriberProvider } from "@/lib/billing/SubscriberContext";

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
  // The layout deliberately loads NO account data (Ross, 2026-08-02 — "make
  // it faster"). It used to call loadAppData and hand the whole account to
  // MockProvider, which meant every route — and every server action's
  // re-render, since a revalidated route re-renders its layout — serialized
  // every project, recipe, event and activity row the user owns. On the
  // dashboard that account was then serialized a SECOND time as props to
  // DashboardClient. Pages that need data load it themselves and pass props;
  // the only components that still read the provider want `signedIn`.
  const [seenTutorial, subscriber] = userId
    ? await Promise.all([hasSeenTutorial(userId), isProUser(userId)])
    : [true, false];
  const signedIn = Boolean(userId);

  return (
    <SubscriberProvider isSubscriber={subscriber}>
      <MockProvider variant="populated" signedIn={signedIn}>
        <TourProvider seen={seenTutorial} signedIn={signedIn}>
          <AppShell signedIn={signedIn}>{children}</AppShell>
          {signedIn && <InstallBanner />}
        </TourProvider>
      </MockProvider>
    </SubscriberProvider>
  );
}
