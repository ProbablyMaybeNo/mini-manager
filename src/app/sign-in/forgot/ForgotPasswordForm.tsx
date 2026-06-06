"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { PromptField } from "@/components/ui/PromptField";
import { StatusPill } from "@/components/ui/StatusPill";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/auth/validation";
import { requestPasswordResetAction } from "./actions";

interface Props {
  initialUsername: string;
}

export function ForgotPasswordForm({ initialUsername }: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      // We ignore the response on purpose — the server always returns
      // ok:true to keep this endpoint enumeration-safe.
      await requestPasswordResetAction({ username });
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="space-y-3 pt-3">
        <StatusPill status="ok">REQUEST RECEIVED</StatusPill>
        <p className="text-sm font-sans">
          If an account exists, we sent a link to its recovery email. The
          link expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-3">
      <PromptField
        label="Username"
        name="username"
        type="text"
        required
        autoFocus
        autoComplete="username"
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        placeholder="alice42"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
