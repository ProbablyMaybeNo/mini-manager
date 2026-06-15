"use client";

import { useState } from "react";
import { Button, Input, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";

export interface AccountProfile {
  username: string;
  recoveryEmail: string;
}

export function AccountView({
  profile,
  onSave,
  onChangePassword,
  onDeleteAccount,
}: {
  profile: AccountProfile;
  onSave: (next: AccountProfile) => void;
  onChangePassword: () => void;
  onDeleteAccount?: () => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.recoveryEmail);

  const emailValid = email === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="ACCOUNT" tagline="Profile, password, and recovery." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="PROFILE" cornerTicks className="flex flex-col gap-4 p-5">
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
          <p className="font-mono text-xs text-fg-dim">
            Passwords are never entered here — we’ll email you a secure change link.
          </p>
          <div>
            <Button variant="secondary" onClick={onChangePassword}>
              Send password-change link
            </Button>
          </div>
        </Panel>
      </div>

      {onDeleteAccount && (
        <Panel label="DANGER ZONE" accent="red" className="flex flex-col gap-3 p-5">
          <p className="font-mono text-xs text-fg-dim">
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
