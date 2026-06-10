import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Mini Manager — paint-planning + army command center",
  description:
    "Plan armies, build paint recipes from a 7,144-colour cross-brand library, and carry every model from wishlist to finished — phone, tablet, and desktop, in sync.",
};

/**
 * Public marketing landing at `/`. Signed-in painters skip straight to the
 * app; signed-out visitors get the pitch. The root layout renders zero app
 * chrome (nav / status bar / tab bar) when unauthenticated, so this page
 * owns the full viewport.
 *
 * Aesthetic: the app's phosphor / CRT terminal identity, dialled up for a
 * first impression — a boot-sequence reveal, a blinking cursor, mono chrome
 * over IBM Plex Sans prose. All colour via @theme tokens; CTAs use the
 * Button primitive (success = "start", primary = "sign in") so the locked
 * palette + solid-fill discipline hold.
 */
export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) redirect("/projects");

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <LandingNav />
        <Hero />
        <div className="scan-divider my-2" />
        <Wedge />
        <Features />
        <div className="scan-divider my-2" />
        <PricingTeaser />
        <FinalCta />
        <LandingFooter />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function LandingNav() {
  return (
    <header className="boot flex items-center justify-between py-5">
      <span className="font-mono text-sm font-semibold tracking-[0.18em] text-[var(--color-cyan)] glow-cyan">
        MINI&nbsp;MANAGER
      </span>
      <nav className="flex items-center gap-4">
        <a
          href="/pricing"
          className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]"
        >
          Pricing
        </a>
        <Button as="a" href="/sign-in" variant="primary" tone="outline" size="sm">
          Sign in
        </Button>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-8 pb-12 sm:pt-12 sm:pb-16">
      {/* Brand object: the CRT logo powers on (scanline snap + flash + glow
          rise), reading as the monitor booting before the terminal feed
          types out below. Motion-safe; reduced-motion shows it lit. */}
      <div className="crt-bloom relative mb-7 inline-block">
        <Image
          src="/brand/logo-pixel.png"
          alt="Mini Manager"
          width={104}
          height={104}
          priority
          className="crt-power-on [image-rendering:pixelated] h-[88px] w-[88px] sm:h-[104px] sm:w-[104px]"
        />
      </div>

      <div
        className="boot font-mono text-2xs sm:text-xs uppercase tracking-[0.18em] text-[var(--color-green)] space-y-1"
        style={{ animationDelay: "820ms" }}
      >
        <p>
          <span className="text-[var(--color-fg-subtle)]">mini-manager:~$</span>{" "}
          boot paint-planning system{" "}
          <span className="text-[var(--color-cyan)]">[ OK ]</span>
        </p>
        <p>
          <span className="text-[var(--color-fg-subtle)]">mini-manager:~$</span>{" "}
          mount library{" "}
          <span className="text-[var(--color-fg)]">7,144 paints · 40+ brands</span>{" "}
          <span className="text-[var(--color-cyan)]">[ OK ]</span>
        </p>
        <p>
          <span className="text-[var(--color-fg-subtle)]">mini-manager:~$</span>{" "}
          ready
          <span className="term-cursor" aria-hidden />
        </p>
      </div>

      <h1
        className="boot mt-5 text-[2.5rem] sm:text-[3.75rem] !leading-[1.05] max-w-3xl"
        style={{ animationDelay: "980ms" }}
      >
        The command center for miniature painters.
      </h1>

      <p
        className="boot mt-5 max-w-2xl font-sans text-base sm:text-lg leading-relaxed text-[var(--color-fg-muted)]"
        style={{ animationDelay: "1040ms" }}
      >
        Plan armies, build paint recipes from a{" "}
        <span className="text-[var(--color-fg)]">7,144-colour cross-brand library</span>, and
        carry every model from wishlist to finished — on your phone at the bench,
        your tablet on the couch, your desktop at the desk.{" "}
        <span className="text-[var(--color-cyan)]">In sync.</span>
      </p>

      <div
        className="boot mt-8 flex flex-col sm:flex-row gap-3 sm:items-center"
        style={{ animationDelay: "1120ms" }}
      >
        <Button as="a" href="/sign-up" variant="success" size="lg">
          Start free →
        </Button>
        <Button as="a" href="/pricing" variant="secondary" tone="outline" size="lg">
          See the plans
        </Button>
        <span className="font-mono text-2xs text-[var(--color-fg-muted)] sm:ml-2">
          No email required to start.
        </span>
      </div>

      <div
        className="boot mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-fg-muted)]"
        style={{ animationDelay: "1200ms" }}
      >
        <Stat>7,144 paints</Stat>
        <Dot />
        <Stat>40+ brands</Stat>
        <Dot />
        <Stat>ΔE colour match</Stat>
        <Dot />
        <Stat>installable PWA</Stat>
      </div>
    </section>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--color-fg-subtle)]">{children}</span>;
}

function Dot() {
  return (
    <span aria-hidden className="text-[var(--color-border-strong)]">
      ·
    </span>
  );
}

