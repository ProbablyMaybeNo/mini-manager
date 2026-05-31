import { eq } from "drizzle-orm";
import { ExportButton } from "@/components/user/ExportButton";
import { RecoveryEmailCard } from "@/components/user/RecoveryEmailCard";
import { Card } from "@/components/ui/Card";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";

export default async function UserPage() {
  const userId = await currentUserId();
  const row = await db
    .select({
      recoveryEmail: users.recoveryEmail,
      recoveryEmailVerified: users.recoveryEmailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const initialEmail = row[0]?.recoveryEmail ?? null;
  const initialVerified = Boolean(row[0]?.recoveryEmailVerified);

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl tracking-wide">USER</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans">
          Manage your recovery email and download a full backup of your data.
        </p>
      </header>

      <RecoveryEmailCard
        initialEmail={initialEmail}
        initialVerified={initialVerified}
      />

      <Card title="Backup & export" ariaLabel="Backup and export">
        <p className="text-sm font-sans text-[var(--color-fg)]">
          Downloads everything you own — projects, named models, recipes
          (with zones and steps), palettes, inventory, and wishlist — as a
          single JSON file. The schema is versioned so a future Mini Manager
          can re-import it.
        </p>
        <div className="pt-3">
          <ExportButton />
        </div>
      </Card>
    </div>
  );
}
