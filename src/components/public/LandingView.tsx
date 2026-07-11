"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
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
    title: "Projects",
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

// Real in-app screens (captured 2026-07-10, 1440×900) — no mockups.
const SHOWCASE: { src: string; label: string; alt: string; caption: string }[] = [
  {
    src: "/showcase/library.png",
    label: "PAINT LIBRARY",
    alt: "The Mini Mainframe paint library — a grid of thousands of paint swatches mapped by colour",
    caption:
      "Every paint on the market — 7,000+ across every major brand — mapped by colour. Flag what you own, wishlist the rest.",
  },
  {
    src: "/showcase/color-wheel.png",
    label: "COLOUR TOOLS",
    alt: "The colour wheel tool matching a picked colour to the closest real paints",
    caption:
      "Spin the wheel, pick a harmony, and match every colour to a real paint you can buy — then send it straight to a recipe.",
  },
  {
    src: "/showcase/focus.png",
    label: "FOCUS BENCH",
    alt: "The Focus screen showing a recipe, notes, session timer and progress for one model",
    caption:
      "Your painting bench: the recipe, notes, a session timer, and inspiration for one model on a single screen. Sit down and paint.",
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

  // Funnel: top-of-funnel landing impression.
  useEffect(() => {
    trackClient(AnalyticsEvent.LandingView);
  }, []);

  return (
    // Solid black canvas so the page matches the logo's pure-black background
    // (the app --color-bg #0d0d17 reads faintly blue against it).
    <div className="flex min-h-dvh flex-col bg-black">
      <PublicHeader />

      <main id="main" className="flex flex-1 flex-col">
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
          className="max-w-2xl leading-relaxed"
          style={{
            fontFamily:
              '"Flexi IBM VGA False", "Flexi IBM VGA True", "IBM Plex Mono", monospace',
            // clamp() lets the pixel-font hero scale down on narrow phones so it
            // never overruns a 320px viewport (MUX-008), settling at the
            // ~44.5px --text-title on wider screens.
            fontSize: "clamp(1.5rem, 7vw, var(--text-title))",
            // Bright neon green with an intense glow (reviewer asked again for
            // more glow). Five layered text-shadows — a tight bright core out to
            // a wide soft halo — build a fuller neon bloom. Set inline because
            // the V2 text-glow-* utilities are neutralised no-ops.
            color: "#39ff14",
            textShadow:
              "0 0 4px rgba(57, 255, 20, 1), 0 0 10px rgba(57, 255, 20, 0.95), 0 0 20px rgba(57, 255, 20, 0.8), 0 0 36px rgba(57, 255, 20, 0.6), 0 0 60px rgba(57, 255, 20, 0.4)",
          }}
        >
          Plan your projects.
          <br />
          Track your paints.
          <br />
          Manage your minis.
        </p>
        <p className="max-w-xl font-body text-body text-fg">
          One command center for your whole hobby — paint library, colour tools, recipes,
          collection, and project tracking, all in one terminal. Free to start. Pro when you
          need it.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button
              size="lg"
              onClick={() =>
                trackClient(AnalyticsEvent.CtaStartForFree, { location: "hero" })
              }
            >
              Start for Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Product showcase — real in-app screens, not mockups */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="mb-8 text-center">
          <h2 className="font-h1 text-h1 text-cyan-lite text-glow-cyan">
            See inside the terminal
          </h2>
          <p className="mt-2 font-body text-body text-fg">
            Real screens from the app — no mockups.
          </p>
        </div>
        <div className="flex flex-col gap-10">
          {SHOWCASE.map((shot) => (
            <figure key={shot.src} className="flex flex-col gap-3">
              <Panel label={shot.label} cornerTicks className="p-2 sm:p-3">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={1440}
                  height={900}
                  sizes="(max-width: 1024px) 100vw, 960px"
                  className="h-auto w-full rounded-[4px] border border-border"
                />
              </Panel>
              <figcaption className="px-1 font-body text-body text-fg-dim">
                {shot.caption}
              </figcaption>
            </figure>
          ))}
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
          <h2 className="font-h1 text-h1 text-green">Free to start. Pro when you need it.</h2>
          <p className="mt-2 font-body text-body text-fg">
            Run your whole hobby for free — then unlock the power features when you’re ready.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel label="FREE" cornerTicks className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2 text-left">
              {FREE_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-green">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="mt-auto">
              <Button
                variant="secondary"
                onClick={() =>
                  trackClient(AnalyticsEvent.CtaStartForFree, {
                    location: "free-tier-card",
                  })
                }
              >
                Start for Free
              </Button>
            </Link>
          </Panel>
          <Panel
            label="PRO · WHEN YOU NEED IT"
            accent="green"
            cornerTicks
            className="flex flex-col gap-4 p-6"
          >
            <ul className="flex flex-col gap-2 text-left">
              {PRO_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-green">▸</span>
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
        <h2 className="max-w-xl font-h1 text-h1 text-cyan-lite text-glow-cyan">
          Ready to take your hobby to the next level?
        </h2>
        <p className="max-w-md font-body text-body text-fg">
          Your whole painting setup, organized in one terminal. Free to start — no card needed.
        </p>
        <Link href="/sign-up">
          <Button
            size="lg"
            onClick={() =>
              trackClient(AnalyticsEvent.CtaStartForFree, { location: "footer" })
            }
          >
            Start for Free
          </Button>
        </Link>
      </section>
      </main>

      <footer className="border-t border-cyan/20 px-6 py-6 text-center font-body text-body text-fg">
        ▸ THE MINI MAINFRAME · made for painters ·{" "}
        <Link href="/gallery" className="text-cyan-lite hover:underline">
          Gallery
        </Link>{" "}
        ·{" "}
        <Link href="/pricing" className="text-cyan-lite hover:underline">
          Pricing
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="text-cyan-lite hover:underline">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="text-cyan-lite hover:underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-cyan-lite hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  );
}
