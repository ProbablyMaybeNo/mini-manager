import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { SignUpForm } from "./SignUpForm";

export const dynamic = "force-dynamic";

/**
 * Sign-up page. Free tier — username + password only, no email. Email
 * (under `recoveryEmail`) is the upgrade gate added later in Settings.
 */
export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/projects");
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="sr-only">Create your Mini Manager account</h1>
        {/* UX-1209 — on mobile the full-width hero (~312px square) pushed
            Password / Confirm / submit below the 667 fold. Cap it at
            150px on small screens so the form is the visible task; it
            grows back to full panel width at md+. */}
        <div className="flex flex-col items-center gap-2 pt-2 md:pt-0">
          <div className="w-full max-w-[150px] md:max-w-none">
            <Logo decorative />
          </div>
          <p
            className="font-mono text-2xs uppercase tracking-[0.25em] text-[var(--color-cyan)]"
            aria-hidden
          >
            SYS ▸ ENROL
          </p>
        </div>

        <Card title="Create account" ariaLabel="Create account">
          <SignUpForm />
        </Card>

        <p className="text-center text-xs font-mono text-[var(--color-fg-muted)]">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[var(--color-accent)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
