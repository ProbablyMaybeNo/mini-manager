"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { changePasswordAction } from "@/lib/actions/changePassword";

/**
 * P12.18 — Change-password form on /user.
 *
 * Three inputs (current, new, confirm). Submit calls the server
 * action; success flashes a confirmation message; failure surfaces
 * inline.
 */
export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      // Clear the flash after a couple of seconds; reduced-motion-
      // friendly because the rest of the page doesn't move.
      window.setTimeout(() => setSuccess(false), 3000);
    });
  };

  return (
    <Card title="Password" ariaLabel="Change password">
      <p className="text-xs font-sans text-[var(--color-fg-subtle)] mb-3 leading-snug">
        Update the password on this account. We verify your current
        password before applying the change.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Current password"
          id="cp-current"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          required
        />
        <Field
          label="New password"
          id="cp-new"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm new password"
          id="cp-confirm"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        {error ? (
          <p
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            className="text-2xs font-mono text-[var(--color-green)]"
          >
            Password updated.
          </p>
        ) : null}
        <Button
          type="submit"
          variant="success"
          size="sm"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
      >
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="block w-full px-3 py-2 font-mono text-sm bg-[var(--color-bg)] frame focus:border-[var(--color-accent)]"
      />
    </div>
  );
}