function Wedge() {
  return (
    <section className="boot py-12" style={{ animationDelay: "120ms" }}>
      <p className="max-w-3xl font-sans text-lg sm:text-xl leading-relaxed text-[var(--color-fg)]">
        Most paint apps stop at colour matching, on one device.{" "}
        <span className="text-[var(--color-fg-muted)]">
          Mini Manager runs the whole workbench — the army, the recipes, the
          bench session, the plan — everywhere you paint.
        </span>
      </p>
    </section>
  );
}

interface Feature {
  glyph: string;
  title: string;
  body: string;
  accent: string;
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    glyph: "▒",
    title: "Cross-brand library",
    body: "7,144 paints across 40+ brands. ΔE colour matching, a harmony picker, gradient ramps, and an eyedropper that pulls a palette straight off a photo of your mini.",
    accent: "var(--color-cyan)",
  },
  {
    glyph: "▤",
    title: "Paint recipes",
    body: "Build step-by-step schemes by zone. Pin the exact paint per layer, note the technique once, and that note follows the colour everywhere it's used.",
    accent: "var(--color-purple-pastel)",
  },
  {
    glyph: "▦",
    title: "Army projects",
    body: "Nest units inside armies. Track every model owned → built → primed → painted → based → done. Import a BattleScribe roster or Warhammer PDF in seconds.",
    accent: "var(--color-green)",
  },
  {
    glyph: "▶",
    title: "Focus bench mode",
    body: "Sit down and paint. Pinned recipe, tick steps as you go, a stopwatch logging your time, and one-tap stage bumps — without ever scrolling away.",
    accent: "var(--color-green)",
  },
  {
    glyph: "▥",
    title: "Planner",
    body: "A tournament calendar, painting streaks, and a hue-sorted coverage grid of your whole collection — spot the gaps and fill them from the wishlist.",
    accent: "var(--color-yellow)",
  },
  {
    glyph: "★",
    title: "Wishlist",
    body: "Paste a vendor URL and it auto-fills the kit or paint, sorted into the right list. Know what you want before you spend.",
    accent: "var(--color-yellow)",
  },
];

function Features() {
  return (
    <section className="pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURES.map((f, i) => (
          <article
            key={f.title}
            className="boot frame p-4 flex flex-col gap-2 hover:border-[var(--color-border-strong)] transition-colors"
            style={{ animationDelay: `${160 + i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="font-mono text-lg leading-none"
                style={{ color: f.accent }}
              >
                {f.glyph}
              </span>
              <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-fg)]">
                {f.title}
              </h2>
            </div>
            <p className="font-sans text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {f.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

interface Tier {
  name: string;
  price: string;
  note: string;
}

const TIERS: ReadonlyArray<Tier> = [
  { name: "Free", price: "$0", note: "1 project · 1 recipe · library + tools" },
  { name: "Pro Monthly", price: "$4", note: "per month · unlimited everything" },
  { name: "Pro Lifetime", price: "$36", note: "one-time · best value" },
  { name: "Founder", price: "$26", note: "lifetime + name on the wall · 100 only" },
];

function PricingTeaser() {
  return (
    <section className="py-12">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-5">
        <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-[var(--color-fg)]">
          Simple pricing
        </h2>
        <a
          href="/pricing"
          className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)] hover:underline underline-offset-4"
        >
          Full comparison →
        </a>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TIERS.map((t, i) => (
          <div
            key={t.name}
            className="boot frame p-4 flex flex-col gap-1"
            style={{ animationDelay: `${120 + i * 50}ms` }}
          >
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
              {t.name}
            </span>
            <span className="font-mono text-2xl text-[var(--color-fg)]">
              {t.price}
            </span>
            <span className="font-sans text-2xs leading-snug text-[var(--color-fg-muted)]">
              {t.note}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="boot frame-strong p-8 sm:p-12 text-center my-4">
      <h2 className="text-2xl sm:text-3xl text-[var(--color-cyan)] glow-cyan">
        Start painting smarter.
      </h2>
      <p className="mt-3 font-sans text-base text-[var(--color-fg-muted)] max-w-xl mx-auto">
        Free to start, no email needed. Upgrade once it's the only paint app you
        open.
      </p>
      <div className="mt-6 flex justify-center">
        <Button as="a" href="/sign-up" variant="success" size="lg">
          Create your free account →
        </Button>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="mt-10 mb-8">
      <div className="scan-divider mb-5" />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
        <span className="text-[var(--color-fg-subtle)]">
          MINI MANAGER — paint-planning command center
        </span>
        <nav className="flex items-center gap-4">
          <a href="/pricing" className="hover:text-[var(--color-cyan)]">
            Pricing
          </a>
          <a href="/sign-in" className="hover:text-[var(--color-cyan)]">
            Sign in
          </a>
          <a href="/sign-up" className="hover:text-[var(--color-cyan)]">
            Start free
          </a>
        </nav>
      </div>
    </footer>
  );
}
