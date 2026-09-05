# Subscription paywall — spec

> **REVISED 2026-09-05 (Ross).** The paid line moved. It used to run around
> "the tools + creation surfaces"; it now runs around **cost to serve** — only
> features that spend money on every use are gated. Everything else, including
> all four colour tools, is free. Two consequences worth stating plainly:
> the "never say free" rule below is **reversed** — the app *is* free now and
> the copy says so, because that is the strongest thing we can say about it;
> and the gated set shrank from most of the app to three AI features.
> Sections below are updated in place; the pre-revision boundary is in git.

**Model:** the app is free. **The three features that run on AI are a $3.99/mo sponsorship** ("Sponsor the Mainframe") because each one spends real tokens per use. Terminology (locked, revised on review): the word is **"Sponsor"** everywhere in paywall/gate/pricing copy — never "Subscribe", "Support", or "Donate". Internal code/plan names (`pro_monthly`, `isProUser`, etc.) are unaffected.

**Subscriber = an active `pro_monthly` Stripe subscription.** `isProUser(userId)` returns true only for active subscribers once `BILLING_ENFORCED` is on. Everything below gates on `isProUser`.

---

## The boundary

### Free (i.e. everything that costs nothing to run)
- Create **projects & sub-projects**, track progress
- **Search & browse** the paint library
- **Add paints to projects**
- **Add paints to recipes** + keep/view recipe records (basic — see Recipes call below)
- **Collection tracking**, including the **URL auto-populate** (paste a store link → scrape → collection)
- **Gallery browse** (public/SEO) + **sharing your own cards** *(call — see below)*
- **The colour tools** — Wheel, Match, Dropper, Stacking (`/tools/*` except `scan`). Client-side colour maths; charging for it was charging for arithmetic.
- The library **slide-out paint panel's** colour science — harmonies, cross-brand matching, tool hand-offs
- The **recipe creator's tool tabs** — Match, Dropper, Layering, and the wheel inside the Library tab
- **Save Palette** and **Send-to-Recipe** — plain DB writes

### Subscription-gated ($3.99/mo) — and ONLY these
Every entry spends LLM/vision tokens per use. If a feature does not cost money to serve, it does not belong on this list.
- **AI recipe generation** — `aiRecipe.ts`, `api/recipe/ai/route.ts`
- **Paint Scanner** — `paintScan.ts`; the `/tools/scan` page (`ToolShell requiresPro`) and the Collection "Scan paints" button
- **Army-list import** — `imports.ts` (parse gates *before* `parseWithLlm`, so a free user never spends a token)

### Calls made (Ross may veto either)
- **Recipes:** free users can add paints to a recipe + view it; the creator's *power features* (AI, matching, layering, techniques) are subscriber-only.
- **Gallery/sharing:** browse is free (must be — public + SEO); **submitting/sharing your own cards is also free** — it's the loop that recruits subscribers; gating your own marketing costs more than it makes. Flip to gated only if Ross says so.

---

## The non-subscriber paint side-panel (library)
**Superseded 2026-09-05 — there is no longer a non-subscriber variant.** The panel's colour science (harmonies, cross-brand matching, tool hand-offs) is pure maths and now renders for everyone; the hidden power section and its unlock card are gone. The reasoning that produced the *hidden, not greyed* rule still stands wherever a gate does remain.

## The gate popup (reusable modal)
Any non-subscriber who taps a gated tool / feature gets `SubscribeGateDialog` — copy revised on review (shipped version, supersedes the original draft above the fold):
> **Sponsor the Mainframe →** (the headline IS the checkout link, not a separate button)
> The app and every colour tool are free. This one runs on AI, which costs real money each time — sponsoring covers it.

The dialog now appears at three gate points only: AI recipe generation, army-list import, and the Paint Scanner (both entry points).

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
- **Strip every "free"** from the landing + pricing pages. Landing "Everything, free" → the sponsor/tools framing. Pricing page (currently the support page) → a **"Sponsor the Mainframe — $3.99/mo"** section listing what it unlocks (all tools, Paint Scanner, AI, the full recipe creator, the paint panel), keeping the Beacon Hobbies link and the existing donation link as a separate "one-off tip" option.

**Gate before each commit:** `npm run typecheck` (0) · `npm run lint` (0 errors) · `npm run test:unit` · `npm run test:integration`; `npm run build` at the end. Cover the new gate logic with tests (subscriber vs non-subscriber). Commit per logical chunk. Work on the branch; do NOT touch `main` — a human reviews + merges.

## NEEDS-ROSS
- **Create one `$3.99/mo` recurring price in Stripe** and set `STRIPE_PRICE_PRO_MONTHLY` (+ confirm the webhook secret is set — Stripe is already live in prod).
- Confirm (or veto) the two calls: **recipes line** and **gallery sharing free**.
