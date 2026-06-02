import { eq } from "drizzle-orm";
import { ChangePasswordCard } from "@/components/user/ChangePasswordCard";
import { ExportButton } from "@/components/user/ExportButton";
import { LibraryBrandFilterCard } from "@/components/user/LibraryBrandFilterCard";
import { RecoveryEmailCard } from "@/components/user/RecoveryEmailCard";
import { SignOutButton } from "@/components/user/SignOutButton";
import { Card } from "@/components/ui/Card";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { decodeLibraryBrandFilter } from "@/lib/libraryBrandFilter/decode";
import { listAllBrands } from "@/lib/actions/libraryBrandFilter";

export const dynamic = "force-dynamic";

/**
 * Plan-tier metadata.
 *
 * P11.9 introduced the StatusPill mapping. P12.17 expands the section
 * into a richer block with the locked pricing Ross resolved from
 * PHASE10_PLAN.md:
 *
 *   FREE         $0       — everything works, no caps
 *   PRO_MONTHLY  $4/mo    — subscription
 *   PRO_LIFETIME $29      — one-time, full Pro forever
 *   FOUNDER      $19      — early supporter slot (locked-in lifetime)
 *
 * Tiers are not yet schema-backed (`users.plan` defaults to "free" +
 * nothing writes the paid values). The mappings below are the
 * canonical display layer so the day Stripe ships (P10), this becomes
 * a single field bump.
 */
type PlanTier = "FREE" | "PRO_MONTHLY" | "PRO_LIFETIME" | "FOUNDER";
const PLAN_PILL: Readonly<Record<PlanTier, StatusPillKind>> = {
  FREE: "neutral",
  PRO_MONTHLY: "info",
  PRO_LIFETIME: "info",
  FOUNDER: "purple",
};
const PLAN_LABEL: Readonly<Record<PlanTier, string>> = {
  FREE: "FREE",
  PRO_MONTHLY: "PRO · MONTHLY",
  PRO_LIFETIME: "PRO · LIFETIME",
  FOUNDER: "FOUNDER",
};
const PLAN_PRICE: Readonly<Record<PlanTier, string>> = {
  FREE: "$0",
  PRO_MONTHLY: "$4 / month",
  PRO_LIFETIME: "$29 one-time",
  FOUNDER: "$19 one-time",
};
const PLAN_BLURB: Readonly<Record<PlanTier, string>> = {
  FREE: "Every feature, no caps. The default seat.",
  PRO_MONTHLY: "Sync + multi-device, billed monthly. Cancel anytime.",
  PRO_LIFETIME: "Sync + multi-device, paid once. Full Pro forever.",
  FOUNDER: "Early supporter slot — locked-in lifetime access at $19.",
};
const PLAN_FEATURES: Readonly<Record<PlanTier, ReadonlyArray<string>>> = {
  FREE: [
    "Unlimited projects, units, models",
    "Cross-brand paint library",
    "Recipes + palettes",
    "Local export to JSON",
  ],
  PRO_MONTHLY: [
    "Everything in Free",
    "Cloud sync across devices",
    "Priority feature votes",
    "Cancel any time",
  ],
  PRO_LIFETIME: [
    "Everything in Pro Monthly",
    "Pay once — full Pro forever",
    "Locked-in price across upgrades",
  ],
  FOUNDER: [
    "Everything in Pro Lifetime",
    "Founder badge across the app",
    "Reserved seat — limited supply",
  ],
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

  // P12.19 — also read libraryBrandFilter for the new card. Fetch
  // the full brand list in parallel.
  const [savedFilter, availableBrands] = await Promise.all([
    db
      .select({ libraryBrandFilter: users.libraryBrandFilter })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    listAllBrands(),
  ]);
  const initialBrands = decodeLibraryBrandFilter(
    savedFilter[0]?.libraryBrandFilter ?? null,
  );

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
          Your account tier. Free covers every feature; Pro and Founder
          unlock cloud sync + early-supporter benefits when Stripe
          ships.
        </p>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <StatusPill status={PLAN_PILL[planTier]}>
            {PLAN_LABEL[planTier]}
          </StatusPill>
          <span className="font-mono text-sm text-[var(--color-fg)] tabular-nums">
            {PLAN_PRICE[planTier]}
          </span>
          <span className="text-xs font-sans text-[var(--color-fg-muted)]">
            {PLAN_BLURB[planTier]}
          </span>
        </div>
        <ul className="space-y-1 text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          {PLAN_FEATURES[planTier].map((feat) => (
            <li key={feat} className="flex items-start gap-2">
              <span aria-hidden className="text-[var(--color-green)]">
                ✓
              </span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Coming soon
            </p>
            <a
              href="/pricing"
              className="text-2xs font-mono uppercase tracking-wider text-[var(--color-green)] hover:underline"
            >
              View pricing →
            </a>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-2xs font-mono">
            {(["PRO_MONTHLY", "PRO_LIFETIME", "FOUNDER"] as const).map(
              (tier) => (
                <li
                  key={tier}
                  className="frame px-2 py-2"
                  aria-label={`${PLAN_LABEL[tier]} tier — ${PLAN_PRICE[tier]}`}
                >
                  <span
                    className={
                      tier === "FOUNDER"
                        ? "text-[var(--color-purple-pastel)]"
                        : "text-[var(--color-cyan)]"
                    }
                  >
                    {PLAN_LABEL[tier]}
                  </span>
                  <span className="block text-[var(--color-fg)] tabular-nums">
                    {PLAN_PRICE[tier]}
                  </span>
                  <span className="block text-[var(--color-fg-muted)] mt-1 normal-case font-sans text-2xs leading-snug">
                    {PLAN_BLURB[tier]}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      </Card>

      <RecoveryEmailCard
        initialEmail={initialEmail}
        initialVerified={initialVerified}
      />

      <ChangePasswordCard />

      <LibraryBrandFilterCard
        availableBrands={availableBrands}
        initial={initialBrands}
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

      <Card title="Session" ariaLabel="Session">
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-snug mb-3">
          End your session on this device. You&apos;ll need to sign in again
          to use Mini Manager.
        </p>
        <SignOutButton />
      </Card>
    </div>
  );
}
