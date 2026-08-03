"use client";

import { useState, useTransition } from "react";
import { AccountView } from "@/components/user/AccountView";
import { Button, Input, ModalDialog } from "@/components/kit";
import { guarded, guardedMessage } from "@/lib/actionGuard";
import { setRecoveryEmail } from "@/lib/auth/recoveryEmail";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { deleteAccount } from "@/lib/actions/account";
import { resendSignupVerification } from "@/lib/auth/resendSignupVerification";
import {
  generateExtensionToken,
  rotateExtensionToken,
} from "@/lib/actions/extensionToken";

export function AccountClient({
  username,
  recoveryEmail,
  canManageBilling = false,
  email = "",
  emailVerified = false,
}: {
  username: string;
  recoveryEmail: string;
  /** Paid-plan users only — controls whether the billing panel renders. */
  canManageBilling?: boolean;
  /** The account's sign-up email, for the verification panel. */
  email?: string;
  /** Whether `users.emailVerified` is stamped. */
  emailVerified?: boolean;
}) {
  const [resendState, setResendState] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);

  async function resendVerification() {
    setResendState(null);
    setResendPending(true);
    const res = await resendSignupVerification();
    setResendPending(false);
    setResendState(res.ok ? "Verification email sent — the link lasts 1 hour." : res.message);
  }

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
      // R2-14 — the worst place in the app to crash: unguarded, a rejection
      // replaced the dialog with the fault screen and left the painter with no
      // way to tell whether their account had just been deleted. Guarded, the
      // dialog stays open with an explicit "nothing was deleted, try again".
      const res = await guarded(
        deleteAccount,
        "Couldn’t reach the server — your account was NOT deleted. Check your connection, then try again.",
      );
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

      {/* Email-verification state was invisible everywhere in the app, and the
          signup link (1-hour lifetime, sent exactly once) could not be
          re-issued. Miss it and the account is permanently unverifiable through
          the UI — which silently 404s anything gated on `emailVerified`, with
          no way to tell that apart from a missing allowlist entry. */}
      {email && !emailVerified && (
        <div className="mx-6 mt-6 rounded-[12px] border border-yellow/40 bg-surface p-4">
          <p className="font-body text-body text-fg">
            ▸ <span className="font-bold text-yellow">{email}</span> isn&apos;t verified
            yet. Some features stay locked until it is.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            disabled={resendPending}
            onClick={resendVerification}
          >
            {resendPending ? "Sending…" : "Resend verification email"}
          </Button>
          {resendState && (
            <p className="mt-2 font-body text-body text-fg-dim" role="status">
              ▸ {resendState}
            </p>
          )}
        </div>
      )}
      {email && emailVerified && (
        <p className="mx-6 mt-6 font-body text-body text-fg-dim">
          ▸ <span className="text-fg">{email}</span> — verified.
        </p>
      )}

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
            // R2-14 (beyond the audit's table — `startSave` is a second
            // transition in this file and the sweep only looked for
            // `startTransition`). The recovery email IS the account-recovery
            // path; crashing the page mid-save is the worst outcome here.
            const res = await guardedMessage(
              () => setRecoveryEmail({ email: next.recoveryEmail }),
              "Couldn’t save the recovery email — check your connection, then try again.",
            );
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
            // The result was discarded, so the reassuring notice below was
            // shown even when nothing had been sent. Guarded, a transport
            // failure says so instead of promising an email that isn't coming.
            const res = await guardedMessage(
              () => requestPasswordReset({ username }),
              "Couldn’t request the change link — check your connection, then try again.",
            );
            setNotice(
              res.ok
                ? "If your account has a verified recovery email, a password-change link is on its way."
                : res.message,
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
