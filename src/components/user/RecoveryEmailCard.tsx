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
        <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2 pt-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isPending}
            >
              {email ? "Update" : "Add"}
            </Button>
            {email ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
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
        </form>
      )}

      {feedback ? (
        <p className="text-xs font-mono text-[var(--color-fg-muted)] pt-2">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="pt-2">
          <StatusPill status="danger">{error}</StatusPill>
        </div>
      ) : null}
    </Card>
  );
}
