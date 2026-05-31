import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Resolve the current user id from the session. Throws via `redirect`
 * to `/sign-in` if nothing is authenticated — server actions and pages
 * can therefore treat the return value as a guaranteed string.
 *
 * Despite the filename, this is the real auth helper now. P1.3 replaced
 * the stub with the NextAuth session lookup; the filename stays so all
 * existing call sites only need to add `await`.
 *
 * **P9.7 migration shim** — if the session belongs to a legacy magic-link
 * account (`username IS NULL` or `passwordHash IS NULL`), redirect to
 * `/finish-account` so the user can pick a username + password before
 * doing anything else. The finish-account page itself opts out via
 * `skipMigrationCheck: true`.
 */
export async function currentUserId(opts?: {
  skipMigrationCheck?: boolean;
}): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    redirect("/sign-in");
  }

  if (!opts?.skipMigrationCheck) {
    const row = await db
      .select({
        passwordHash: users.passwordHash,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const user = row[0];
    // A "complete" account has BOTH a username and a passwordHash. Any
    // session whose user row is missing either field came in through
    // the legacy magic-link transport (or the ALLOW_TEST_AUTH bypass)
    // and must finish setup before continuing.
    if (user && (!user.passwordHash || !user.username)) {
      redirect("/finish-account");
    }
  }

  return id;
}
