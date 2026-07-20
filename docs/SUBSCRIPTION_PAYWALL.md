# Subscription paywall — spec

**Model:** the app is usable without paying, but **the tools + creation surfaces are a $3.99/mo subscription** ("Support the Mainframe"). Never use the word "free" in user-facing copy — frame it as *support + unlock*.

**Subscriber = an active `pro_monthly` Stripe subscription.** `isProUser(userId)` returns true only for active subscribers once `BILLING_ENFORCED` is on. Everything below gates on `isProUser`.

---

## The boundary

### Usable WITHOUT a subscription (the hook — get people in + populating data)
- Create **projects & sub-projects**, track progress
- **Search & browse** the paint library
- **Add paints to projects**
- **Add paints to recipes** + keep/view recipe records (basic — see Recipes call below)
- **Collection tracking**, including the **URL auto-populate** (paste a store link → scrape → collection)
- **Gallery browse** (public/SEO) + **sharing your own cards** *(call — see below)*

### Subscription-gated ($3.99/mo)
- **All Tools** — Colour Wheel, Match, Dropper, Stacking, **Paint Scanner** (all `/tools/*`)
- The library **slide-out paint panel's** power features (matching, colour science, tool hand-offs)
- The **recipe creator's** power features — AI generation, colour matching, layering/glaze prediction, technique tooling, send-from-tools
- **AI** — AI recipe generation, army-list import

### Calls made (Ross may veto either)
- **Recipes:** free users can add paints to a recipe + view it; the creator's *power features* (AI, matching, layering, techniques) are subscriber-only.
- **Gallery/sharing:** browse is free (must be — public + SEO); **submitting/sharing your own cards is also free** — it's the loop that recruits subscribers; gating your own marketing costs more than it makes. Flip to gated only if Ross says so.

---

## The non-subscriber paint side-panel (library)
When a non-subscriber clicks a paint, the panel opens but the power section is **hidden** (not greyed — greying a wall of dead controls reads as broken). Show:
- **Identity (read-only):** swatch, name, brand, type, hex
- **Four live actions:** **Add to Project · Add to Recipe · Wishlist · Owned**
- **In place of the tools/matching section:** one tidy card — `🔒 Subscribe to unlock a range of tools →` (hyperlink → checkout)

## The gate popup (reusable modal)
Any non-subscriber who taps a gated tool / feature gets:
> **Subscribe to unlock the tools**
> *Support the Mainframe and unlock a whole range of useful tools — tracking, managing, and painting your minis has never been easier.*
> **[ Subscribe · $3.99/mo → ]** (→ Stripe checkout)

Same component used at every gate point (tool routes, recipe-creator power features, AI, panel card).

---

## Build phases (§DO)

**Phase A — Subscriber plumbing.**
- Wire the dormant Stripe **monthly** checkout (`/api/billing/checkout` for `pro_monthly`), passing `client_reference_id = userId`. The webhook (`/api/billing/webhook`) must set `plan = pro_monthly` on `checkout.session.completed` and drop to free on `customer.subscription.deleted`/`updated`-inactive. Add **webhook idempotency** (persist processed `event.id`, unique constraint, no-op replays).
- Flip `BILLING_ENFORCED = true` **but decouple**: only the gated set below should check `isProUser`. Audit the existing `isProUser` gates (`aiRecipe`, `imports`, `palettes`, `recipeSharing`, `sendToRecipe`, project cap) and **remove the gate from anything that must stay free** (project cap, recipe-sharing per the gallery call) so flipping the switch doesn't wall the base app.
- **Drop the lifetime/founder tiers** from the offering (monthly only). Leave the code paths dormant; just don't surface or sell them.

**Phase B — The gate UI.**
- Reusable **`SubscribeGateDialog`** (kit primitives, terminal aesthetic) with the copy above, hyperlinked to checkout.
- **`useSubscriber()`** hook / server helper so client components know subscriber status.

**Phase C — Apply the gates.**
- **`/tools/*`** (wheel, match, dropper, stacking, scan): subscriber-only. Non-subscribers hitting a tool page get the gate (and the Tools-hub cards show a 🔒). Server actions behind the tools (`palettes`, `sendToRecipe`, `scanPaintsFromPhoto`, AI recipe, imports) reject non-subscribers server-side too (defence in depth — never trust the client gate).
- **Library paint panel:** hide the power section for non-subscribers, show the 4 actions + subscribe card (above).
- **Recipe creator:** gate the power features (AI, matching, layering, techniques) behind the dialog; keep add-paint + view free.
- **AI + Paint Scanner:** gate on `isProUser` (add the gate to `scanPaintsFromPhoto` — it has none yet).

**Phase D — Copy.**
- **Strip every "free"** from the landing + pricing pages. Landing "Everything, free" → the support/tools framing. Pricing page (currently the support page) → a **"Support the Mainframe — $3.99/mo"** section listing what it unlocks (all tools, Paint Scanner, AI, the full recipe creator, the paint panel), keeping the Beacon Hobbies link and the existing donation link as a separate "one-off tip" option.

**Gate before each commit:** `npm run typecheck` (0) · `npm run lint` (0 errors) · `npm run test:unit` · `npm run test:integration`; `npm run build` at the end. Cover the new gate logic with tests (subscriber vs non-subscriber). Commit per logical chunk. Work on the branch; do NOT touch `main` — a human reviews + merges.

## NEEDS-ROSS
- **Create one `$3.99/mo` recurring price in Stripe** and set `STRIPE_PRICE_PRO_MONTHLY` (+ confirm the webhook secret is set — Stripe is already live in prod).
- Confirm (or veto) the two calls: **recipes line** and **gallery sharing free**.
