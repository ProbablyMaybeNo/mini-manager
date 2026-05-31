"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(initialError);
  // null = unknown (haven't probed yet); true/false = known answer.
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();

  async function probeRecovery(value: string): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) {
      setHasRecovery(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/auth/has-recovery-email?u=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as { hasVerifiedRecoveryEmail: boolean };
      setHasRecovery(data.hasVerifiedRecoveryEmail);
    } catch {
      // Network blip — leave as null so the link stays hidden with the
      // helper tooltip.
      setHasRecovery(null);
    }
  }

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
      });
      if (res.ok) {
        router.push(redirectTarget);
        router.refresh();
        return;
      }
      setFormError(res.message);
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
          onBlur={(e) => void probeRecovery(e.target.value)}
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
        {hasRecovery === true ? (
          <Link
            href={`/sign-in/forgot?u=${encodeURIComponent(username.trim())}`}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
          >
            Forgot password?
          </Link>
        ) : (
          <span
            className="text-[var(--color-fg-subtle)] cursor-help"
            title="Add a recovery email in Settings to enable password reset."
          >
            Forgot password?
          </span>
        )}
      </div>
    </form>
  );
}
