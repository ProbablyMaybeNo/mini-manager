# The Mini Mainframe — Monetization Model

> Status: **PROPOSAL — lock before wiring Stripe.** Date: 2026-06-23.
> This is the single source of truth for the Free/Pro split, the pricing card,
> and the "launching for free" mechanic. It doubles as (a) the implementation
> contract for the gating layer and (b) the copy source for the `/pricing` page
> and the landing page.

---

## The thesis

We do **not** monetize features. We monetize **habit, automation, ubiquity, and
insight**. Every gating decision below resolves to one of four levers:

| Lever | Free gets… | Pro gets… |
|---|---|---|
| **Manual → Automatic** | do it by hand (paste a URL) | one click (browser extension) |
| **View → Save** | use a tool, see the result | save / apply / persist the result |
| **Timer → Insight** | the live tool (focus timer) | the accumulating data (history, streaks, analytics) |
| **Here → Everywhere** | full app, online | offline + native desktop integration |

**Design rule:** Free must be a *complete, genuinely useful* hobby tracker — it
has to beat the free competitors on breadth (paint **and** model **and** project
**and** list, in one place). Pro is the layer that turns a tracker into a
**daily companion** — the stuff an active hobbyist bumps into every session.

**Honesty note (architecture):** the app stores every user's data in a
server-side per-account database, so **multi-device access is inherent and
free** — we will *not* cripple it to sell "sync." The genuine "everywhere" Pro
lever is **offline access + native PWA capabilities**, not basic cloud sync.

---

## Feature-by-feature gating matrix

Legend: ✅ Free · ⭐ Pro · 🔁 Free (manual) / Pro (automatic)

| Feature | Free | Pro | Lever |
|---|---|---|---|
| **Projects** — army/warband/unit/model/terrain tree, sub-projects, status, progress, notes, target date, reference image | ✅ unlimited | — | core habitual tracker stays free (wins acquisition) |
| **Collection** — paints + models, owned/levels, organize | ✅ unlimited | — | core tracker |
| **Wishlist** | ✅ unlimited | — | core tracker |
| **Library** — browse the full paint catalog, assign to projects | ✅ | — | core |
| **Add to collection from a website** | 🔁 manual: open app, paste URL | ⭐ **one-click browser extension** while browsing | Manual → Automatic |
| **Colour Match tool** | ✅ full use | — | the free hook; commodity feature rivals give away |
| **Wheel / Dropper / Layering tools** | ✅ use to explore (view-only) | ⭐ **save / apply** results + advanced depth (persisted palettes, cross-brand depth, layering planner) | View → Save |
| **Recipes** | ✅ build by hand, **1 per project node**, view | ⭐ **unlimited per node**, save tool results into recipes | View → Save |
| **AI Recipe Creator** | — | ⭐ **metered** (monthly credit allowance) | differentiated delight; variable-cost → metered |
| **Recipe sharing / publish to public gallery** | ✅ *browse* the gallery | ⭐ **publish / share** your own | View → Save |
| **Focus bench — timer + basic session log** | ✅ | — | build the habit; this is the engagement loop |
| **Focus Insight** — history, streaks, time-per-project, weekly goals, analytics | — | ⭐ | **Timer → Insight** (headline Pro delight) |
| **Army-list import / parser** (paste or file → project tree) | — | ⭐ | variable-cost (LLM) → Pro; also protects margin |
| **Multi-device access** | ✅ inherent (cloud account) | — | not sold (honest) |
| **Offline access + native desktop integration** (share-target, file-handlers, app shortcuts, full offline cache) | — | ⭐ | Here → Everywhere |
| **Data export + account deletion** | ✅ | — | legal / trust — never gated |

### Why this converts (and the old split didn't)
The previous split gave away the **occasional** stuff's opposite: it locked
*occasional* features (import, extra recipes) and freed *everything habitual*.
This matrix flips it — the features a hobbyist touches **every single session**
(automatic capture, saved palettes, focus insight, AI schemes) are the wall,
while the manual version of each stays free so the app is never crippled. You
bump into Pro constantly without ever being *blocked* from tracking your hobby.

---

## Pricing card

