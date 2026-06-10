import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { StatusPill } from "@/components/ui/StatusPill";
import { verifyRecoveryEmailToken } from "@/lib/auth/recoveryEmail";

export const dynamic = "force-dynamic";

/**
 * Recovery-email verification landing page. The user lands here after
 * clicking the link in their inbox. We consume the token + flip the
 * `recoveryEmailVerified` timestamp, then render a result.
 *
 * Auth required (currentUserId() in the action will redirect to
 * /sign-in if not signed in) — the link is bound to the user that
 * requested it.
 */
export default async function VerifyRecoveryEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  const result = token
    ? await verifyRecoveryEmailToken({ token })
    : { ok: false as const, message: "Missing verification token" };

  return (
    <AuthShell
      title="RECOVERY EMAIL"
      breadcrumb="SYS ▸ VERIFY"
      techLabel="AUTH ▸ VERIFY"
      footer={
        <Link
          href="/user"
          className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
        >
          ← Back to settings
        </Link>
      }
    >
      <div className="space-y-3" role={result.ok ? undefined : "alert"}>
        {result.ok ? (
          <>
            <StatusPill status="ok">VERIFIED</StatusPill>
            <p className="text-sm font-mono text-[var(--color-fg)] leading-snug">
              Your recovery email is now verified. You can use it for password
              reset and to upgrade to a paid plan.
            </p>
          </>
        ) : (
          <>
            <StatusPill status="danger">UNABLE TO VERIFY</StatusPill>
            <p className="text-sm font-mono text-[var(--color-fg)] leading-snug">
              {result.message}
            </p>
            <p className="text-xs font-mono text-[var(--color-fg-muted)] leading-snug">
              Go back to settings and request a fresh verification email.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
