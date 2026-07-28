"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { useSubscriber } from "@/lib/billing/SubscriberContext";

/**
 * Common chrome for a single tool: back-to-hub link + title + blurb — and,
 * as of the subscription paywall, the ROUTE-LEVEL gate for every `/tools/*`
 * page. Every tool page renders through this shell, so gating it here is
 * the single choke point for "non-subscribers hitting a tool page get the
 * gate" (docs/SUBSCRIPTION_PAYWALL.md Phase C). This is a client-side UX
 * gate only — every server action a tool can reach re-checks `isProUser`
 * itself, so this never IS the security boundary, just the front door.
 */
export function ToolShell({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  const isSubscriber = useSubscriber();
  // Starts CLOSED (MUX-010). Auto-opening it on arrival covered the LOCKED
  // card's own "Sponsor" button — verified by hit-testing: the point at the
  // CTA's centre resolved to the modal header — so the page presented the same
  // offer twice and blocked the copy the user had just chosen to read. The card
  // is the offer; the modal opens when they press it.
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 overflow-x-hidden overflow-y-auto p-3 md:gap-6 md:p-6">
      <Link href="/tools" className="self-start">
        <Button variant="tertiary">← Tools</Button>
      </Link>
      {/* Blurb is desktop-only — the tool's own controls are right below it and
          the title already names the job (Ross, 2026-07-27 mobile pass). */}
      <PageHeader title={title} tagline={blurb} />
      {isSubscriber ? (
        children
      ) : (
        <>
          <Panel accent="cyan" label="LOCKED" className="max-w-md p-6">
            <p className="font-body text-body text-fg">
              ▸ {title} is part of the tool suite — sponsor to unlock it.
            </p>
            <Button className="mt-4" onClick={() => setGateOpen(true)}>
              Sponsor · $3.99/mo →
            </Button>
          </Panel>
          <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
        </>
      )}
    </div>
  );
}
