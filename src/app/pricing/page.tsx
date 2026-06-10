import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  readFounderInventory,
  FOUNDER_TOTAL_SEATS,
} from "@/lib/billing/founderCounter";
import { getPlanForUser, type PlanTier } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing — Mini Manager",
  description:
    "Mini Manager pricing. Free tasting menu, Pro Monthly, Pro Lifetime, and Founder seats — pick the one that fits.",
};

/** Panel accent (REBUILD_SPEC §1 tokens). Founder = purple, the Von
 *  Restorff anchor — its panel + ribbon take the highlight, not Lifetime. */
type TierAccent = "neutral" | "cyan" | "green" | "purple";

interface TierCard {
  tier: PlanTier;
  name: string;
  price: string;
  blurb: string;
  features: ReadonlyArray<string>;
  accent: TierAccent;
  /** Von Restorff anchor — Founder, the limited supporter seat. */
  highlight?: boolean;
}

const TIERS: ReadonlyArray<TierCard> = [
  {
    tier: "free",
    name: "FREE",
    price: "$0",
    blurb: "The tasting menu — enough to feel the shape of the app.",
    accent: "neutral",
    features: [
      "1 project",
      "1 recipe",
      "3 wishlist items",
      "Cross-brand paint library",
      "Match + Gradient + Wheel tools",
      "JSON export of your data",
    ],
  },
  {
    tier: "pro_monthly",
    name: "PRO · MONTHLY",
    price: "$4 / month",
    blurb: "Unlimited everything. Cancel any time.",
    accent: "cyan",
    features: [
      "Unlimited projects, units, models",
      "Unlimited recipes + palettes",
      "Unlimited wishlist",
      "Cloud sync across devices",
      "Priority feature votes",
    ],
  },
  {
    tier: "pro_lifetime",
    name: "PRO · LIFETIME",
    price: "$36 one-time",
    blurb: "Pay once. Three months free vs monthly. Full Pro forever.",
    accent: "green",
    features: [
      "Everything in Pro Monthly",
      "One-time payment",
      "Locked-in price across upgrades",
      "Best long-term value",
    ],
  },
  {
    tier: "founder",
    name: "FOUNDER",
    price: "$26 one-time",
    blurb: "Early supporter seat — 100 only.",
    accent: "purple",
    highlight: true,
    features: [
      "Everything in Pro Lifetime",
      "Founder badge across the app",
      "Name on the About page",
      "Reserved seat — limited supply",
    ],
  },
];

export default async function PricingPage() {
  const inventory = await readFounderInventory();
  const session = await auth();

  let activeTier: PlanTier | null = null;
  let recoveryEmailVerified = false;

  if (session?.user?.id) {
    const row = await db
      .select({
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        founderClaimedAt: users.founderClaimedAt,
        recoveryEmailVerified: users.recoveryEmailVerified,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const u = row[0];
    if (u) {
      activeTier = getPlanForUser(u);
      recoveryEmailVerified = Boolean(u.recoveryEmailVerified);
    }
  }

  const signedIn = activeTier !== null;
  const visibleTiers = TIERS.filter(
    (t) => t.tier !== "founder" || !inventory.soldOut,
  );

  return (
    // D7 — width-cap the pricing tiers with the shared .content-cap so the
    // multi-column tier row doesn't sprawl on an ultrawide [D §7, §10].
    <div className="content-cap p-6 md:p-8 space-y-8">
      <PageHeader
        title="PRICING"
        accent="cyan"
        tagline={`The free tier gets you a real taste. Pro unlocks the limits. Founder is the one-time supporter slot — capped at ${FOUNDER_TOTAL_SEATS}.`}
      />

      <p
        className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-purple-pastel)]"
        aria-live="polite"
      >
        {inventory.soldOut
          ? "FOUNDER SEATS SOLD OUT"
          : `${inventory.remaining} OF ${FOUNDER_TOTAL_SEATS} FOUNDER SEATS REMAINING`}
      </p>

      <div
        className={`grid gap-4 ${
          visibleTiers.length === 4
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1 md:grid-cols-3"
        }`}
      >
        {visibleTiers.map((t) => (
          <TierCardView
            key={t.tier}
            card={t}
            isCurrent={signedIn && activeTier === t.tier}
            signedIn={signedIn}
            verified={recoveryEmailVerified}
            inventory={inventory}
          />
        ))}
      </div>

      <p className="text-center text-xs font-mono text-[var(--color-fg-muted)] max-w-xl mx-auto leading-relaxed pt-4">
        Checkout will ship once the Stripe wire-up lands. Until then any upgrade
        button is informational — your data + free tier work uninterrupted.
      </p>
    </div>
  );
}

