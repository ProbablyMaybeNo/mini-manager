"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";
import { signInAction } from "@/lib/actions/auth";
import { AuthError } from "../AuthError";

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
            const res = await signInAction({ username, password, next: from });
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
