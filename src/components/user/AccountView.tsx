"use client";

import { useState } from "react";
import { Button, Input, Panel } from "@/components/kit";
import { InstallPanel } from "@/components/pwa";
import { PageHeader } from "@/components/shell";
import {
  ExtensionTokenPanel,
  type ExtensionTokenPanelProps,
} from "./ExtensionTokenPanel";

export interface AccountProfile {
  username: string;
  recoveryEmail: string;
}

export function AccountView({
  profile,
  onSave,
  onChangePassword,
  onDeleteAccount,
  onGenerateToken,
  onRegenerateToken,
  canManageBilling = false,
  onManageBilling,
  billingPending = false,
  billingError,
}: {
  profile: AccountProfile;
  onSave: (next: AccountProfile) => void;
  onChangePassword: () => void;
  onDeleteAccount?: () => void;
  onGenerateToken: ExtensionTokenPanelProps["onGenerate"];
  onRegenerateToken: ExtensionTokenPanelProps["onRegenerate"];
  /** True only for users on a paid plan — gates the billing panel below. */
  canManageBilling?: boolean;
  /** POSTs to /api/billing/portal and redirects to the returned portal URL. */
  onManageBilling?: () => void;
  billingPending?: boolean;
  billingError?: string | null;
}) {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.recoveryEmail);

  const emailValid = email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="ACCOUNT" tagline="Profile, password, and recovery." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="PROFILE" className="flex flex-col gap-4 p-5">
          <Input
            label="Username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Recovery email"
            name="email"
            type="email"
            value={email}
            error={emailValid ? undefined : "Enter a valid email"}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <Button
              disabled={!emailValid || !username.trim()}
              onClick={() => onSave({ username: username.trim(), recoveryEmail: email })}
            >
              Save changes
            </Button>
          </div>
        </Panel>

        <Panel label="SECURITY" className="flex flex-col gap-4 p-5">
          <p className="font-body text-body text-fg-dim">
            Passwords are never entered here — we’ll email you a secure change link.
          </p>
          <div>
            <Button variant="secondary" onClick={onChangePassword}>
              Send password-change link
            </Button>
          </div>
        </Panel>

        <ExtensionTokenPanel
          onGenerate={onGenerateToken}
          onRegenerate={onRegenerateToken}
        />

        {/* Self-hiding — renders only when the browser offers an install and
            the app isn't already installed (PWA install affordance). */}
        <InstallPanel />

        {canManageBilling && (
          <Panel label="BILLING" className="flex flex-col gap-4 p-5">
            <p className="font-body text-body text-fg-dim">
              Update your payment method, view invoices, or cancel your plan in
              the secure Stripe portal.
            </p>
            <div>
              <Button
                variant="secondary"
                disabled={billingPending}
                onClick={onManageBilling}
              >
                {billingPending ? "Opening…" : "Manage subscription"}
              </Button>
            </div>
            {billingError && (
              <p className="font-body text-body text-red" role="alert">
                ▸ {billingError}
              </p>
            )}
          </Panel>
        )}
      </div>

      {onDeleteAccount && (
        <Panel label="DANGER ZONE" accent="red" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg-dim">
            Deleting your account permanently removes your projects, recipes,
            collection, and everything else. This can’t be undone — export your
            data first if you want a copy.
          </p>
          <div>
            <Button variant="danger" onClick={onDeleteAccount}>
              Delete account…
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
