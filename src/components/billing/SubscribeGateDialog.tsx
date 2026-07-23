"use client";

import { useState } from "react";
import { ModalDialog } from "@/components/kit";
import { startProMonthlyCheckout } from "@/lib/billing/startCheckout";

/**
 * The reusable "you need to sponsor" popup (Phase B,
 * docs/SUBSCRIPTION_PAYWALL.md; copy revised per Ross's review pass — fixes
 * 1 + 6). Same component at every gate point — `/tools/*` route pages, the
 * Tools-hub locked cards, the recipe creator's power-feature tabs, AI
 * recipe generation, army-list import, the Paint Scanner (both entry
 * points), and the library panel's locked-section card.
 *
 * Terminology (fix 6): the word is "Sponsor" everywhere in this copy —
 * never "Subscribe"/"Support"/"Donate". Distinct from the one-off "Feed the
 * Mainframe" tip (Settings page, fix 7) — that's pure support with no
 * unlock; THIS is the monthly sponsorship that unlocks the tools.
 *
 * Copy is locked to Ross's exact wording — do not reword without a product
 * call: the headline itself IS the checkout link ("Sponsor the Mainframe"),
 * not a separate button below a static heading.
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

  function sponsor() {
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
    <ModalDialog open={open} onClose={onClose} title="Sponsor" breadcrumb="MINI MAINFRAME">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={sponsor}
          disabled={pending}
          className="text-left font-h1 text-h1 text-cyan-lite transition-colors hover:text-glow-cyan disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Redirecting…" : "Sponsor the Mainframe →"}
        </button>
        <p className="font-body text-body text-fg">
          Unlock a range of tools to help plan, paint, and track your entire
          wargaming collection.
        </p>
        {error && (
          <p className="font-body text-body text-red-text" role="alert">
            ▸ {error}
          </p>
        )}
      </div>
    </ModalDialog>
  );
}
