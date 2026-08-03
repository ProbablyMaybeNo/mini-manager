"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";
import { guardedMessage } from "@/lib/actionGuard";
import { signInAction } from "@/lib/actions/auth";
import { AuthError } from "../AuthError";

/** R2-14 — the sign-in POST is the first thing a returning painter does, and
 *  it is exactly the request most likely to meet a flaky connection. Phrased
 *  as the transient it is, and never as "your details are wrong". */
const SIGN_IN_FAILED_MESSAGE =
  "Couldn’t reach the server — check your connection, then try again.";

function SignInForm() {
  const from = useSearchParams().get("from") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      {error ? <AuthError message={error} /> : null}
      <AuthView
        mode="sign-in"
        from={from}
        onSubmit={(username, password) => {
          setError(null);
          startTransition(async () => {
            // Unguarded, a rejected sign-in escaped the transition into the
            // root error boundary and replaced the sign-in page with the
            // whole-app fault screen — on the page someone is using to get in.
            // A success still resolves to `undefined` here (the action
            // redirects server-side), so the guard never sees it.
            const res = await guardedMessage(
              () => signInAction({ username, password, next: from }),
              SIGN_IN_FAILED_MESSAGE,
            );
            if (res && !res.ok) setError(res.message);
          });
        }}
      />
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
