import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

interface TierCard {
  tier: PlanTier;
  name: string;
  price: string;
  blurb: string;
  features: ReadonlyArray<string>;
  accent: "neutral" | "cyan" | "green" | "purple";
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
    highlight: true,
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
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <header className="space-y-2 text-center max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl tracking-wide">PRICING</h1>
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
          The free tier gets you a real taste. Pro unlocks the limits. Founder
          is the one-time supporter slot — capped at {FOUNDER_TOTAL_SEATS}.
        </p>
        {!inventory.soldOut ? (
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-purple-pastel)]">
            {inventory.remaining} of {FOUNDER_TOTAL_SEATS} Founder seats remaining
          </p>
        ) : (
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Founder seats sold out
          </p>
        )}
      </header>

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

      <div className="text-center text-xs font-sans text-[var(--color-fg-muted)] max-w-xl mx-auto leading-relaxed pt-4">
        <p>
          Checkout will ship once the Stripe wire-up lands. Until then any
          upgrade button is informational — your data + free tier work
          uninterrupted.
        </p>
      </div>
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

  return (
    <div className={card.highlight ? "relative" : undefined}>
      {/* UX-1313 — one recommended tier (Pro Lifetime) gets a "Best value"
          ribbon + accent-glow border so the eye has an anchor, per the
          universal pricing-table convention (Von Restorff). */}
      {card.highlight ? (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-2xs uppercase tracking-wider bg-[var(--color-green)] text-[var(--color-bg)]">
          Best value
        </span>
      ) : null}
      <Card
        title={card.name}
        ariaLabel={`${card.name} tier — ${card.price}${card.highlight ? " — recommended" : ""}`}
        accentColor={card.accent}
        className={
          card.highlight
            ? "border-[var(--color-green)] shadow-[0_0_0_1px_var(--color-green),0_0_18px_-4px_color-mix(in_srgb,var(--color-green)_50%,transparent)]"
            : undefined
        }
      >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-mono tabular-nums text-[var(--color-fg)]">
            {card.price}
          </p>
          <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
            {card.blurb}
          </p>
          {isCurrent ? (
            <div className="pt-1">
              <StatusPill status="ok">Current plan</StatusPill>
            </div>
          ) : null}
          {card.tier === "founder" && !founderSoldOut ? (
            <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-purple-pastel)] pt-1">
              {inventory.remaining} / {FOUNDER_TOTAL_SEATS} left
            </p>
          ) : null}
        </div>

        <ul className="space-y-1.5 text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
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
      </div>
      </Card>
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
        <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
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
      <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
        Stripe wire-up shipping shortly.
      </p>
    </div>
  );
}
