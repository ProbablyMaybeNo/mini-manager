import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getPlanForUser } from "@/lib/billing/plans";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const userId = await currentUserId();
  const row = (
    await db
      .select({
        username: users.username,
        recoveryEmail: users.recoveryEmail,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        founderClaimedAt: users.founderClaimedAt,
        freeForeverGrantedAt: users.freeForeverGrantedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0];
  // Only paid plans have a Stripe subscription/customer to manage; the portal
  // button stays hidden for free-tier users (getPlanForUser === "free").
  const canManageBilling = row ? getPlanForUser(row) !== "free" : false;
  return (
    <AccountClient
      username={row?.username ?? ""}
      recoveryEmail={row?.recoveryEmail ?? ""}
      canManageBilling={canManageBilling}
    />
  );
}
