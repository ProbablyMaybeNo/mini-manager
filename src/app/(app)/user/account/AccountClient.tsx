"use client";

import { useState, useTransition } from "react";
import { AccountView } from "@/components/user/AccountView";
import { setRecoveryEmail } from "@/lib/auth/recoveryEmail";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export function AccountClient({
  username,
  recoveryEmail,
}: {
  username: string;
  recoveryEmail: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="relative">
      {notice ? (
        <div
          role="status"
          className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] border border-cyan bg-bg px-4 py-2 text-center font-mono text-xs text-cyan glow-cyan"
        >
          ▸ {notice}
        </div>
      ) : null}
      <AccountView
        profile={{ username, recoveryEmail }}
        onSave={(next) => {
          // Username changes aren't a supported mutation (it's the login
          // identity); persist the recovery email, which IS editable.
          setNotice(null);
          startTransition(async () => {
            const res = await setRecoveryEmail({ email: next.recoveryEmail });
            setNotice(
              res.ok
                ? "Recovery email saved — check it for a verification link."
                : res.message,
            );
          });
        }}
        onChangePassword={() => {
          // The kit's flow emails a secure change link (reset link) to the
          // verified recovery email.
          setNotice(null);
          startTransition(async () => {
            await requestPasswordReset({ username });
            setNotice(
              "If your account has a verified recovery email, a password-change link is on its way.",
            );
          });
        }}
      />
    </div>
  );
}
