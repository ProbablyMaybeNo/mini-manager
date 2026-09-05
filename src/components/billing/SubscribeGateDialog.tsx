"use client";

import { useState } from "react";
import { Button, ModalDialog } from "@/components/kit";
import { startProMonthlyCheckout } from "@/lib/billing/startCheckout";

/**
 * The reusable "you need to sponsor" popup (Phase B,
 * docs/SUBSCRIPTION_PAYWALL.md; copy revised per Ross's review pass — fixes
 * 1 + 6). Same component at every remaining gate point — AI recipe
 * generation, army-list import, and the Paint Scanner (both entry points).
 * The tool routes, the recipe creator's tabs and the library panel's colour
 * science used to render it too; those are free as of 2026-09-05, because the
 * paid line is now "does this cost money to run".
 *
 * Terminology (fix 6): the word is "Sponsor" everywhere in this copy —
 * never "Subscribe"/"Support"/"Donate". Distinct from the one-off "Feed the
 * Mainframe" tip (Settings page, fix 7) — that's pure support with no
 * unlock; THIS is the monthly sponsorship that unlocks the tools.
 *
 * Copy is locked to Ross's exact wording — do not reword without a product
 * call. The phrase stays "Sponsor the Mainframe"; what changed (paywall audit,
 * 2026-07-28) is its PRESENTATION and the addition of the price:
 *
 *  - It was styled as a 21px `font-h1` heading with no border or fill, sitting
 *    directly under a near-identical cyan "SPONSOR" title. Nothing marked it as
 *    tappable, and its 22px hit area failed WCAG 2.5.8 — on the single control
 *    in the entire app that takes money. It's a real Button now.
 *  - The modal stated no price AND rendered on top of the `$3.99/MO` button
 *    behind it, so the moment of commitment carried no terms at all. The price
 *    now rides on the CTA and is repeated in the body.
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
        <p className="font-body text-body text-fg">
          The app and every colour tool are free. This one runs on AI, which
          costs real money each time — sponsoring covers it.
        </p>
        <Button
          size="lg"
          className="min-h-12 w-full"
          onClick={sponsor}
          disabled={pending}
        >
          {pending ? "Redirecting…" : "Sponsor the Mainframe · $3.99/mo →"}
        </Button>
        <p className="font-body text-body text-fg-dim">
          $3.99 a month. Cancel any time.
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
