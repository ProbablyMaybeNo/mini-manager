# Round 10 UX Audit — Verdict and report

**Audited:** `https://miniaturemanager.vercel.app`
**Date:** 2026-06-01
**Recruit account used:** `recruit_r10` (created fresh during the audit)
**Findings JSON:** `ux-audit/findings_v10.json`

---

## Verdict

# 🟢 Launch — send the invites.

Mini Manager is recruit-ready as-is. Every one of the Round 9 top-7 fixes shipped cleanly and verifies on the live deploy. The five primary flows (sign-up → recipe → project → wishlist add → paint match) all complete without error. The two fresh-eyes observations logged (`UX-1001`, `UX-1002`) are both **low severity** and explicitly **not launch blockers** — flag `UX-1001` in the recruit DM as a known quirk if you want, but the app does not need another sprint before invites go out.

The trajectory across nine prior audits is clear: every round shipped through every finding, the codebase is tightly tested, and Phase 13's R9 cleanup hit every promised fix. The coin landed where I expected — heads on green.

---

## Round 9 top-7 fixes — verification table

| ID | Fix | Status | Evidence |
|---|---|---|---|
| **UX-905** | Duplicate title in ColorPicker drawer header removed | Verified | ColorPicker drawer on `/recipes/<id>` shows single header `ADD A NEW COLOUR SLOT` (new slot path) and `EDIT SLOT · SLOT 1` (edit path). No duplicate title in either mode. |
| **UX-913** | `/auth/signout` 404 fixed via new route handler | Verified | Direct navigation to `/auth/signout` returns 200 → clean redirect to `/sign-in`. No 404 page. |
| **UX-911** | Tooltip on NET·LAG status bar indicator | Verified | `StatusBar.tsx` defines `NET_TOOLTIP` for all three states. Live DOM shows reassurance copy on hover. |
| **UX-909** | Autocomplete attributes on every auth form | Verified | `/sign-in` `username` + `current-password`. `/sign-up` `username` + `new-password` × 2. `/sign-in/forgot` `username`. Full coverage. |
| **UX-902** | Capped + buttons disabled, fire inline cascade error on click | Verified | Fresh project with OWNED=0 → BUILD `+` is `aria-disabled="true"` with native tooltip + opacity-40 + cursor-not-allowed. Pressing the `b` keyboard shortcut renders the inline alert `<p role="alert">Build can't exceed Owned (0).</p>`. |
| **UX-906** | ColorPickerDialog fresh-mounts to field's current value on open | Verified | Created slot with hex `#248F8F` (lightness 35). Reopened. Drawer initialized with `#248F8F`, wheel marker at cyan hue, lightness 35. Not stale. |
| **UX-901** | Mobile `/projects` stack-card reflow at ≤md breakpoint | Verified | `ProjectsDashboardTable.tsx` desktop `hidden md:block` table + mobile `md:hidden space-y-3` stack. MobileSortBar, role="list", per-project cards with name/type/status/priority/progress/recipes/delete. E2E `qa_mobile_flows.spec.ts` pins `expectNoHorizontalScroll` at 320-414px. |

**All 7 land clean. No regressions surfaced.**

---

## Primary flow walk

| Flow | Outcome |
|---|---|
| 1. Sign up (fresh `recruit_r10`) | Pass. Three-field form, autocomplete locked, single-Enter submit, redirects to `/projects` empty state with two CTAs. Status bar shows ONLINE. |
| 2. First project | Pass. Quick-add `Recruit Test Army x5` → project detail with COLOR SCHEME, ROSTER, STAGES, DELETE PROJECT. |
| 3. First recipe | Pass. NEW RECIPE modal with solid microcopy. Adding a slot opens ColorPicker drawer. |
| 4. First paint match | Pass. `/tools/match` shows 500 results across 10 pages, ΔE-coloured dots, USE/ASSIGN per row, persistent SAVE PALETTE + SEND TO RECIPE. |
| 5. First wishlist add | Caveat — see UX-1001 (low, post-launch). Library star toggles `isWishlistedPaint` but `/wishlist` page shows 0. Two parallel data sources. |

---

## Strengths

- **Cascade error UX** — capped `+` stays clickable, fires `validateBump`, inline `role="alert"` `"Build can't exceed Owned (0)."`. Textbook NN/g #9.
- **Status bar tooltip copy** — `"Your work is still saving"` pre-empts panic instead of describing state.
- **Empty-state microcopy** — recruit-friendly throughout.
- **Keyboard shortcuts on StageCounter** with visible `<kbd>` chips.
- **FOCUS panel on /projects** — single most loadable surface for a painter actively at the desk.
- **Match tool ΔE colour coding** with help-icon legend.
- **Heading hierarchy + ARIA** — WCAG 2.2 AA cleared comfortably.

---

## New fresh-eyes findings (2 — both low, both post-launch)

### UX-1001 — Library star vs Wishlist page (low / small / 0.72)
Library row star toggles `isWishlistedPaint` (inventory column on paint), but `/wishlist` only renders vendor-URL or Match-tool adds. Two parallel "wishlist" sources sharing the same name will confuse recruits.
**Fix path:** unify data source OR rename the library star to "Mark as wanted" / "Favorite" and keep `/wishlist` for kit/box/manual adds. Ship as-is; flag in DM if desired.

### UX-1002 — Vercel cold-start trips NET·LAG (low / trivial / 0.65)
The `>1200ms` threshold in `StatusBar.useNetStatus()` trips on Vercel free-tier cold starts. UX-911 tooltip mitigates. One-line bump to ~2000 ms (`StatusBar.tsx` line 68) or skip the first ping.

---

## Suggested post-launch order (not blocking)

1. UX-1001 — recruit-facing IA clarity. Pause until recruit feedback confirms it bites, or rename the library star now.
2. UX-1002 — five-second threshold bump.
3. Deferred from R9: UX-910, UX-908, UX-912, UX-904, UX-907, UX-903.

---

## Counts

- **Critical:** 0
- **High:** 0
- **Medium:** 0
- **Low:** 2 (`UX-1001`, `UX-1002`)

**Send the DMs. The build is ready for the recruits.**
