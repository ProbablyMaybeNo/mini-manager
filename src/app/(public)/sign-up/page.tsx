"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";
import { signUpAction } from "@/lib/actions/auth";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { AuthError } from "../AuthError";

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
            const res = await signUpAction({
              username,
              password,
              email: email ?? "",
              next: from,
            });
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