> Numbers below are the **proposal to lock**. They supersede both the current
> `PLAN_PRICE` ($4 / $36 / $26) and the fixtures ($3.99 / $25 / $19) — pick these
> and reconcile both code sites when wiring Stripe (rides with PR #56).

### Tiers

| Tier | Price | Notes |
|---|---|---|
| **Free** | $0 | The complete manual hobby tracker. No card, no time limit. |
| **Pro — Monthly** | **$3.99 / mo** | Entry / try-it. Includes monthly AI allowance. |
| **Pro — Annual** ⭐ *best value* | **$24.99 / yr** | **The hero tier.** ≈ $2/mo. Push this. |
| **Pro — Lifetime** | **$34.99 once** | One-time unlock. Includes the same **monthly AI allowance** (metered, so cost stays bounded — AI is never "unlimited forever"). |
| **Founder** | **$19 once** | Lifetime + founder badge + About-page listing. **100 seats, time-boxed to launch.** |

**AI credits:** every paid tier includes **N AI recipe generations / month**
(N TBD — set so a typical hobbyist rarely hits it, e.g. 20–30). Because AI is
**metered on every tier including Lifetime**, the per-user marginal cost is
bounded no matter how someone pays. Optional credit refills can come later.

### Pricing-card copy (for `/pricing` + landing)

- **Free** — *"Track your whole hobby — armies, paints, projects, and recipes —
  free, forever-usable, no card required."*
- **Pro** — *"Make it a daily companion: one-click web capture, AI paint
  schemes, saved palettes, focus stats, and offline access."*
- **Founder** — *"Back the build. Lifetime Pro + a founder badge, for the first
  100 painters."*

---

## "Launching for free" mechanic

We launch with **Pro features open to everyone, free**, framed as a **time-boxed
early-access offer** — never "free forever." This lets us tune the Free/Pro line
post-launch without walking back a promise.

### How it works in code
- **`BILLING_ENFORCED = false`** (already the case) — caps/gates don't bite yet.
- **New `LAUNCH_FREE` flag** — when `true`, every Pro-gated surface renders the
  feature **enabled**, wrapped in an **"✦ Free during early access — founder
  pricing"** ribbon (not a wall). Upgrade prompts read *"free during launch,"*
  **never** *"free forever."*
- Early-access + Founder users are **grandfathered** per the offer when we flip.

### The flip (post-launch, when Stripe is live)
`BILLING_ENFORCED = true` **+** `LAUNCH_FREE = false` → gates activate. Everyone
was told it was a launch promo, so nothing is taken back.

---

## Implementation contract (maps each gate to a code chokepoint)

| Gate | Where it lives |
|---|---|
| Plan resolution | `src/lib/billing/plans.ts` (`getPlanForUser`, add `PlanTier: pro_annual`) |
| **NEW** feature gates | `src/lib/billing/` — `ProFeature` enum + `requirePro(userId, feature)` |
| Count cap (per-node recipe) | `src/lib/billing/enforce.ts` (`enforceCreateLimit`) — keep |
| Soft-gate response | `ActionResult.upgradeUrl` (exists) + new `proRequired` flavor |
| Extension capture | extension add endpoints (already Pro-gated #57/#60) — verify |
| Tool save/apply | the Match/Wheel/Dropper/Layering "apply" actions |
| Army parser | `createTextImport` / `createFileImport` — **gate the parse** (current gap) |
| AI recipe + metering | `src/app/api/recipe/ai` + `src/lib/ai/*` — **add credit meter + cheaper-model abstraction** |
| Focus Insight | **new** query + dashboard over the existing session/duration data |
| Offline / native | service worker (`src/lib/sw/*`) + manifest (`public/manifest.webmanifest`) |
| `LAUNCH_FREE` ribbon | new flag in `plans.ts` + a `<ProGate>` UI wrapper |
| Pricing tiers + prices | `plans.ts` (`PLAN_LIMITS`, `PLAN_PRICE`) + Stripe `STRIPE_PRICE_*` envs |

---

## Open decisions to lock
1. **Final prices** — confirm $3.99 / $24.99 / $34.99 / $19 (or adjust).
2. **AI allowance N** per month per tier.
3. **Founder seat count** (100) + window length.
4. **Annual exact price** — $24.99 vs $29.99.
5. Whether **Wheel/Dropper** are "view-only free" or fully free with only *save*
   gated (recommend: usable free, save/apply gated — keeps acquisition strong).
