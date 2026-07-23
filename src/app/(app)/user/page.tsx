import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getPlanForUser } from "@/lib/billing/plans";
import { SettingsClient } from "./SettingsClient";
import { SponsorPanel } from "./SponsorPanel";
import { AccountClient } from "./account/AccountClient";

export default async function UserPage() {
  const userId = await currentUserId();
  const row = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  // Account is folded into Settings — one nav entry, one scrolling page with a
  // SETTINGS section then an ACCOUNT section. The billing portal button only
  // renders for paid users (none while billing is dormant, so it stays hidden).
  const canManageBilling = row ? getPlanForUser(row) !== "free" : false;

  return (
    <div className="h-full overflow-y-auto">
      <SettingsClient />
      <SponsorPanel />
      <AccountClient
        username={row?.username ?? ""}
        recoveryEmail={row?.recoveryEmail ?? ""}
        canManageBilling={canManageBilling}
      />
    </div>
  );
}
