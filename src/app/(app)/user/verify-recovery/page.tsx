"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { verifyRecoveryEmailToken } from "@/lib/auth/recoveryEmail";

function Verify() {
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
    verifyRecoveryEmailToken({ token })
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
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="VERIFY EMAIL" tagline="Confirming your recovery email." />
      <Panel
        label={status === "ok" ? "SYS ▸ OK" : status === "error" ? "SYS ▸ ERROR" : "SYS ▸ …"}
        accent={status === "error" ? "red" : "cyan"}
        cornerTicks
        className="max-w-md p-6"
      >
        {status === "pending" ? (
          <p className="font-body text-body text-fg">▸ Verifying…</p>
        ) : status === "ok" ? (
          <p className="font-body text-body text-green text-glow-green">
            ▸ Recovery email verified. Password resets can now be sent to it.
          </p>
        ) : (
          <p className="font-body text-body text-red">▸ {message}</p>
        )}
        <div className="mt-4">
          <Link
            href="/user/account"
            className="label-osd text-cyan hover:underline"
          >
            ← Back to account
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export default function VerifyRecoveryPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}
