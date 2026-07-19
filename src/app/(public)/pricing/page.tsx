import type { Metadata } from "next";
import Link from "next/link";
import { Button, Panel } from "@/components/kit";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicPageTitle } from "@/components/public/PublicPageTitle";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { SUPPORT_URL, hasSupportUrl } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support · The Mini Mainframe",
  description:
    "The Mini Mainframe is free for everyone right now. If you'd like to support the project you can chip in — and visit Beacon Hobbies for more apps, tools, and wargaming fun.",
  alternates: { canonical: "/pricing" },
};

const BEACON_HOBBIES_URL = "https://beaconhobbies.com";

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TrackPageView event={AnalyticsEvent.PricingView} />
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 p-6 text-center">
        <PublicPageTitle>SUPPORT</PublicPageTitle>

        <Panel accent="green" label="IT'S FREE" className="w-full max-w-xl p-6 sm:p-8">
          <p className="font-h1 text-h1 text-green">Everything is free for now!</p>
          <p className="mt-4 font-body text-body text-fg">
            But your{" "}
            {hasSupportUrl ? (
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-lite underline underline-offset-4 hover:text-cyan"
              >
                support
              </a>
            ) : (
              "support"
            )}{" "}
            is very much appreciated.
          </p>
        </Panel>

        {hasSupportUrl && (
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg">Support the project</Button>
          </a>
        )}

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
              Start free
            </Button>
          </Link>
          <Link
            href="/"
            className="font-body text-body text-cyan-lite underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
