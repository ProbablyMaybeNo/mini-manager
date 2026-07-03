"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/kit";
import { Logo } from "@/components/shell";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export default function ResetPage() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(false);
  const [, startTransition] = useTransition();
  const valid = username.trim().length >= 3;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-6 panel-depth motion-safe:animate-content-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo href="/" size={40} />
          <h1 className="font-mono text-[20px] font-extrabold uppercase tracking-tight text-fg-bright">
            Reset password
          </h1>
          <span aria-hidden className="block h-1 w-12 rounded-full bg-cyan" />
        </div>

        {sent ? (
          <p className="rounded-[6px] border border-green/40 bg-green/5 px-3 py-2 font-body text-body text-green">
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

        <div className="mt-5 text-center font-body text-body">
          <Link
            href="/sign-in"
            className="text-cyan-lite underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
