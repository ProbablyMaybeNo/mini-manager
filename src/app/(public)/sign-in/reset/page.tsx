"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { guardedMessage } from "@/lib/actionGuard";
import { applyPasswordReset } from "@/lib/auth/passwordReset";

/** R2-10 — the token is single-use, so the copy must not imply the reset did or
 *  didn't land; it names the retry and nothing else. */
const APPLY_FAILED_MESSAGE =
  "Couldn’t set your password — check your connection, then try again.";

function ResetConfirm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const valid = password.length >= 8;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Panel label="SYS ▸ RESET" cornerTicks glow className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <Logo href="/" size={40} />
          <p className="font-body text-body text-fg">Set a new password</p>
        </div>

        {!token ? (
          <p className="font-body text-body text-red-text">
            ▸ Missing or invalid reset link.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              // R2-10 — the token is single-use: a second submit while the
              // first is still in flight spends it, then reports "invalid or
              // expired" for a reset that actually succeeded.
              if (!valid || isPending) return;
              setError(null);
              startTransition(async () => {
                // A handled failure (bad/expired token, weak password) already
                // arrived as ok:false. R2-10: a *rejection* did not — it reached
                // the root error boundary and replaced the page with the fault
                // screen, leaving the user locked out, mid-reset, with a
                // possibly-spent token and no message at all.
                const res = await guardedMessage(
                  () => applyPasswordReset({ token, password }),
                  APPLY_FAILED_MESSAGE,
                );
                if (!res.ok) {
                  setError(res.message);
                  return;
                }
                // applyPasswordReset mints a fresh session on success.
                router.push("/dashboard");
                router.refresh();
              });
            }}
          >
            <Input
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              error={password && !valid ? "Min 8 characters" : undefined}
              onChange={(e) => setPassword(e.target.value)}
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
              {isPending ? "Setting…" : "Set password"}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center font-body text-body">
          <Link href="/sign-in" className="text-cyan-lite hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ResetConfirm />
    </Suspense>
  );
}
