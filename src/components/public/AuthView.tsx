"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Panel } from "@/components/kit";
import { Logo } from "@/components/shell";
import { BootSequence } from "@/components/kit";

export type AuthMode = "sign-in" | "sign-up";

export function AuthView({
  mode,
  onSubmit,
  from,
}: {
  mode: AuthMode;
  onSubmit: (username: string, password: string) => void;
  /** Post-auth return path, preserved across the sign-in ↔ sign-up switch
   *  link so an in-progress upgrade survives switching forms. */
  from?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const userError = touched && username.trim().length < 3 ? "Min 3 characters" : undefined;
  const passError = touched && password.length < 8 ? "Min 8 characters" : undefined;
  const valid = username.trim().length >= 3 && password.length >= 8;

  const isSignUp = mode === "sign-up";
  const switchTo = isSignUp ? "/sign-in" : "/sign-up";
  const switchHref = from
    ? `${switchTo}?from=${encodeURIComponent(from)}`
    : switchTo;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Panel label="SYS ▸ ACCESS" cornerTicks glow className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <Logo href="/" size={128} className="animate-power-on" />
          <BootSequence
            lines={[
              "MINI-MANAGER OS v1.0",
              isSignUp ? "NEW USER REGISTRATION" : "AWAITING CREDENTIALS",
            ]}
          />
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) onSubmit(username.trim(), password);
          }}
        >
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            value={username}
            error={userError}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            error={passError}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full">
            {isSignUp ? "Create account" : "Enter"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between font-mono text-[11px]">
          <Link
            href={switchHref}
            className="text-cyan hover:underline"
          >
            {isSignUp ? "Have an account? Sign in" : "New here? Create account"}
          </Link>
          {!isSignUp && (
            <Link href="/reset" className="text-fg-faint hover:text-cyan">
              Forgot?
            </Link>
          )}
        </div>
      </Panel>
    </div>
  );
}
