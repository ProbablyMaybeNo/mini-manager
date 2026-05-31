import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
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
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="sr-only">Set a new password</h1>
        <div className="flex justify-center pt-2 md:pt-0">
          <Logo />
          <span className="sr-only">Mini Manager</span>
        </div>

        <Card title="Set a new password" ariaLabel="Set a new password">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-sm font-sans pt-2">
              Missing reset token. Request a new link from the{" "}
              <Link
                href="/sign-in/forgot"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                forgot-password page
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
