"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PASSWORD_ERROR_COPY,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/auth/validation";
import { applyPasswordResetAction } from "./actions";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const p = validatePassword(password);
    if (!p.ok && p.error) {
      setError(PASSWORD_ERROR_COPY[p.error]);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const res = await applyPasswordResetAction({ token, password });
      if (res.ok) {
        router.push("/projects");
        router.refresh();
        return;
      }
      setError(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-3">
      <label className="block space-y-2">
        <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          New password
        </span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Confirm password
        </span>
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      {error ? (
        <div role="alert">
          <StatusPill status="danger">{error}</StatusPill>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
