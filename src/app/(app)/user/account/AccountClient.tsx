"use client";

import { useState, useTransition } from "react";
import { AccountView } from "@/components/user/AccountView";
import { Button, Input, ModalDialog } from "@/components/kit";
import { setRecoveryEmail } from "@/lib/auth/recoveryEmail";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { deleteAccount } from "@/lib/actions/account";

export function AccountClient({
  username,
  recoveryEmail,
}: {
  username: string;
  recoveryEmail: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startSave] = useTransition();

  // Require the exact username to be typed — guards against an accidental
  // destructive click.
  const confirmed = confirmText.trim() === username;

  function runDelete() {
    if (!confirmed || pending) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteAccount();
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      // The session row cascaded away with the account; force a full reload
      // to the landing page so no stale client state lingers.
      window.location.href = "/";
    });
  }

  return (
    <div className="relative">
      {notice ? (
        <div
          role="status"
          className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] border border-cyan bg-bg px-4 py-2 text-center font-body text-body text-cyan glow-cyan"
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
          startSave(async () => {
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
          startSave(async () => {
            await requestPasswordReset({ username });
            setNotice(
              "If your account has a verified recovery email, a password-change link is on its way.",
            );
          });
        }}
        onDeleteAccount={() => {
          setDeleteError(null);
          setConfirmText("");
          setConfirmOpen(true);
        }}
      />

      <ModalDialog
        open={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        title="Delete account"
        breadcrumb="DANGER ZONE"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!confirmed || pending}
              onClick={runDelete}
            >
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        }
      >
        <p className="mb-3 font-body text-body text-fg">
          This permanently deletes your account and all of its data. To
          confirm, type your username{" "}
          <span className="text-red">{username}</span> below.
        </p>
        <Input
          name="confirm-username"
          autoFocus
          placeholder={username}
          value={confirmText}
          disabled={pending}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runDelete()}
        />
        {deleteError && (
          <p className="mt-2 font-body text-body text-red" role="alert">
            ▸ {deleteError}
          </p>
        )}
      </ModalDialog>
    </div>
  );
}
