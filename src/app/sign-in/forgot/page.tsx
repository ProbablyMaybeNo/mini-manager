import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const params = await searchParams;
  const initialUsername = (params.u ?? "").trim();

  return (
    <AuthShell
      title="RESET PASSWORD"
      breadcrumb="SYS ▸ RECOVER"
      techLabel="AUTH ▸ RECOVER"
      blurb="We'll email a reset link to the recovery address on file."
      footer={
        <Link
          href="/sign-in"
          className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
        >
          ← Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm initialUsername={initialUsername} />
    </AuthShell>
  );
}
