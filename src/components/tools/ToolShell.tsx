"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/cn";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { PublicHeader } from "@/components/public/PublicHeader";
import { UNLOCKS } from "@/components/public/PricingClient";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import { useMockData } from "@/mock/MockProvider";

/**
 * Common chrome for a single tool: back-to-hub link + title + blurb, and the
 * route-level gate for the tools that still need one.
 *
 * The gate is now PER-TOOL, not blanket (Ross, 2026-09-05). It used to lock
 * every `/tools/*` page, which charged for the colour tools — wheel, match,
 * dropper, stacking — that are pure client-side colour maths and cost nothing
 * to run. The only tool under here with a real marginal cost is the Paint
 * Scanner, which spends Anthropic vision tokens on every scan. So the paid
 * line is now "does this cost money to run", and `requiresPro` marks the one
 * page that does.
 *
 * Client-side UX gate only — `paintScan.ts` re-checks `isProUser` server-side,
 * so this is the front door, never the security boundary.
 */
export function ToolShell({
  title,
  blurb,
  requiresPro = false,
  children,
}: {
  title: string;
  blurb: string;
  /** Set only by tools that cost money per use (the Paint Scanner). */
  requiresPro?: boolean;
  children: React.ReactNode;
}) {
  const isSubscriber = useSubscriber();
  const { signedIn } = useMockData();
  // Starts CLOSED (MUX-010). Auto-opening it on arrival covered the LOCKED
  // card's own "Sponsor" button — verified by hit-testing: the point at the
  // CTA's centre resolved to the modal header — so the page presented the same
  // offer twice and blocked the copy the user had just chosen to read. The card
  // is the offer; the modal opens when they press it.
  const [gateOpen, setGateOpen] = useState(false);

  const page = (
    <div
      className={
        // Signed-out the shell sits under the public header inside a column
        // flex, so it grows instead of claiming the whole viewport.
        signedIn
          ? "flex h-full flex-col gap-4 overflow-x-hidden overflow-y-auto p-3 md:gap-6 md:p-6"
          : "flex flex-1 flex-col gap-4 overflow-x-hidden p-3 md:gap-6 md:p-6"
      }
    >
      {/* ONE control, not two (R3-4). This was a <Link> wrapping a <Button>,
          so every tool page — all five gates included — put an <a> AND a
          <button> in the accessibility tree, both with the accessible name
          "← Tools": the same destination announced twice and a redundant tab
          stop before the page even starts. Going somewhere is a link's job,
          so the button's classes move onto the anchor and the <button> goes
          (which also stops nesting interactive content inside an <a>). */}
      <Link
        href="/tools"
        className={cn(buttonVariants({ variant: "tertiary" }), "self-start")}
      >
        ← Tools
      </Link>
      {/* Blurb is desktop-only — the tool's own controls are right below it and
          the title already names the job (Ross, 2026-07-27 mobile pass). */}
      <PageHeader title={title} tagline={blurb} />
      {!requiresPro || isSubscriber ? (
        children
      ) : (
        <>
          {/* The locked page used to end at y=329 with 59% of the screen empty
              and one way out (paywall audit MUX-P10) — a whole screen spent
              saying "no". It now says what the $3.99 actually buys, reusing the
              same UNLOCKS list /pricing sells from so the two can't drift. */}
          <Panel accent="cyan" label="LOCKED" className="max-w-md p-6">
            {/* Says WHY this one costs, since every other tool is now free —
                without that, a lock on one card out of five reads as arbitrary. */}
            <p className="font-body text-body text-fg">
              ▸ {title} reads your photos with AI, which costs real money per
              scan. Sponsoring covers it — every other tool is free.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-left">
              {UNLOCKS.map((u) => (
                <li key={u} className="flex gap-2 font-body text-body text-fg-dim">
                  <span aria-hidden className="shrink-0 text-cyan-lite">▸</span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
            {/* A stranger who follows a shared tool link has no account yet, so
                asking them for $3.99 is asking for money before they can even
                have somewhere to spend it (audit B1). With no session the
                account comes first and sponsoring is the follow-on; a signed-in
                non-subscriber still gets the sponsor CTA as the primary. */}
            {signedIn ? (
              <Button className="mt-4 min-h-12 w-full" onClick={() => setGateOpen(true)}>
                Sponsor the Mainframe · $3.99/mo →
              </Button>
            ) : (
              <>
                <Link href="/sign-up" className="mt-4 block">
                  <Button className="min-h-12 w-full">Get Started</Button>
                </Link>
                <p className="mt-2 font-body text-body text-fg-dim">
                  No card needed to get started — sponsoring is what unlocks the tools.
                </p>
              </>
            )}
            <Link href="/pricing" className="mt-3 inline-flex min-h-11 items-center font-body text-body text-fg-dim underline-offset-4 hover:text-cyan-lite hover:underline">
              See everything sponsoring unlocks
            </Link>
          </Panel>
          {signedIn && (
            <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
          )}
        </>
      )}
    </div>
  );

  if (signedIn) return page;

  // Signed-out: AppShell renders no chrome at all, so a tool URL shared with a
  // stranger had zero navigation in the document — no sign-in, no sign-up, no
  // way home (audit B1). Bring the marketing header, same as /gallery does.
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      {page}
    </div>
  );
}
