"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifySignupEmailToken } from "@/lib/auth/signupEmail";

function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    verifySignupEmailToken({ token })
      .then((res) => {
        if (res.ok) setStatus("ok");
        else {
          setStatus("error");
          setMessage(res.message);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-6 panel-depth text-center">
        <h1 className="font-mono text-[20px] font-extrabold uppercase tracking-tight text-fg-bright">
          {status === "ok"
            ? "Email verified"
            : status === "error"
              ? "Verification failed"
              : "Verifying…"}
        </h1>
        <span aria-hidden className="mx-auto mt-3 block h-1 w-12 rounded-full bg-cyan" />
        <p className="mt-4 font-body text-body text-fg-dim">
          {status === "pending"
            ? "Confirming your email…"
            : status === "ok"
              ? "You're verified — you're all set."
              : message}
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block font-mono text-[12px] font-bold uppercase tracking-wide text-cyan-lite underline-offset-4 transition-colors hover:underline"
        >
          Go to the app →
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
