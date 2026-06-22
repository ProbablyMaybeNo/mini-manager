"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { PublicHeader } from "./PublicHeader";

// Feature copy — benefit-led, per Ross's landing pass.
const FEATURES: { title: string; blurb: string }[] = [
  {
    title: "Paint Library",
    blurb:
      "Browse 7,000+ paints from every major brand. Flag what you own, wishlist what you want, and drop any paint straight into a project.",
  },
  {
    title: "Color Tools",
    blurb:
      "Match any colour to real paints, build schemes on the harmony wheel, and predict glaze layers before you commit a drop — the exact paint for the look in your head.",
  },
  {
    title: "Project Dashboard",
    blurb:
      "Every army, unit, and model in one view. Set deadlines, watch your activity feed, and see your whole backlog at a glance.",
  },
  {
    title: "Focus",
    blurb:
      "Your painting companion: recipe, notes, techniques, inspiration, and a session timer on one screen. Sit down, hit start, just paint.",
  },
  {
    title: "Planner",
    blurb:
      "Stay ahead of every tournament and deadline with events and a built-in hobby calendar. Never get caught priming the night before.",
  },
  {
    title: "Collection",
    blurb:
      "Catalogue your paints and models, track what you've spent, and auto-add items from the store as you browse. Know what you own — and what you still need.",
  },
];

const FREE_PERKS = [
  "Unlimited projects — armies, units, models, terrain",
  "Your full collection — log every paint & model, add by pasting a store link",
  "A recipe for every model",
  "The focus bench — recipe, notes, inspiration & a session timer",
  "The entire 7,000+ paint library",
];

const PRO_PERKS = [
  "One-click adds while you browse — drop any paint or model into your collection or wishlist straight from the store page, no copy-paste",
  "Army-list auto-build — paste an army list and it fills your whole project tree in seconds",
  "The full colour toolkit — push matches & schemes straight into recipes, save palettes, predict glaze layers",
  "Unlimited recipes — a recipe for every scheme, variant, and sub-unit",
  "Recipe sharing — share any scheme with a link",
];

/** Respect the OS "reduce motion" setting — reduced users get the static poster. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function LandingView() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      {/* Hero — the animated CRT logo IS the wordmark (its screen reads
          "Mini-Mainframe"); reduced-motion users get the static poster frame. */}
      <section className="scanlines flex flex-col items-center gap-6 px-6 py-16 text-center">
        <h1 className="sr-only">
          The Mini Mainframe — paint &amp; project manager for miniatures
        </h1>
        <div className="w-full max-w-[440px] sm:max-w-lg">
          {reducedMotion ? (
            <Image
              src="/brand/mini-mainframe-logo-poster.jpg"
              alt="The Mini Mainframe"
              width={1080}
              height={1080}
              priority
              className="h-auto w-full"
            />
          ) : (
            <video
              className="h-auto w-full"
              autoPlay
              muted
              loop
              playsInline
              poster="/brand/mini-mainframe-logo-poster.jpg"
              aria-label="The Mini Mainframe"
              width={1080}
              height={1080}
            >
              <source src="/brand/mini-mainframe-logo.mp4" type="video/mp4" />
            </video>
          )}
        </div>
        <p
          className="max-w-2xl text-title leading-relaxed text-cyan text-glow-cyan"
          style={{
            fontFamily:
              '"Flexi IBM VGA False", "Flexi IBM VGA True", "IBM Plex Mono", monospace',
          }}
        >
          Plan your projects. Track your paints. Manage your minis.
        </p>
        <p className="max-w-xl font-body text-body text-fg">
          One command center for your whole hobby — paint library, colour tools, recipes,
          collection, and project tracking, all in one terminal. Free forever. Pro when you
          need it.
        </p>
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
              <p className="font-body text-body text-fg">{f.blurb}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Plans — free vs pro, with the real named benefits */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="font-h1 text-h1 text-purple">Free forever. Pro when you need it.</h2>
          <p className="mt-2 font-body text-body text-fg">
            Run your whole hobby for free — then unlock the power features when you’re ready.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel label="FREE · FOREVER" cornerTicks className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2 text-left">
              {FREE_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-green">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="mt-auto">
              <Button variant="secondary">Start for Free</Button>
            </Link>
          </Panel>
          <Panel
            label="PRO · WHEN YOU NEED IT"
            accent="purple"
            cornerTicks
            className="flex flex-col gap-4 p-6"
          >
            <ul className="flex flex-col gap-2 text-left">
              {PRO_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-purple">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-auto">
              <Button>See Pricing</Button>
            </Link>
          </Panel>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-4 px-6 pb-16 text-center">
        <h2 className="max-w-xl font-h1 text-h1 text-cyan text-glow-cyan">
          Ready to take your hobby to the next level?
        </h2>
        <p className="max-w-md font-body text-body text-fg">
          Your whole painting setup, organized in one terminal. Free to start — no card needed.
        </p>
        <Link href="/sign-up">
          <Button size="lg">Start for Free</Button>
        </Link>
      </section>

      <footer className="border-t border-cyan/20 px-6 py-6 text-center font-body text-body text-fg">
        ▸ THE MINI MAINFRAME · made for painters ·{" "}
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
