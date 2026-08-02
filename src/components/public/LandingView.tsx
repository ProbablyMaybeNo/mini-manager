"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { SUPPORT_EMAIL } from "@/lib/support";
import { PublicHeader } from "./PublicHeader";

// Real in-app screens — no mockups. Every feature the landing sells is shown
// as an actual screenshot (Ross, 2026-07-27): the old text-only feature grid
// repeated this list without images, so it's been folded into this one section.
const SHOWCASE: {
  src: string;
  label: string;
  alt: string;
  caption: string;
  /** Intrinsic capture height — 900 unless the page needed a taller viewport
   *  to show its whole point (see tests/e2e/capture_showcase.spec.ts). */
  height?: number;
}[] = [
  {
    src: "/showcase/projects.png",
    label: "PROJECTS",
    alt: "The Mini Mainframe projects roster — armies, units and models with status, priority and completion",
    caption:
      "Every army, unit and model in one roster. Set deadlines, track status, and shrink your pile of shame one unit at a time.",
  },
  {
    src: "/showcase/library.png",
    label: "PAINT LIBRARY",
    alt: "The Mini Mainframe paint library — a grid of thousands of paint swatches mapped by colour",
    caption:
      "Every paint on the market — 7,000+ across every major brand — mapped by colour. Flag what you own, wishlist the rest.",
  },
  {
    src: "/showcase/tools.png",
    label: "COLOUR TOOLS",
    alt: "The Mini Mainframe colour tools hub listing the wheel, match, dropper, layering and paint scanner tools",
    caption:
      "The full toolkit: harmony wheel, colour match, photo dropper, glaze layering, and a scanner that reads your paint rack from a photo.",
    height: 1420,
  },
  {
    src: "/showcase/collection.png",
    label: "COLLECTION",
    alt: "The Mini Mainframe collection tracker listing owned and wishlisted paints and models with prices",
    caption:
      "Paste a store link and the row fills itself in — name, brand, price. Know exactly what you own, what you want, and what you've spent.",
  },
  {
    src: "/showcase/recipe.png",
    label: "RECIPE CREATOR",
    alt: "The Mini Mainframe recipe editor building a paint scheme layer by layer",
    caption:
      "Build a scheme layer by layer, tag the technique on every step, then attach it to a project or share it with a link.",
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

const SPONSOR_PERKS = [
  "The full colour toolkit — Colour Wheel, Match, Dropper, Stacking, and the Paint Scanner",
  "One-click adds while you browse — drop any paint or model into your collection or wishlist straight from the store page, no copy-paste",
  "Army-list auto-build — paste an army list and it fills your whole project tree in seconds",
  "AI recipe generation — describe a scheme, get a catalog-grounded recipe back",
  "Unlimited recipes — a recipe for every scheme, variant, and sub-unit",
];

/**
 * O-2 — the hero still, shared by the reduced-motion / small-screen branch and
 * by the <video>'s `poster`. 540x540 WebP, 57,924 bytes, down from the 1080
 * JPEG's 254,751: the mark is capped at max-w-lg (512px) and 42vh, so 540 is
 * already ≥1x everywhere it renders and there is nothing above it to serve.
 */
const HERO_STILL = "/brand/mini-mainframe-logo-still.webp";

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
  // O-3 — the hero video was the whole page weight: 2,143KB of a 2,849KB
  // landing, downloaded in full on first paint (autoPlay), for a mark rendered
  // at 327px on a phone. Re-encoding took it to 169KB (VP9) / 271KB (h264), and
  // phones don't fetch it at all now — they get the poster the <video> would
  // have loaded anyway. `useIsDesktop` is SSR-false, so the still is what
  // renders on the server and on first paint everywhere; the video only mounts
  // on a client that is actually wide (and tall — a landscape phone is not a
  // desktop) and hasn't asked for reduced motion.
  const isDesktop = useIsDesktop();
  const stillOnly = reducedMotion || !isDesktop;

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
      {/* py-4 on short viewports (MUX5-005): in landscape the first screen was
          header, 66px of empty background, then the CRT artwork — the headline
          didn't start until y≈332 of 375, so nothing said what the product was
          above the fold. The artwork's own max-h-[42vh] already shrinks it. */}
      <section className="scanlines flex flex-col items-center gap-4 px-6 py-4 text-center roomy:gap-6 roomy:py-16">
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
          {stillOnly ? (
            <Image
              src={HERO_STILL}
              alt="The Mini Mainframe"
              width={540}
              height={540}
              priority
              // O-2 — `unoptimized` is the point, not an oversight. The mark
              // never renders above ~512 CSS px, so one 540px WebP covers every
              // breakpoint, and serving that exact URL is what lets the <video>
              // below reuse it as its `poster` — a poster attribute can't take a
              // /_next/image URL, so any optimised variant here would mean the
              // desktop hero downloading the artwork twice.
              unoptimized
              className="h-auto max-h-[42vh] w-auto max-w-full"
            />
          ) : (
            <video
              className="h-auto max-h-[42vh] w-auto max-w-full"
              autoPlay
              muted
              loop
              playsInline
              poster={HERO_STILL}
              aria-label="The Mini Mainframe"
              width={540}
              height={540}
            >
              {/* VP9 first: at the same visual quality it is 169KB against the
                  mp4's 271KB, so every browser that can take it does. The mp4
                  stays as the fallback. */}
              <source src="/brand/mini-mainframe-logo.webm" type="video/webm" />
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
        {/* Two cuts of the same pitch (Ross, 2026-07-27): the punchy one on
            phones where the long paragraph swallowed the fold, the full
            feature-led version from ≥sm. Both ship in the HTML, so the
            long-tail keywords ("paint library", "Focus mode", "collection
            tracker") stay crawlable at every width. */}
        <p className="max-w-2xl font-body text-body text-fg sm:hidden">
          Manage your pile of shame and slay the grey with a whole range of awesome tools.
          Share your progress pics, finished minis, recipes, and techniques with the
          community. Everything a miniature painter needs, all in one place.
        </p>
        <p className="hidden max-w-2xl font-body text-body text-fg sm:block">
          An all-in-one miniature wargaming project planner, painting pal, and collection
          tracker. A 7,000+ and growing library of paints, Focus mode for session painting,
          an auto-populated collection tracker, and so much more. Take control of your pile
          of shame, slay the grey, and share your painting progress, recipes, and finished
          minis with an online community.
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
            Miniature painters, meet your new best painting pal.
          </h2>
          <p className="mt-2 font-body text-body text-fg">
            Plan, track and manage your entire collection. No card needed.
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
                  height={shot.height ?? 900}
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

      {/* The Mainframe wants something back — base app vs. the sponsored toolkit */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="font-h1 text-h1 text-cyan-lite text-glow-cyan">
            The Mainframe demands tribute.
          </h2>
          <p className="mt-2 font-body text-body text-fg">
            Everything you need to run your hobby comes as standard — no strings, no card.
            But the good stuff? The colour toolkit, the AI, the paint scanner? The
            Mainframe keeps those behind the glass until you sponsor it.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel label="AS STANDARD" cornerTicks className="flex flex-col gap-4 p-6">
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
          <Panel label="SPONSOR THE MAINFRAME · $3.99/MO" cornerTicks className="flex flex-col gap-4 p-6">
            <ul className="flex flex-col gap-2 text-left">
              {SPONSOR_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 font-body text-body text-fg">
                  <span aria-hidden className="text-cyan-lite">▸</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-2">
              <Button variant="secondary">Sponsor · $3.99/mo →</Button>
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
