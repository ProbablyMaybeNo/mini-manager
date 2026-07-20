"use client";

import { useState } from "react";
import { Button, ModalDialog } from "@/components/kit";
import { startProMonthlyCheckout } from "@/lib/billing/startCheckout";

/**
 * The reusable "you need to subscribe" popup (Phase B,
 * docs/SUBSCRIPTION_PAYWALL.md). Same component at every gate point —
 * `/tools/*` route pages, the Tools-hub locked cards, the recipe creator's
 * power-feature tabs, AI recipe generation, army-list import, and the
 * library panel's locked-section card. Copy is locked by the spec; do not
 * reword without a product call.
 */
export function SubscribeGateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    setPending(true);
    void startProMonthlyCheckout().then((res) => {
      if (!res.ok) {
        setPending(false);
        setError(res.error ?? "Could not start checkout. Try again.");
      }
      // res.ok === true means the browser is already navigating away
      // (Stripe, or a sign-in bounce) — stay pending until that lands.
    });
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Subscribe to unlock the tools"
      breadcrumb="SUPPORT THE MAINFRAME"
    >
      <p className="font-body text-body text-fg">
        Support the Mainframe and unlock a whole range of useful tools —
        tracking, managing, and painting your minis has never been easier.
      </p>
      {error && (
        <p className="mt-3 font-body text-body text-red-text" role="alert">
          ▸ {error}
        </p>
      )}
      <Button className="mt-4 w-full" onClick={subscribe} disabled={pending}>
        {pending ? "Redirecting…" : "Subscribe · $3.99/mo →"}
      </Button>
    </ModalDialog>
  );
}
