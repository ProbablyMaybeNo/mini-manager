"use client";

import Link from "next/link";
import { BootSequence, Button, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { PublicHeader } from "./PublicHeader";

const FEATURES: { title: string; blurb: string }[] = [
  { title: "Cross-brand library", blurb: "7,144 paints across every major company, searchable by colour." },
  { title: "Paint recipes", blurb: "Capture repeatable schemes, attach them to armies, and share." },
  { title: "Army projects", blurb: "Track every unit from wishlist to complete with rolled-up progress." },
  { title: "Focus bench", blurb: "One screen for the session — recipe, timer, progress, inspiration." },
  { title: "Planner", blurb: "Tournaments and deadlines on a calendar that fits your bench." },
  { title: "Collection & budget", blurb: "Paste a store link to track what you own, want, and spent." },
];

export function LandingView() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="scanlines flex flex-col items-center gap-6 px-6 py-16 text-center">
        <Logo href="/" size={120} className="animate-power-on" />
        <h1 className="max-w-2xl font-display text-2xl leading-relaxed text-cyan text-glow-cyan sm:text-3xl">
          MINI MANAGER
        </h1>
        <Panel className="w-full max-w-md p-4 text-left">
          <BootSequence
            lines={[
              "BOOT /mini-manager",
              "MOUNT paint-db … 7,144 colours",
              "LOAD projects · recipes · bench",
              "READY ▸ welcome, painter",
            ]}
          />
        </Panel>
        <p className="max-w-md font-mono text-sm text-fg-dim">
          The command center for miniature &amp; wargaming painters. Projects, paints, recipes,
          and the focus bench — one terminal.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg">Start free — no email required</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="secondary" size="lg">
              See the plans
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Panel key={f.title} label={f.title.toUpperCase()} className="p-5">
              <h2 className="font-osd text-sm uppercase tracking-[0.15em] text-cyan">{f.title}</h2>
              <p className="mt-2 font-mono text-xs text-fg-dim">{f.blurb}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16 text-center">
        <Panel label="PLANS" accent="purple" cornerTicks className="flex flex-col items-center gap-4 p-8">
          <h2 className="font-display text-lg text-purple">Free forever. Pro when you’re ready.</h2>
          <p className="max-w-md font-mono text-xs text-fg-dim">
            Start with one army and the full library at no cost. Founder seats are limited.
          </p>
          <Link href="/pricing">
            <Button>See the plans</Button>
          </Link>
        </Panel>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-4 px-6 pb-16 text-center">
        <h2 className="font-display text-lg text-cyan text-glow-cyan">Power on your paint table.</h2>
        <Link href="/dashboard">
          <Button size="lg">Start free — no email required</Button>
        </Link>
      </section>

      <footer className="border-t border-cyan/20 px-6 py-6 text-center font-mono text-[11px] text-fg-faint">
        ▸ MINI-MANAGER OS · made for painters · {" "}
        <Link href="/pricing" className="text-cyan hover:underline">
          Pricing
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="text-cyan hover:underline">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="text-cyan hover:underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-cyan hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  );
}
