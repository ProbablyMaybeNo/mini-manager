import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell
      title="FINISH SETUP"
      breadcrumb="SYS ▸ SETUP"
      techLabel="AUTH ▸ SETUP"
      blurb={
        <>
          Pick a username and password to finish setting up your account. Your
          existing email{row?.email ? ` (${row.email})` : ""} becomes your
          recovery address.
        </>
      }
    >
      <FinishAccountForm />
    </AuthShell>
  );
}
