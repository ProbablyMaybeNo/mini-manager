"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { signUpAction } from "./actions";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "taken"; reason: string };

const DEBOUNCE_MS = 350;

export function SignUpForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");

  // Debounced uniqueness probe. We re-run the same validator client-side
  // before firing so the request only goes out for plausibly-valid input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setCheck({ kind: "idle" });
      return;
    }
    const v = validateUsername(trimmed);
    if (!v.ok && v.error) {
      setCheck({
        kind: "taken",
        reason: USERNAME_ERROR_COPY[v.error],
      });
      return;
    }
    setCheck({ kind: "checking" });
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = v.normalized;
      try {
        const res = await fetch(
          `/api/auth/check-username?u=${encodeURIComponent(v.normalized)}`,
        );
        const data = (await res.json()) as { ok: boolean; reason?: string };
        // Only apply if the input hasn't changed since the request fired.
        if (lastQueryRef.current !== v.normalized) return;
        if (data.ok) {
          setCheck({ kind: "ok" });
        } else {
          setCheck({
            kind: "taken",
            reason: data.reason ?? "That username is unavailable",
          });
        }
      } catch {
        setCheck({ kind: "idle" });
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const u = validateUsername(username);
    if (!u.ok && u.error) {
      setFormError(USERNAME_ERROR_COPY[u.error]);
      return;
    }
    const p = validatePassword(password);
    if (!p.ok && p.error) {
      setFormError(PASSWORD_ERROR_COPY[p.error]);
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const res = await signUpAction({
        username: u.normalized,
        password,
      });
      // On success the server action throws a NEXT_REDIRECT; control
      // never reaches here. Anything we DO see is a {ok:false} payload.
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
        <div className="min-h-[20px]">
          {check.kind === "checking" && (
            <StatusPill status="neutral">checking…</StatusPill>
          )}
          {check.kind === "ok" && (
            <StatusPill status="ok">available</StatusPill>
          )}
          {check.kind === "taken" && (
            <StatusPill status="danger">{check.reason}</StatusPill>
          )}
        </div>
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

      {formError ? (
        <div role="alert">
          <StatusPill status="danger">{formError}</StatusPill>
        </div>
      ) : null}

      {/* Disable the submit until every field is plausibly valid AND
          the uniqueness probe has cleared. Previously enabled at page
          load — a click before typing fired a pointless server call
          and a 'Wrong username' error trained users to ignore the
          form. UX-V3-008. */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={
          isPending ||
          !username.trim() ||
          password.length < PASSWORD_MIN_LENGTH ||
          password !== confirm ||
          check.kind !== "ok"
        }
        className="w-full"
      >
        {isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
