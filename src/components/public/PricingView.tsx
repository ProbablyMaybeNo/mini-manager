"use client";

import Link from "next/link";
import { Button, Chip, Panel } from "@/components/kit";
import type { PricingTier } from "@/lib/types";
import { PublicHeader } from "./PublicHeader";

export function PricingView({
  tiers,
  onChoose,
}: {
  tiers: PricingTier[];
  onChoose: (tierId: string) => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl text-cyan text-glow-cyan sm:text-3xl">PRICING</h1>
          <p className="mt-3 font-mono text-sm text-fg-dim">
            Start free. Upgrade when your paint table outgrows it.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((t) => (
            <Panel
              key={t.id}
              label={t.name.toUpperCase()}
              accent={t.featured ? "purple" : "cyan"}
              cornerTicks={t.featured}
              glow={t.featured}
              className="flex flex-col gap-4 p-5"
            >
              {t.featured && (
                <div className="flex items-center justify-between">
                  <Chip accent="purple">Limited seat</Chip>
                  <span className="font-mono text-[12px] text-yellow">
                    {t.seatsLeft}/{t.seatsTotal} left
                  </span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className="font-display text-xl text-fg">{t.price}</span>
                <span className="font-mono text-xs text-fg-faint">{t.cadence}</span>
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-mono text-xs text-fg-dim">
                    <span className="text-green">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.featured && t.seatsLeft != null && t.seatsTotal != null && (
                <div className="h-1 w-full border border-purple/40">
                  <div
                    className="h-full bg-purple"
                    style={{ width: `${100 - (t.seatsLeft / t.seatsTotal) * 100}%` }}
                  />
                </div>
              )}
              <Button
                variant={t.featured ? "primary" : "secondary"}
                className="w-full"
                onClick={() => onChoose(t.id)}
              >
                {t.cta}
              </Button>
            </Panel>
          ))}
        </div>

        <p className="text-center font-mono text-xs text-fg-faint">
          Questions?{" "}
          <Link href="/" className="text-cyan hover:underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
