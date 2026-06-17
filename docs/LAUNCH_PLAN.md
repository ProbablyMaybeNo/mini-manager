# Mini Manager — Launch Plan (consolidated)

**Updated:** 2026-06-17 · **Owner:** Ross + Claude · **Canonical branch:** `main` (`230ba9f`, PR #20 "Redesign
integration #15–#19"). This is the single source of truth for what's left to launch.

> ⚠️ **Branch correction (2026-06-17):** the active build is **`main`**, advanced by PRs #14–#20 after the
> mid-rebuild crash. `feat/ui-port` is an **orphaned branch, 44 commits behind main** — ignore it and the
> earlier audit/plan written against it. `main` already has the full new UI, wired mutations, the colour
> tools, two-table collection, sub-projects, events, a `projects/[id]` detail page, and Stripe
> checkout+webhook routes. Production (`miniaturemanager.vercel.app`) deploys from `main`.

---

## Standing rules
1. **The new Figma UI is the app.** Components are the canonical design system; verified high-fidelity.
2. **`main` is live production** — it's also now the integration target (PRs #14–#20 merged here). Land new
   work via PRs/branches and merge on Ross's review, as the team has been doing.
3. **Strict TypeScript stays strict** — add guards, don't relax `tsconfig`.

## Current state (what's DONE on main)
- Full new UI across `/`, `/dashboard`, `/library`, `/recipes`(+`/recipes/[id]`), `/focus`, `/collection`,
  `/tools/*`, `/projects/[id]`, `/user`, public auth + `/pricing`.
- **Mutations wired** via client components → server actions (dashboard, library, recipes, focus, collection, user).
- **Colour tools built** — dropper (upload→k-means→match), match (CIEDE2000 + harmonies + assign-to-recipe
  dialog), wheel (draggable HSL + harmonies + closest paints), stacking/layering.
- **Two-table COLLECTION** (PAINT + MODEL, statuses, delete, URL link, stats bar), **sub-projects** tree
  (expand + inline add), **events** (+Date, calendar tags, ticker, tooltips).
- **Payments code present:** `api/billing/checkout/route.ts` + `api/billing/webhook/route.ts`; Stripe
  products + Vercel env vars set up by Ross (Payment Links chosen as the checkout path).
- **Vercel comment backlog:** per `docs/VERCEL_COMMENT_AUDIT.md` (Ross, code-accurate) — **98 threads:
  86 ADDRESSED, 9 PARTIAL, 3 PENDING.**

---

## 🔴 Remaining to launch

### L1 — Payments: verify & arm (was thought missing; code now exists)
- [ ] End-to-end test the existing `checkout` + `webhook` routes in Stripe **test mode** (signature verify,
      `checkout.session.completed` → plan/customer/sub IDs/expiry/founder bump; `subscription.updated/deleted` → re-stamp/lapse).
- [ ] Confirm **fulfillment** actually flips the user's plan in Turso after a real Payment-Link purchase
      (the open question from earlier — verify the webhook path, no silent gap).
- [ ] Confirm the new-UI upgrade buttons (`PricingView.onChoose`, `SettingsView.onUpgrade`) point at the
      live checkout (Payment Links).
- [ ] Flip `BILLING_ENFORCED = true` (`src/lib/billing/plans.ts:37`) once checkout+fulfillment verified;
      enforcement is already wired into create actions.
- [ ] Ensure Stripe vars documented in `.env.example`.

### L2 — Close the UX punch-list (the 9 PARTIAL + 3 PENDING from `VERCEL_COMMENT_AUDIT.md`)
PARTIAL (clear, actionable):
- [ ] **MM-52** roll out the green "+" button rule app-wide (built/`variant="add"` but only shown in `/gallery`;
      real `+ Recipe / + Add slot / + New Project / + Date / + Focus / + Add paint·model / + Add layer` still cyan). Wishlist `+` stays yellow.
- [ ] **MM-51 / MM-25** recipe-table "pick a paint" side panel — colour-picker exists, but extend to the full
      old recipe-creator scope (wheel + match + filterable library + dropper + layering).
- [ ] **MM-19** library wishlist button colour mismatch — `PaintListTable` uses `text-glow-cyan`; make it yellow.
- [ ] **MM-21** focus PROGRESS per-project time — bound to focus but `projectMinutes` prop never passed from the `/focus` page.
- [ ] **A5** log-time → **dashboard per-project time total** — stopwatch Log persists, but no dashboard section surfaces the totals.
- [ ] **S3l** project completion — reduce to the bare centred % number (and/or the requested stylistic treatment).
- [ ] **wwiR** apply the `text-display-shadow` utility to the stat numbers (defined, not applied) for the retro/outline look.
- [ ] **wyeW / 77YG** replace the native `<select>` project-assignment dropdown in collection with the styled element.
- [ ] **5smq** add the paint **Type** column (Contrast/Wash/Acrylic/…) to the PAINT table — the slot currently shows Recipe.

PENDING (vague — need Ross to point at the element/screenshot to resolve):
- [ ] `luPYg` recipe-detail "what to do with all this empty space?"
- [ ] `DJIASK` recipe-detail "more pixels, less blocky" graphic.
- [ ] `lq5h` collection "no idea what this is, remove it."

### L3 — Fresh UX / Figma-discrepancy audit (Ross's ask)
- [ ] Run a UX/UI audit pass on the **current production build** specifically for missing features +
      discrepancies vs the Figma designs (`docs/redesign-refs/*`, prototype `docs/figma-refs/*`). Feed
      findings back into L2 as a punch-list. **(Audit target decision pending — see below.)**

### L4 — QA & launch gates
- [ ] Runtime smoke on main: `db:seed` → `dev` → sign in `dev@local` → click through every page.
- [ ] Gates green on main: `tsc` · `eslint` · `vitest` · Playwright e2e · `next build` (mind the SW-stamp footgun).
- [ ] Virtualize/window the 7,144-paint library grid so it doesn't jank.
- [ ] Ross's page-by-page review on localhost (Vercel previews redirect to prod).
- [ ] Small style tweaks: apply sensible style-guide defaults (per Ross), confirm in the review pass.

---

## Housekeeping
- [ ] **Retire `feat/ui-port`** (orphaned, 44 behind). Re-home these docs onto `main`.
- [ ] Point the working clone `Antigravity/apps/mini-manager` at `main` (currently on `feat/ui-port`).
- [ ] `docs/VERCEL_FEEDBACK.md` is **superseded by `docs/VERCEL_COMMENT_AUDIT.md`** (code-accurate). Keep the
      latter as the comment system of record.

## Post-finish (after the website is done)
- [ ] **Re-think pricing** (Ross) — revisit tiers/prices once feature-complete; redo Stripe products + `/pricing`
      copy + `plans.ts` caps together.
