"use client";

import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { PublicHeader } from "./PublicHeader";

// Feature copy per Ross's landing comments (j5Iy, BjDV, L2LW, eVjJ, XCq8, TXM5).
const FEATURES: { title: string; blurb: string }[] = [
  {
    title: "Library",
    blurb:
      "Search, filter, track, match, and collect with our growing library of 7,144 paints across all major brands.",
  },
  {
    title: "Paint recipes",
    blurb:
      "Pick your paints and plan your projects. Save them for later or share them with friends.",
  },
  {
    title: "Project Dashboard",
    blurb:
      "Plan and track your painting projects using the Mini-Manager dashboard — your whole roster, progress, and deadlines in one place.",
  },
  {
    title: "Focus",
    blurb:
      "Paint recipes, color schemes, notes, techniques, and a timer provide maximum productivity when session painting.",
  },
  {
    title: "Planner",
    blurb:
      "Plan and track your painting progress for upcoming tournaments with deadlines, events, and a built-in calendar.",
  },
  {
    title: "Collection",
    blurb:
      "Plan, manage, and budget your paint and model collections all in one place.",
  },
];

export function LandingView() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      {/* Hero — the title now lives inside the (design-system) enlarged logo, so
          the separate "MINI MANAGER" heading (yIZB) and the boot-sequence panel
          (c2Ess, whose animation moves into the logo) are removed. */}
      <section className="scanlines flex flex-col items-center gap-6 px-6 py-16 text-center">
        <Logo href="/" size={120} className="animate-power-on" />
        {/* Tagline (8rIb) — larger + more stylized display type. */}
        <p className="max-w-2xl font-display text-xl leading-relaxed text-cyan text-glow-cyan sm:text-2xl">
          Plan your projects. Track your paints. Manage your minis.
        </p>
        {/* Single CTA — the secondary "See the plans" button is removed (wN7E). */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg">Start for Free</Button>
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

      {/* Final CTA — copy per REDm6, button per QrK3. */}
      <section className="flex flex-col items-center gap-4 px-6 pb-16 text-center">
        <h2 className="max-w-xl font-display text-lg text-cyan text-glow-cyan">
          Ready to take your hobbying to the next level?
        </h2>
        <p className="max-w-md font-mono text-sm text-fg-dim">
          Gain access to a range of awesome features and tools. Founders receive a big
          discount. Limited availability.
        </p>
        <Link href="/sign-up">
          <Button size="lg">Start for Free</Button>
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
