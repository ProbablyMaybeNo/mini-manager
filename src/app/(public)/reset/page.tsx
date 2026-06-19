"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Input, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export default function ResetPage() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(false);
  const [, startTransition] = useTransition();
  const valid = username.trim().length >= 3;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Panel label="SYS ▸ RECOVER" cornerTicks glow className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <Logo href="/" size={56} />
          <p className="font-mono text-xs text-fg-dim">Reset your password</p>
        </div>

        {sent ? (
          <p className="font-mono text-sm text-green text-glow-green">
            ▸ If that account has a verified recovery email, a reset link is on
            its way.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              startTransition(async () => {
                // Always resolves ok (no account enumeration); the link, if
                // any, goes to the account's verified recovery email.
                await requestPasswordReset({ username: username.trim() });
                setSent(true);
              });
            }}
          >
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={!valid}>
              Send reset link
            </Button>
          </form>
        )}

        <div className="mt-4 text-center font-mono text-[12px]">
          <Link href="/sign-in" className="text-cyan hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </Panel>
    </div>
  );
}
