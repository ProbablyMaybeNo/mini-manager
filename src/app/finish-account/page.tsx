import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { FinishAccountForm } from "./FinishAccountForm";

export const dynamic = "force-dynamic";

/**
 * Migration shim for accounts created before P9. If the signed-in user
 * already has a complete (username + passwordHash) account, we
 * short-circuit straight to /projects. Otherwise render the two-field
 * form.
 */
export default async function FinishAccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  const userId = session.user.id;

  const row = (
    await db
      .select({
        username: users.username,
        passwordHash: users.passwordHash,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0];

  if (row?.username && row?.passwordHash) {
    redirect("/projects");
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center pt-2 md:pt-0">
          <Logo />
          <span className="sr-only">Mini Manager</span>
        </div>

        <Card title="Finish setting up your account" ariaLabel="Finish account">
          <p className="text-sm font-sans text-[var(--color-fg-muted)]">
            Pick a username and password to finish setting up your account.
            Your existing email{row?.email ? ` (${row.email})` : ""} becomes
            your recovery address.
          </p>
          <FinishAccountForm />
        </Card>
      </div>
    </div>
  );
}
