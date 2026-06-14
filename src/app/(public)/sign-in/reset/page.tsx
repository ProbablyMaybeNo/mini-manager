"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { applyPasswordReset } from "@/lib/auth/passwordReset";

function ResetConfirm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const valid = password.length >= 8;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Panel label="SYS ▸ RESET" cornerTicks glow className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <Logo href="/" size={56} />
          <p className="font-mono text-xs text-fg-dim">Set a new password</p>
        </div>

        {!token ? (
          <p className="font-mono text-sm text-red">
            ▸ Missing or invalid reset link.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              setError(null);
              startTransition(async () => {
                const res = await applyPasswordReset({
                  token,
                  password,
                });
                if (!res.ok) {
                  setError(res.message);
                  return;
                }
                // applyPasswordReset mints a fresh session on success.
                router.push("/dashboard");
                router.refresh();
              });
            }}
          >
            <Input
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              error={password && !valid ? "Min 8 characters" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="font-mono text-xs text-red">▸ {error}</p> : null}
            <Button type="submit" className="w-full" disabled={!valid}>
              Set password
            </Button>
          </form>
        )}

        <div className="mt-4 text-center font-mono text-[11px]">
          <Link href="/sign-in" className="text-cyan hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ResetConfirm />
    </Suspense>
  );
}
