import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  return (
    <AuthShell
      title="NEW PASSWORD"
      breadcrumb="SYS ▸ RESET"
      techLabel="AUTH ▸ RESET"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm font-mono text-[var(--color-fg)] leading-snug">
          Missing reset token. Request a new link from the{" "}
          <Link
            href="/sign-in/forgot"
            className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
          >
            forgot-password page
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
