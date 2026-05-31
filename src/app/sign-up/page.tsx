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
        <div className="flex justify-center pt-2 md:pt-0">
          <Logo />
          <span className="sr-only">Mini Manager</span>
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
