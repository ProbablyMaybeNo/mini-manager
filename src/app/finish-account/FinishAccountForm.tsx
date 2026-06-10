"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { PromptField } from "@/components/ui/PromptField";
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
    <form onSubmit={onSubmit} className="space-y-4">
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

      <PromptField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

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
