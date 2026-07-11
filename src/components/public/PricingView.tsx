"use client";

import Link from "next/link";
import { Button, Chip, Panel } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { PricingTier } from "@/lib/types";
import { PublicHeader } from "./PublicHeader";
import { PublicPageTitle } from "./PublicPageTitle";

export function PricingView({
  tiers,
  onChoose,
  betaFree = false,
}: {
  tiers: PricingTier[];
  onChoose: (tierId: string) => void;
  /** During the free intro period, paid tiers show "Free during beta" and the
   *  CTA routes to sign-up instead of opening a live checkout. */
  betaFree?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6">
        <div className="flex flex-col items-center text-center">
          <PublicPageTitle>PRICING</PublicPageTitle>
          <p className="mt-3 font-body text-body text-fg-dim">
            Start free. Upgrade when your paint table outgrows it.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((t) => (
            <Panel
              key={t.id}
              label={t.name.toUpperCase()}
              accent={t.featured ? "green" : "cyan"}
              className={cn(
                "flex flex-col gap-4 p-5 transition-colors duration-150 hover:border-fg/25",
                t.featured && "border-green/40 hover:border-green",
              )}
            >
              {t.featured && (
                <div className="flex items-center justify-between">
                  <Chip accent="green">Limited seat</Chip>
                  <span className="font-body text-body text-yellow">
                    {t.seatsLeft}/{t.seatsTotal} left
                  </span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className="font-num1 text-num1 text-fg-bright">{t.price}</span>
                <span className="font-body text-body text-fg-dim">{t.cadence}</span>
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-body text-body text-fg">
                    <span className="text-green">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.featured && t.seatsLeft != null && t.seatsTotal != null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-green transition-[width] duration-300"
                    style={{ width: `${100 - (t.seatsLeft / t.seatsTotal) * 100}%` }}
                  />
                </div>
              )}
              <Button
                variant={t.featured ? "primary" : "secondary"}
                className="w-full"
                onClick={() => onChoose(t.id)}
              >
                {betaFree && t.id !== "free" ? "Free during beta" : t.cta}
              </Button>
            </Panel>
          ))}
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
