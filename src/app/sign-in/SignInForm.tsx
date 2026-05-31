"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/validation";
import { signInAction } from "./actions";

interface SignInFormProps {
  redirectTarget: string;
  initialError: string | null;
}

export function SignInForm({ redirectTarget, initialError }: SignInFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!username.trim() || !password) {
      setFormError("Wrong username or password");
      return;
    }
    startTransition(async () => {
      const res = await signInAction({
        username: username.trim(),
        password,
        redirectTo: redirectTarget,
      });
      if (res && !res.ok) {
        setFormError(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Username
        </span>
        <input
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
          className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      {formError ? (
        <div role="alert">
          <StatusPill status="danger">{formError}</StatusPill>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <div className="pt-1 text-xs font-mono text-center">
        {/* Always a real link. The /sign-in/forgot route itself handles
            the no-recovery-email case (enumeration-safe: same response
            shape regardless of whether the account has a recovery
            address). Previously this was a disabled tooltip for fresh
            accounts — a hard lockout if a user forgot their password.
            UX-V3-002 — auditor round 3. */}
        <Link
          href={
            username.trim()
              ? `/sign-in/forgot?u=${encodeURIComponent(username.trim())}`
              : "/sign-in/forgot"
          }
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
