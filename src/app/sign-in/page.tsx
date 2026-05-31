import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

/**
 * Sign-in page — username + password (Phase 9). The legacy magic-link
 * form is gone; the Resend transport survives only for recovery-email
 * verify + password reset, both of which have dedicated routes.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    from?: string;
    clone?: string;
  }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const from = params.from;

  const session = await auth();
  if (session?.user) {
    const safeFrom =
      from && from.startsWith("/") && !from.startsWith("//") ? from : null;
    redirect(safeFrom ?? "/projects");
  }

  const safeFromRaw =
    from && from.startsWith("/") && !from.startsWith("//") ? from : null;
  const redirectTarget = safeFromRaw ?? "/projects";

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="sr-only">Sign in to Mini Manager</h1>
        <div className="flex justify-center pt-2 md:pt-0">
          <Logo decorative />
        </div>

        <Card title="Sign in" ariaLabel="Sign in">
          <SignInForm
            redirectTarget={redirectTarget}
            initialError={error ? decodeURIComponent(error) : null}
          />
        </Card>

        <p className="text-center text-xs font-mono text-[var(--color-fg-muted)]">
          No account yet?{" "}
          <Link
            href="/sign-up"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
