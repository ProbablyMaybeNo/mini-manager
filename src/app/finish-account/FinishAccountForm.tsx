"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PASSWORD_ERROR_COPY,
  PASSWORD_MIN_LENGTH,
  USERNAME_ERROR_COPY,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";
import { finishAccountAction } from "./actions";

export function FinishAccountForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const u = validateUsername(username);
    if (!u.ok && u.error) {
      setError(USERNAME_ERROR_COPY[u.error]);
      return;
    }
    const p = validatePassword(password);
    if (!p.ok && p.error) {
      setError(PASSWORD_ERROR_COPY[p.error]);
      return;
    }

    startTransition(async () => {
      const res = await finishAccountAction({
        username: u.normalized,
        password,
      });
      if (res && !res.ok) {
        setError(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-3">
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
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Finishing…" : "Finish setup"}
      </Button>
    </form>
  );
}
