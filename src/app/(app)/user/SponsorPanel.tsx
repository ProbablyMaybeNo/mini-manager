"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ModalDialog, Panel } from "@/components/kit";

/** $1 minimum, matching /api/billing/sponsor-checkout's server-side floor. */
const MIN_DOLLARS = 1;

/**
 * The one-off "Sponsor the Mini-Mainframe" tip (fix 7, Settings page —
 * Ross's review pass). Pay-what-you-want, min $1, does NOT unlock the
 * tools — signed-in but explicitly NOT Pro-gated (a free user can sponsor).
 * Posts to the DEDICATED /api/billing/sponsor-checkout route (never the
 * plan-checkout route) so the two money flows never cross wires.
 *
 * Copy is locked to Ross's exact wording (review pass, final draft) — do
 * not reword without a product call.
 */
export function SponsorPanel() {
  return (
    <div className="p-6 pt-0">
      <Panel label="SPONSOR THE MINI-MAINFRAME" cornerTicks className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <p className="font-body text-body text-fg">The Mainframe is hungry.</p>
          <p className="font-body text-body text-fg">
            It grows on what you feed it — every bit becomes a new tool, a
            sharper scan, a stranger idea. Feed it, and it remembers you.
            Feed it enough, and it may send something back: a gift, one of a
            kind, from the Mainframe itself.
          </p>
          <p className="font-body text-body italic text-fg-dim">
            Feed at your own risk.
          </p>
        </div>
        <SponsorForm />
      </Panel>
      <Suspense fallback={null}>
        <SponsorThankYouModal />
      </Suspense>
    </div>
  );
}

function SponsorForm() {
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < MIN_DOLLARS) {
      setError(`Enter an amount of at least $${MIN_DOLLARS}.`);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/billing/sponsor-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(dollars * 100) }),
      });
      if (res.status === 401) {
        window.location.href = `/sign-in?from=${encodeURIComponent("/user")}`;
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.url) {
        setPending(false);
        setError(body.detail ?? body.error ?? "Could not start checkout. Try again.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setPending(false);
      setError("Could not reach the server. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-osd text-fg">Enter any amount over $1</span>
          <div className="flex items-center gap-1 border border-cyan/50 bg-bg px-2 py-1.5 focus-within:border-cyan">
            <span aria-hidden className="font-body text-body text-fg-dim">
              $
            </span>
            <input
              type="number"
              min={MIN_DOLLARS}
              step="1"
              inputMode="decimal"
              value={amount}
              disabled={pending}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Enter any amount over $1"
              aria-label="Enter any amount over $1"
              className="w-28 bg-transparent font-body text-body text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>
          <span className="font-body text-[12px] italic text-fg-dim">
            The Mainframe isn&apos;t fussy.
          </span>
        </label>
        <Button onClick={submit} disabled={pending || !amount.trim()}>
          {pending ? "Redirecting…" : "Feed the Mainframe"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="font-body text-body text-red-text">
          ▸ {error}
        </p>
      )}
    </div>
  );
}

/** Reads `?sponsored=1` (the sponsor checkout's success_url) and shows the
 *  thank-you popup once, then strips the param so a refresh doesn't re-show
 *  it. Needs its own Suspense boundary — useSearchParams(). */
function SponsorThankYouModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("sponsored") === "1") setOpen(true);
  }, [searchParams]);

  function close() {
    setOpen(false);
    router.replace("/user");
  }

  return (
    <ModalDialog
      open={open}
      onClose={close}
      title="The Mainframe is pleased."
      breadcrumb="MINI MAINFRAME"
    >
      <div className="flex flex-col gap-3 font-body text-body text-fg">
        <p>
          Thank you — truly. The Mini-Mainframe is a one-person passion
          project: every tool, every paint in the 7,000-strong library,
          every scan is built and paid for by a single solo dev. Your
          sponsorship goes straight into keeping it alive and making it
          grow.
        </p>
        <p className="italic text-fg-dim">
          PS — keep an eye out for a message from the Mainframe. It notices
          its top feeders, and every so often it likes to thank one itself.
          With something one of a kind.
        </p>
      </div>
    </ModalDialog>
  );
}
