"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input } from "@/components/kit";
import { Logo } from "@/components/shell";
import { SUPPORT_EMAIL } from "@/lib/support";

export type AuthMode = "sign-in" | "sign-up";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthView({
  mode,
  onSubmit,
  from,
}: {
  mode: AuthMode;
  onSubmit: (username: string, password: string, email?: string) => void;
  /** Post-auth return path, preserved across the sign-in ↔ sign-up switch
   *  link so an in-progress upgrade survives switching forms. */
  from?: string;
}) {
  const isSignUp = mode === "sign-up";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  // UX-015: show/hide password toggle so the painter can verify what they typed.
  const [showPassword, setShowPassword] = useState(false);

  const userError = touched && username.trim().length < 3 ? "Min 3 characters" : undefined;
  const passError = touched && password.length < 8 ? "Min 8 characters" : undefined;
  const emailError =
    touched && isSignUp && !EMAIL_RE.test(email.trim()) ? "Enter a valid email" : undefined;
  const valid =
    username.trim().length >= 3 &&
    password.length >= 8 &&
    (!isSignUp || EMAIL_RE.test(email.trim()));
  const switchTo = isSignUp ? "/sign-in" : "/sign-up";
  const switchHref = from
    ? `${switchTo}?from=${encodeURIComponent(from)}`
    : switchTo;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-6 panel-depth motion-safe:animate-content-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo href="/" size={40} />
          {/* HEX.CODE title + cyan underline (matches the app PageHeader). */}
          <h1 className="font-mono text-[20px] font-extrabold uppercase tracking-tight text-fg-bright">
            {isSignUp ? "Create account" : "Sign in"}
          </h1>
          <span aria-hidden className="block h-1 w-12 rounded-full bg-cyan" />
          <p className="font-mono text-body text-fg-dim">
            {isSignUp ? "New user — The Mini Mainframe" : "Welcome back to The Mini Mainframe"}
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) onSubmit(username.trim(), password, isSignUp ? email.trim() : undefined);
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
          {isSignUp && (
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              error={emailError}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <Input
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            error={passError}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide characters" : "Reveal characters"}
                aria-pressed={showPassword}
                className="-m-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] p-1 text-fg-dim transition-colors hover:text-cyan-lite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan md:min-h-6 md:min-w-6"
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden />
                ) : (
                  <Eye size={16} aria-hidden />
                )}
              </button>
            }
          />

          <Button type="submit" className="w-full">
            {isSignUp ? "Create account" : "Enter"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between font-body text-body">
          <Link
            href={switchHref}
            className="text-cyan-lite underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:underline"
          >
            {isSignUp ? "Have an account? Sign in" : "New here? Create account"}
          </Link>
          {!isSignUp && (
            <Link
              href="/reset"
              className="text-fg-dim underline-offset-4 transition-colors hover:text-cyan-lite focus:outline-none focus-visible:text-cyan-lite"
            >
              Forgot?
            </Link>
          )}
        </div>

        {/* Testing-period notice — the launch model: free during the intro
            period for everyone, free FOREVER for testers who send feedback. */}
        <div className="mt-5 border-t border-border pt-4 text-center">
          <p className="font-mono text-[12px] font-bold uppercase tracking-wide text-cyan-lite">
            Free forever for testers
          </p>
          <p className="mt-1.5 font-body text-[12px] leading-relaxed text-fg-dim">
            Sign up with your email, verify it, and send feedback — in the app
            or via the Beacon Hobbies Discord — and your account stays free for
            good. Limited spots before some features move behind a paywall.
          </p>
          <p className="mt-2 font-body text-[12px] leading-relaxed text-fg-dim">
            Just exploring? Go ahead — the whole app is free for everyone during
            the introduction period.
          </p>
        </div>

        <p className="mt-4 text-center font-body text-[12px] text-fg-dim">
          Need help or can’t sign in? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
