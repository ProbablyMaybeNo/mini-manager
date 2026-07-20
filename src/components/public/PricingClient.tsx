"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { SUPPORT_URL, hasSupportUrl } from "@/lib/support";
import { startProMonthlyCheckout } from "@/lib/billing/startCheckout";

const BEACON_HOBBIES_URL = "https://beaconhobbies.com";

/** What subscribing unlocks — mirrors the gated set in
 *  docs/SUBSCRIPTION_PAYWALL.md exactly. */
const UNLOCKS = [
  "All the tools — Colour Wheel, Match, Dropper, Stacking, and the Paint Scanner",
  "AI recipe generation — describe a scheme, get a catalog-grounded recipe back",
  "The recipe creator's full toolset — colour matching, layering/glaze prediction, technique tooling",
  "The library paint panel's colour-science tools — harmonies, cross-brand matching, tool hand-offs",
  "Army-list auto-build — paste a list and it fills your whole project tree",
];

/** The URL sent back to /pricing after a sign-in bounce so checkout
 *  auto-resumes on return (see the effect below). */
const RESUME_PATH = "/pricing?upgrade=pro-monthly";

function SubscribeButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  // Auto-resume — a signed-out visitor who clicked Subscribe got bounced to
  // /sign-in?from=/pricing?upgrade=pro-monthly; landing back here with that
  // query re-fires checkout automatically instead of making them click twice.
  useEffect(() => {
    if (searchParams.get("upgrade") !== "pro-monthly") return;
    if (firedRef.current) return;
    firedRef.current = true;
    setPending(true);
    void startProMonthlyCheckout({ resumePath: RESUME_PATH }).then((res) => {
      if (!res.ok) {
        setPending(false);
        setError(res.error ?? "Could not start checkout.");
      }
    });
  }, [searchParams]);

  function onClick() {
    setError(null);
    setPending(true);
    void startProMonthlyCheckout({ resumePath: RESUME_PATH }).then((res) => {
      if (!res.ok) {
        setPending(false);
        setError(res.error ?? "Could not start checkout.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Redirecting…" : "Subscribe · $3.99/mo →"}
      </Button>
      {error && (
        <p className="font-body text-body text-red-text" role="alert">
          ▸ {error}
        </p>
      )}
    </div>
  );
}

export function PricingClient() {
  return (
    <>
      <TrackPageView event={AnalyticsEvent.PricingView} />

      <Panel accent="cyan" label="SUPPORT THE MAINFRAME · $3.99/MO" className="w-full max-w-xl p-6 sm:p-8">
        <p className="font-h1 text-h1 text-cyan-lite">Unlock the full toolset.</p>
        <p className="mt-4 font-body text-body text-fg">
          Projects, the paint library, recipes, and collection tracking are yours from the
          start. Subscribing unlocks the tools and AI on top:
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-left">
          {UNLOCKS.map((u) => (
            <li key={u} className="flex gap-2 font-body text-body text-fg">
              <span aria-hidden className="text-cyan-lite">▸</span>
              <span>{u}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Suspense fallback={<Button size="lg" disabled>Subscribe · $3.99/mo →</Button>}>
            <SubscribeButton />
          </Suspense>
        </div>
      </Panel>

      <p className="font-body text-body text-fg-dim">
        Prefer a one-off tip instead of a subscription? Chip in via{" "}
        {hasSupportUrl ? (
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-lite underline underline-offset-4 hover:text-cyan"
          >
            our support link
          </a>
        ) : (
          "our support link"
        )}
        .
      </p>

      <p className="font-body text-body text-fg-dim">
        Visit{" "}
        <a
          href={BEACON_HOBBIES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-lite underline underline-offset-4 hover:text-cyan"
        >
          Beacon Hobbies
        </a>{" "}
        for more apps, tools, and wargaming fun.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link href="/sign-up">
          <Button variant="secondary" size="lg">
            Get Started
          </Button>
        </Link>
        <Link
          href="/"
          className="font-body text-body text-cyan-lite underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </>
  );
}
