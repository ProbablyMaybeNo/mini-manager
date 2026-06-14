import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getPlanForUser, PLAN_LABEL } from "@/lib/billing/plans";
import { SettingsClient } from "./SettingsClient";

export default async function UserPage() {
  const userId = await currentUserId();
  const row = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  const tier = row ? getPlanForUser(row) : "free";
  // The kit's SettingsView shows "Upgrade" only when the plan name is exactly
  // "Free"; pass that literal for the free tier, the label otherwise.
  const planName = tier === "free" ? "Free" : PLAN_LABEL[tier];
  return <SettingsClient planName={planName} />;
}
