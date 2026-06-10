import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell
      title="SIGN IN"
      breadcrumb="SYS ▸ ACCESS"
      techLabel="AUTH ▸ LOGIN"
      footer={
        <>
          No account yet?{" "}
          <Link
            href="/sign-up"
            className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <SignInForm
        redirectTarget={redirectTarget}
        initialError={error ? decodeURIComponent(error) : null}
      />
    </AuthShell>
  );
}
