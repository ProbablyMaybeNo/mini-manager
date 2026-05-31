import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
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
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="sr-only">Reset your password</h1>
        <div className="flex justify-center pt-2 md:pt-0">
          <Logo />
          <span className="sr-only">Mini Manager</span>
        </div>

        <Card title="Reset password" ariaLabel="Reset password">
          <p className="text-sm font-sans text-[var(--color-fg-muted)]">
            We&apos;ll email a reset link to the recovery address on file.
          </p>
          <ForgotPasswordForm initialUsername={initialUsername} />
        </Card>

        <p className="text-center text-xs font-mono text-[var(--color-fg-muted)]">
          <Link
            href="/sign-in"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
