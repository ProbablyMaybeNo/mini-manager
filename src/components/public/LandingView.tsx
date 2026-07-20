"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { SUPPORT_EMAIL } from "@/lib/support";
import { PublicHeader } from "./PublicHeader";

// Feature copy — benefit-led, per Ross's landing pass.
const FEATURES: { title: string; blurb: string }[] = [
  {
    title: "Paint Library",
    blurb:
      "Browse 7,000+ paints from Citadel, Vallejo, Army Painter and every major brand. Flag what you own, wishlist what you want, and drop any paint straight into a Warhammer or wargame project.",
  },
  {
    title: "Color Tools",
    blurb:
      "Match any colour to real paints, build schemes on the harmony wheel, and predict glaze layers before you commit a drop — the exact paint for the look in your head.",
  },
  {
    title: "Projects",
    blurb:
      "A wargame project tracker for every army, unit, and model in one view. Set deadlines, watch your activity feed, and shrink your pile of shame one unit at a time.",
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
      "A paint collection manager for your paints and models — track what you've spent and auto-add items from the store as you browse. Know what you own, and what you still need.",
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

const INCLUDED_PERKS = [
  "Unlimited projects — armies, units, models, terrain",
  "Your full collection — log every paint & model, add by pasting a store link",
  "A recipe for every model — add paints, tag techniques, share any scheme with a link",
  "The focus bench — recipe, notes, inspiration & a session timer",
  "The entire 7,000+ paint library, browsable and searchable",
];

const SUPPORT_PERKS = [
  "The full colour toolkit — Colour Wheel, Match, Dropper, Stacking, and the Paint Scanner",
  "One-click adds while you browse — drop any paint or model into your collection or wishlist straight from the store page, no copy-paste",
  "Army-list auto-build — paste an army list and it fills your whole project tree in seconds",
  "AI recipe generation — describe a scheme, get a catalog-grounded recipe back",
  "Unlimited recipes — a recipe for every scheme, variant, and sub-unit",
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
        {/* The square CRT mark is capped at ~42vh so the hero "Get Started"
            CTA clears the fold at 1366×768 (where the button top used
            to sit ≈893px). `w-auto max-w-full max-h-[42vh]` scales the 1080²
            asset down to fit whichever is smaller — the container width or
            42vh — preserving the square with no letterbox. On phones width
            still governs (42vh > the ~342px column), so the brand mark stays
            full-width there. */}
        <div className="flex w-full max-w-[440px] justify-center sm:max-w-lg">
          {reducedMotion ? (
            <Image
              src="/brand/mini-mainframe-logo-poster.jpg"
              alt="The Mini Mainframe"
              width={1080}
              height={1080}
              priority
              className="h-auto max-h-[42vh] w-auto max-w-full"
            />
          ) : (
            <video
              className="h-auto max-h-[42vh] w-auto max-w-full"
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
        <p className="max-w-2xl font-body text-body text-fg">
          A miniature painting tracker and paint collection manager for wargamers: manage
          your armies, paint recipes, backlog, colour matches, and hobby sessions in one
          place — with 7,000+ paints from Warhammer, Citadel, Vallejo and Army Painter.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button
              size="lg"
              onClick={() =>
                trackClient(AnalyticsEvent.CtaStartForFree, { location: "hero" })
              }
            >
              Get Started
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

      {/* Two ways to play — base app vs. the supported toolkit */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="font-h1 text-h1 text-cyan-lite text-glow-cyan">Two ways to play.</h2>
          <p className="mt-2 font-body text-body text-fg">
            Make an account and track your whole hobby — no strings. Support the Mainframe
            to unlock the full colour toolkit and AI recipe generation.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel label="INCLUDED" cornerTicks className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2 text-left">
              {INCLUDED_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-green">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="mt-2">
              <Button
                onClick={() =>
                  trackClient(AnalyticsEvent.CtaStartForFree, {
                    location: "features-card",
                  })
                }
              >
                Get Started
              </Button>
            </Link>
          </Panel>
          <Panel label="SUPPORT THE MAINFRAME · $3.99/MO" cornerTicks className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2 text-left">
              {SUPPORT_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-cyan-lite">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-2">
              <Button variant="secondary">Subscribe · $3.99/mo →</Button>
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
          Your whole painting setup, organized in one terminal. No card needed to get started.
        </p>
        <Link href="/sign-up">
          <Button
            size="lg"
            onClick={() =>
              trackClient(AnalyticsEvent.CtaStartForFree, { location: "footer" })
            }
          >
            Get Started
          </Button>
        </Link>
      </section>
      </main>

      <footer className="border-t border-cyan/20 px-6 py-6 text-center font-body text-body text-fg">
        ▸ THE MINI MAINFRAME · made for painters ·{" "}
        <Link href="/gallery" className="text-cyan-lite underline">
          Gallery
        </Link>{" "}
        ·{" "}
        <Link href="/pricing" className="text-cyan-lite underline">
          Support
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="text-cyan-lite underline">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="text-cyan-lite underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="text-cyan-lite underline">
          Terms
        </Link>{" "}
        ·{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
          Contact
        </a>
      </footer>
    </div>
  );
}