function TierCardView({
  card,
  isCurrent,
  signedIn,
  verified,
  inventory,
}: {
  card: TierCard;
  isCurrent: boolean;
  signedIn: boolean;
  verified: boolean;
  inventory: { remaining: number; soldOut: boolean };
}) {
  const founderSoldOut = card.tier === "founder" && inventory.soldOut;
  const priceColor =
    card.accent === "neutral"
      ? "var(--color-fg)"
      : card.accent === "cyan"
        ? "var(--color-cyan)"
        : card.accent === "green"
          ? "var(--color-green)"
          : "var(--color-purple-pastel)";

  return (
    <div className={card.highlight ? "relative pt-2" : undefined}>
      {/* UX-1313 / REBUILD_SPEC §10 — Founder is the Von Restorff anchor:
          the limited supporter seat gets the "LIMITED" ribbon + a purple
          nested-border + glow so the eye lands on the scarce tier. */}
      {card.highlight ? (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 z-10 inline-flex items-center px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.14em] bg-[var(--color-purple-pastel)] text-[var(--color-bg)]">
          Limited seat
        </span>
      ) : null}
      <Panel
        as="section"
        variant={card.accent === "neutral" ? "default" : card.accent}
        nested={card.highlight}
        ticks={card.highlight}
        aria-label={`${card.name} tier — ${card.price}${
          card.highlight ? " — limited supporter seat" : ""
        }`}
        className="h-full px-4 py-5 space-y-4"
      >
        <div className="space-y-2">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-fg)]">
            {card.name}
          </h2>
          <p
            className="text-2xl font-mono tabular-nums"
            style={{ color: priceColor }}
          >
            {card.price}
          </p>
          <p className="text-xs font-mono text-[var(--color-fg-muted)] leading-snug">
            {card.blurb}
          </p>
          {isCurrent ? (
            <div className="pt-1">
              <StatusPill status="ok">Current plan</StatusPill>
            </div>
          ) : null}
          {card.tier === "founder" && !founderSoldOut ? (
            <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--color-purple-pastel)] pt-1">
              {inventory.remaining} / {FOUNDER_TOTAL_SEATS} left
            </p>
          ) : null}
        </div>

        <ul className="space-y-1.5 text-xs font-mono text-[var(--color-fg-muted)] leading-snug">
          {card.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2">
              <span aria-hidden className="text-[var(--color-green)] mt-0.5">
                ✓
              </span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <TierCta
            card={card}
            isCurrent={isCurrent}
            signedIn={signedIn}
            verified={verified}
            soldOut={founderSoldOut}
          />
        </div>
      </Panel>
    </div>
  );
}

function TierCta({
  card,
  isCurrent,
  signedIn,
  verified,
  soldOut,
}: {
  card: TierCard;
  isCurrent: boolean;
  signedIn: boolean;
  verified: boolean;
  soldOut: boolean;
}) {
  if (card.tier === "free") {
    if (isCurrent) {
      return (
        <Button variant="secondary" tone="outline" disabled size="sm">
          You&apos;re on Free
        </Button>
      );
    }
    if (!signedIn) {
      return (
        <Button as="a" href="/sign-up?next=/pricing" variant="success" size="sm">
          Start free
        </Button>
      );
    }
    return (
      <Button variant="secondary" tone="outline" disabled size="sm">
        Already signed in
      </Button>
    );
  }

  // Paid tiers
  if (isCurrent) {
    return (
      <Button variant="secondary" tone="outline" disabled size="sm">
        Current plan
      </Button>
    );
  }

  if (soldOut) {
    return (
      <Button variant="secondary" tone="outline" disabled size="sm">
        Sold out
      </Button>
    );
  }

  if (!signedIn) {
    return (
      <Button as="a" href="/sign-up?next=/pricing" variant="success" size="sm">
        Start free, upgrade later
      </Button>
    );
  }

  if (!verified) {
    return (
      <div className="space-y-1">
        <Button as="a" href="/user" variant="warning" size="sm">
          Verify email to upgrade
        </Button>
        <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
          Add + verify a recovery email first.
        </p>
      </div>
    );
  }

  // Signed-in + verified: checkout stub. Stripe wire-up pending (P10.4).
  return (
    <div className="space-y-1">
      <Button variant="secondary" tone="outline" disabled size="sm">
        Checkout coming soon
      </Button>
      <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
        Stripe wire-up shipping shortly.
      </p>
    </div>
  );
}
