"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Client-side subscriber-status seam (Phase B, docs/SUBSCRIPTION_PAYWALL.md).
 *
 * Seeded ONCE server-side in `src/app/(app)/layout.tsx` from
 * `isProUser(userId)` (src/lib/billing/enforce.ts — the real server helper)
 * and handed down via `SubscriberProvider`, so every client component in the
 * signed-in shell reads the same value with zero extra fetches. Signed-out /
 * no-session renders default to `false`.
 *
 * This is a UX signal only — every gated server action re-checks `isProUser`
 * itself (defence in depth), so a stale/spoofed client value here can hide a
 * gate behind a client error at worst, never grant access to anything real.
 */
const SubscriberContext = createContext<boolean>(false);

export function SubscriberProvider({
  isSubscriber,
  children,
}: {
  isSubscriber: boolean;
  children: ReactNode;
}) {
  return (
    <SubscriberContext.Provider value={isSubscriber}>
      {children}
    </SubscriberContext.Provider>
  );
}

/** Whether the signed-in user has an active subscription (or any other
 *  unlimited plan tier — lifetime/founder resolve true too, though only
 *  pro_monthly is sold). See docs/SUBSCRIPTION_PAYWALL.md for the boundary
 *  this backs. */
export function useSubscriber(): boolean {
  return useContext(SubscriberContext);
}
