"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";
import { guardedMessage } from "@/lib/actionGuard";
import { signUpAction } from "@/lib/actions/auth";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { AuthError } from "../AuthError";

/** R2-14 — same as sign-in: a transport failure on the account-creation POST
 *  must read as "try again", not as a rejected sign-up. */
const SIGN_UP_FAILED_MESSAGE =
  "Couldn’t reach the server — check your connection, then try again.";

function SignUpForm() {
  const from = useSearchParams().get("from") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      {error ? <AuthError message={error} /> : null}
      <AuthView
        mode="sign-up"
        from={from}
        onSubmit={(username, password, email) => {
          setError(null);
          // Funnel: the painter submitted the sign-up form (attempt), the
          // step between landing on /sign-up and account_created firing
          // server-side.
          trackClient(AnalyticsEvent.SignUpStarted);
          startTransition(async () => {
            // Unguarded, a rejection here replaced the sign-up form with the
            // whole-app fault screen and discarded everything typed into it.
            const res = await guardedMessage(
              () =>
                signUpAction({
                  username,
                  password,
                  email: email ?? "",
                  next: from,
                }),
              SIGN_UP_FAILED_MESSAGE,
            );
            if (res && !res.ok) setError(res.message);
          });
        }}
      />
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
