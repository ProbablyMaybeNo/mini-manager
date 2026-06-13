"use client";

import { useState, useTransition } from "react";
import { AuthView } from "@/components/public/AuthView";
import { signUpAction } from "@/lib/actions/auth";
import { AuthError } from "../AuthError";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <>
      {error ? <AuthError message={error} /> : null}
      <AuthView
        mode="sign-up"
        onSubmit={(username, password) => {
          setError(null);
          startTransition(async () => {
            const res = await signUpAction({ username, password });
            if (res && !res.ok) setError(res.message);
          });
        }}
      />
    </>
  );
}
