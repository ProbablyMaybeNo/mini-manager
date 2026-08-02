"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/kit";
import { Logo } from "@/components/shell";
import { guardedMessage } from "@/lib/actionGuard";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { SUPPORT_EMAIL } from "@/lib/support";

/** R2-10 — "save" isn't the verb here, and the person reading it is locked out
 *  of their account, so it has to name the retry rather than the fault. */
const REQUEST_FAILED_MESSAGE =
  "Couldn’t send the reset link — check your connection, then try again.";

export default function ResetPage() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const valid = username.trim().length >= 3;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-6 panel-depth motion-safe:animate-content-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo href="/" size={40} />
          <h1 className="font-mono text-[20px] font-extrabold uppercase tracking-tight text-fg-bright">
            Reset password
          </h1>
          <span aria-hidden className="block h-1 w-12 rounded-full bg-cyan" />
        </div>

        {sent ? (
          <p className="rounded-[6px] border border-green/40 bg-green/5 px-3 py-2 font-body text-body text-green">
            ▸ If that account has a verified recovery email, a reset link is on
            its way.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid || isPending) return;
              setError(null);
              startTransition(async () => {
                // Resolves ok whether or not the account exists (no
                // enumeration); the link, if any, goes to the account's
                // verified recovery email. Only a *transport* failure — offline,
                // a 5xx — comes back not-ok, and R2-10: unguarded, that
                // rejection reached the root error boundary and replaced the
                // page with the fault screen, taking the typed username with it
                // — on the one page whose visitor is already locked out.
                const res = await guardedMessage(
                  () => requestPasswordReset({ username: username.trim() }),
                  REQUEST_FAILED_MESSAGE,
                );
                if (!res.ok) {
                  setError(res.message);
                  return;
                }
                setSent(true);
              });
            }}
          >
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {error ? (
              <p className="font-body text-body text-red-text" role="alert">
                ▸ {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={!valid || isPending}
            >
              {isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <div className="mt-5 text-center font-body text-body">
          <Link
            href="/sign-in"
            className="text-cyan-lite underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:underline"
          >
            ← Back to sign in
          </Link>
        </div>

        <p className="mt-4 text-center font-body text-[12px] text-fg-dim">
          Locked out or no recovery email? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
