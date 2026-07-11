import type { Metadata } from "next";
import Link from "next/link";
import { Button, Chip, Panel } from "@/components/kit";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicPageTitle } from "@/components/public/PublicPageTitle";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AnalyticsEvent } from "@/lib/analytics/events";

export const metadata: Metadata = {
  title: "Pricing · The Mini Mainframe",
  description:
    "See what Free, Pro, and Founder's Lifetime will look like when The Mini Mainframe locks in pricing. Everything is free during the testing period, and testers who give feedback keep their accounts free — forever.",
};

/**
 * Planned launch pricing for this page — hardcoded display copy, not read
 * from billing config.
 *
 * NOTE (lock-date reconciliation): `src/lib/billing/plans.ts` `PLAN_PRICE`
 * is stale against the numbers below — it has `pro_lifetime` at "$25
 * one-time" and `founder` at "$19 one-time", with no pro-monthly/annual
 * split at all. This page intentionally does NOT read from plans.ts (per
 * the pricing-page brief); plans.ts needs its own pass at the real pricing
 * lock date so the two stop disagreeing.
 */

const FREE_FEATURES = [
  "Unlimited paints, models, armies & projects",
  "Collection + spend tracking",
  "Wishlist",
  "Recipes",
  "The basic colour tools (Match, Wheel, Eyedropper) to explore",
  "Focus / session timer",
];

const PRO_FEATURES = [
  "AI recipe generation",
  "Apply tool results — save palettes, send matches into recipes/collection",
  "Advanced colour + layering tools",
  "Planner/calendar + analytics",
  "Store-link imports + army-list auto-build",
  "Browser extension",
  "Recipe sharing",
];

const FOUNDER_FEATURES = ["Founder badge", "Future core features included"];

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-body text-body text-fg">
      <span aria-hidden className="text-green">
        ✓
      </span>
      {children}
    </li>
  );
}

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TrackPageView event={AnalyticsEvent.PricingView} />
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6">
        <div className="flex flex-col items-center text-center">
          <PublicPageTitle>PRICING</PublicPageTitle>
          <p className="mt-3 max-w-xl font-body text-body text-fg-dim">
            What the plans will look like once pricing locks in. Right now, everything&apos;s
            free.
          </p>
        </div>

        <Panel accent="yellow" label="TESTING PERIOD" className="p-5 sm:p-6">
          <p className="font-body text-body text-fg">
            <strong className="text-fg-bright">Everything is free while we&apos;re testing.</strong>{" "}
            The plans below show what pricing is planned to look like at launch — nothing here
            charges you anything today, and none of it is final. We&apos;re shaping these plans
            with feedback from testers, not the other way around.
          </p>
          <div className="mt-4 rounded-[8px] border border-cyan/30 bg-cyan/10 p-4">
            <p className="font-mono text-[13px] font-bold uppercase leading-relaxed tracking-wide text-cyan-lite">
              Give feedback during testing and your account stays free — forever.
            </p>
          </div>
        </Panel>

        <div className="flex justify-center">
          <Link href="/sign-up">
            <Button size="lg">Start free</Button>
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Free */}
          <Panel className="flex flex-col gap-4 p-6">
            <div>
              <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-fg-dim">
                Free
              </h2>
              <p className="mt-1 font-body text-body text-fg-dim">Your whole hobby, organised.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-num1 text-num1 text-fg-bright">$0</span>
              <span className="font-body text-body text-fg-dim">forever</span>
            </div>
            <ul className="flex flex-1 flex-col gap-2">
              {FREE_FEATURES.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button variant="secondary" className="w-full">
                Start free
              </Button>
            </Link>
          </Panel>

          {/* Pro */}
          <Panel className="flex flex-col gap-4 border-green/40 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-green">
                  Pro
                </h2>
                <p className="mt-1 font-body text-body text-fg-dim">
                  The features that save you real time.
                </p>
              </div>
              <Chip accent="yellow" className="shrink-0">
                Planned — free during testing
              </Chip>
            </div>

            <div className="flex flex-col gap-2">
              <div className="rounded-[8px] border border-border p-3">
                <div className="flex items-baseline gap-1">
                  <span className="font-num1 text-num1 text-fg-bright">$3.99</span>
                  <span className="font-body text-body text-fg-dim">/mo</span>
                </div>
                <p className="mt-0.5 font-body text-[12px] text-fg-dim">Billed monthly</p>
              </div>
              <div className="relative rounded-[8px] border border-green/50 bg-green/10 p-3">
                <Chip accent="green" className="absolute -top-2.5 right-3">
                  Best value
                </Chip>
                <div className="flex items-baseline gap-1">
                  <span className="font-num1 text-num1 text-fg-bright">$34.99</span>
                  <span className="font-body text-body text-fg-dim">/yr</span>
                </div>
                <p className="mt-0.5 font-body text-[12px] text-green">~27% off monthly</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <p className="font-body text-body text-fg-dim">Everything in Free, plus:</p>
              <ul className="flex flex-col gap-2">
                {PRO_FEATURES.map((f) => (
                  <Check key={f}>{f}</Check>
                ))}
              </ul>
            </div>
            <Link href="/sign-up">
              <Button className="w-full">Start free</Button>
            </Link>
          </Panel>

          {/* Founder's Lifetime */}
          <Panel className="flex flex-col gap-4 border-purple/30 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-purple">
                  Founder&apos;s Lifetime
                </h2>
                <p className="mt-1 font-body text-body text-fg-dim">
                  Back it early, own it for good.
                </p>
              </div>
              <Chip accent="yellow" className="shrink-0">
                Planned — free during testing
              </Chip>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-num1 text-num1 text-fg-bright">$49.99</span>
              <span className="font-body text-body text-fg-dim">one-time</span>
            </div>
            <Chip accent="purple" className="w-fit">
              Limited launch
            </Chip>
            <div className="flex flex-1 flex-col gap-2">
              <p className="font-body text-body text-fg-dim">
                Everything in Pro, one-time forever:
              </p>
              <ul className="flex flex-col gap-2">
                {FOUNDER_FEATURES.map((f) => (
                  <Check key={f}>{f}</Check>
                ))}
              </ul>
            </div>
            <Link href="/sign-up">
              <Button variant="secondary" className="w-full">
                Start free
              </Button>
            </Link>
          </Panel>
        </div>

        <p className="text-center font-body text-body text-fg-dim">
          Questions?{" "}
          <Link href="/" className="text-cyan-lite underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
