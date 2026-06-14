import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const userId = await currentUserId();
  const row = (
    await db
      .select({ username: users.username, recoveryEmail: users.recoveryEmail })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0];
  return (
    <AccountClient
      username={row?.username ?? ""}
      recoveryEmail={row?.recoveryEmail ?? ""}
    />
  );
}
