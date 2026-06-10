import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell
      title="CREATE ACCOUNT"
      breadcrumb="SYS ▸ ENROL"
      techLabel="AUTH ▸ NEW"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[var(--color-cyan)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
