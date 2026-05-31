import { eq } from "drizzle-orm";
import { ExportButton } from "@/components/user/ExportButton";
import { RecoveryEmailCard } from "@/components/user/RecoveryEmailCard";
import { Card } from "@/components/ui/Card";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";

/**
 * Plan-tier metadata (P11.9). The tiers themselves are not yet a
 * schema-backed feature; this is a read-only display + colour-coded
 * StatusPill mapping so the section is wired correctly the day the
 * paid-tier flag lands. Free is neutral grey, Pro picks up the cyan
 * "primary action" tone, Founder claims the pastel-purple "special /
 * featured" slot.
 */
type PlanTier = "FREE" | "PRO" | "FOUNDER";
const PLAN_PILL: Readonly<Record<PlanTier, StatusPillKind>> = {
  FREE: "neutral",
  PRO: "info",
  FOUNDER: "purple",
};
const PLAN_BLURB: Readonly<Record<PlanTier, string>> = {
  FREE: "Free tier — everything works, no caps.",
  PRO: "Pro tier — unlocks sync + multi-device.",
  FOUNDER: "Founder tier — early supporter pricing locked in.",
};

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

  // Plan tier is hardcoded to FREE until the paid-tier flag ships.
  // The mapping above is in place so the day the schema field lands,
  // this becomes a single-line swap. P11.9.
  const planTier: PlanTier = "FREE";

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl tracking-wide">USER</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans leading-snug">
          Your account, plan, and data tools. Set a recovery email to enable
          password reset; export a full JSON backup any time.
        </p>
      </header>

      <Card title="Plan" ariaLabel="Plan tier">
        <p className="text-xs font-sans text-[var(--color-fg-subtle)] mb-3 leading-snug">
          Your account tier. Free covers every feature; Pro and Founder are
          coming soon.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={PLAN_PILL[planTier]}>{planTier}</StatusPill>
          <span className="text-xs font-sans text-[var(--color-fg-muted)]">
            {PLAN_BLURB[planTier]}
          </span>
        </div>
      </Card>

      <RecoveryEmailCard
        initialEmail={initialEmail}
        initialVerified={initialVerified}
      />

      <Card title="Backup & export" ariaLabel="Backup and export">
        <p className="text-sm font-sans text-[var(--color-fg)] leading-snug">
          Downloads everything you own — projects, named models, recipes
          (with colour slots and steps), palettes, inventory, and wishlist —
          as a single JSON file. The schema is versioned so a future Mini
          Manager can re-import it.
        </p>
        <div className="pt-3">
          <ExportButton />
        </div>
      </Card>
    </div>
  );
}
