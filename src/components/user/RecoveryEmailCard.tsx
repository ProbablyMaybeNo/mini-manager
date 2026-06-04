"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  removeRecoveryEmail,
  resendRecoveryEmailVerification,
  setRecoveryEmail,
} from "@/lib/auth/recoveryEmail";

interface RecoveryEmailCardProps {
  initialEmail: string | null;
  initialVerified: boolean;
}

export function RecoveryEmailCard({
  initialEmail,
  initialVerified,
}: RecoveryEmailCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [verified, setVerified] = useState(initialVerified);
  const [inputValue, setInputValue] = useState("");
  const [editing, setEditing] = useState(initialEmail === null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setError(null);
    setFeedback(null);
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    reset();
    startTransition(async () => {
      const res = await setRecoveryEmail({ email: inputValue });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEmail(inputValue.trim().toLowerCase());
      setVerified(false);
      setEditing(false);
      setFeedback("Verification email sent — check your inbox.");
      router.refresh();
    });
  }

  function onResend() {
    reset();
    startTransition(async () => {
      const res = await resendRecoveryEmailVerification();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setFeedback("Verification email re-sent.");
    });
  }

  function onRemove() {
    reset();
    startTransition(async () => {
      await removeRecoveryEmail();
      setEmail(null);
      setVerified(false);
      setEditing(true);
      setInputValue("");
      setFeedback("Recovery email removed.");
      router.refresh();
    });
  }

  return (
    <Card title="Recovery email" ariaLabel="Recovery email">
      <p className="text-sm font-sans text-[var(--color-fg-muted)]">
        Required to enable password reset and to upgrade to a paid plan.
        Free accounts can leave this blank.
      </p>

      {!editing && email ? (
        <div className="flex items-center gap-3 flex-wrap pt-3">
          <span className="font-mono text-sm break-all">{email}</span>
          {verified ? (
            <StatusPill status="ok">VERIFIED</StatusPill>
          ) : (
            <StatusPill status="warning">PENDING</StatusPill>
          )}
          <div className="flex gap-2 ml-auto">
            {!verified ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResend}
                disabled={isPending}
              >
                Resend verification
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(true);
                  setInputValue(email);
                }}
                disabled={isPending}
              >
                Change
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              onClick={onRemove}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onAdd} className="flex flex-col gap-2 pt-3">
          {/* M6 — input optimization: visible label-above-field, the email
              keyboard (type + inputmode), autocomplete, and an inline
              field-level error (aria-invalid + aria-describedby) instead of
              banner-only [MOBILE §M6 step 1]. */}
          <label htmlFor="recovery-email" className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Email address
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="recovery-email"
              name="recoveryEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "recovery-email-error" : undefined}
              className="flex-1 px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <div className="flex gap-2">
            <Button
              type="submit"
              variant="success"
              size="sm"
              disabled={isPending}
            >
              {email ? "Update" : "Add"}
            </Button>
            {email ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setInputValue("");
                  reset();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            ) : null}
            </div>
          </div>
          {/* M6 — inline field-level error, adjacent to the input, wired
              via aria-describedby. */}
          {error ? (
            <p
              id="recovery-email-error"
              role="alert"
              className="text-2xs font-mono text-[var(--color-red)]"
            >
              {error}
            </p>
          ) : null}
        </form>
      )}

      {feedback ? (
        <p className="text-xs font-mono text-[var(--color-fg-muted)] pt-2">
          {feedback}
        </p>
      ) : null}
      {/* When NOT editing (e.g. resend/remove paths), surface errors as the
          card-level pill — the inline error above only fires while the form
          is open. */}
      {error && !editing ? (
        <div role="alert" className="pt-2">
          <StatusPill status="danger">{error}</StatusPill>
        </div>
      ) : null}
    </Card>
  );
}
