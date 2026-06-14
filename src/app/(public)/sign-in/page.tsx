"use client";

import { useState, useTransition } from "react";
import { AuthView } from "@/components/public/AuthView";
import { signInAction } from "@/lib/actions/auth";
import { AuthError } from "../AuthError";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      {error ? <AuthError message={error} /> : null}
      <AuthView
        mode="sign-in"
        onSubmit={(username, password) => {
          setError(null);
          startTransition(async () => {
            const res = await signInAction({ username, password });
            if (res && !res.ok) setError(res.message);
          });
        }}
      />
    </>
  );
}
