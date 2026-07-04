"use client";

import { useState, useTransition } from "react";
import { AccountView } from "@/components/user/AccountView";
import { Button, Input, ModalDialog } from "@/components/kit";
import { setRecoveryEmail } from "@/lib/auth/recoveryEmail";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { deleteAccount } from "@/lib/actions/account";
import {
  generateExtensionToken,
  rotateExtensionToken,
} from "@/lib/actions/extensionToken";

export function AccountClient({
  username,
  recoveryEmail,
  canManageBilling = false,
}: {
  username: string;
  recoveryEmail: string;
  /** Paid-plan users only — controls whether the billing panel renders. */
  canManageBilling?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [billingPending, setBillingPending] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startSave] = useTransition();

  // Open the Stripe billing portal: POST the route, then redirect the whole
  // tab to the returned portal URL. Keeps `billingPending` true through the
  // redirect so the button stays disabled until the navigation takes over.
  async function openBillingPortal() {
    setBillingError(null);
    setBillingPending(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (res.ok && data?.url) {
        // Hand off to Stripe — leave the button disabled (don't reset pending)
        // so it can't be double-clicked while the navigation takes over.
        window.location.href = data.url;
        return;
      }
      setBillingError(
        data?.error ?? "Could not open the billing portal. Try again.",
      );
    } catch {
      setBillingError("Could not reach billing. Check your connection.");
    }
    setBillingPending(false);
  }

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
          className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded-[6px] border border-cyan/50 bg-surface px-4 py-2 text-center font-body text-body text-cyan-lite panel-depth motion-safe:animate-menu-in"
        >
          ▸ {notice}
        </div>
      ) : null}
      <AccountView
        profile={{ username, recoveryEmail }}
        canManageBilling={canManageBilling}
        onManageBilling={openBillingPortal}
        billingPending={billingPending}
        billingError={billingError}
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
        onGenerateToken={async () => {
          const res = await generateExtensionToken();
          return res.ok
            ? { ok: true as const, token: res.data }
            : { ok: false as const, error: res.error };
        }}
        onRegenerateToken={async () => {
          const res = await rotateExtensionToken();
          return res.ok
            ? { ok: true as const, token: res.data }
            : { ok: false as const, error: res.error };
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
        <p className="mb-3 font-body text-body text-fg-dim">
          This permanently deletes your account and all of its data. To
          confirm, type your username{" "}
          <span className="font-bold text-red">{username}</span> below.
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
          <p className="mt-2 font-body text-body text-red-text" role="alert">
            ▸ {deleteError}
          </p>
        )}
      </ModalDialog>
    </div>
  );
}
