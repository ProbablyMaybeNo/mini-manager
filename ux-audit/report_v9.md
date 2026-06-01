# Mini Manager — Round 9 UX Audit Report

**Target:** https://miniaturemanager.vercel.app (Phase 13, live)
**Auditor:** Claude Opus 4.7 (1M context)
**Date:** 2026-06-01
**Session:** Fresh recruit account `recruit_r9` created and driven through 5 primary flows
**Tooling:** claude-in-chrome browser automation

---

## VERDICT: 🟡 Launch with caveats

**Send the invites — but flag these in the recruit DM:**

1. Don't try to manage projects on a phone in landscape — the projects table doesn't reflow yet (UX-901). The leaf workspace itself is mobile-friendly, only the index table needs work.
2. If you press `b` (build) on a brand-new project and nothing happens, check OWNED — you need to add models to the desk before you can build them (UX-902).
3. If you see a generic "this page couldn't load" screen during recipe-assign, reload and try again (UX-903 — intermittent, recovered both times in this audit).

**The headline P13.11 focus widget verification passed end-to-end in production.** Account → recipe → project → set focus → edit per-step notes → reload — every step persisted. The widget is exactly what was described in the requirements and reads as genuinely useful for "follow along while painting." Phase 13 trajectory is clear: the app crossed a threshold from "tool" to "companion."

13 findings total: **0 critical · 2 high · 5 medium · 6 low**. The 2 high findings are scoped — UX-901 (mobile reflow on one specific table) and UX-902 (silent disabled state on one specific control row). Neither blocks a recruit's first session; both will frustrate the recruit's second session.

**Top-3 highest-leverage fixes (Friday afternoon work):**
1. **UX-905 (trivial)** — Remove the duplicated title in the ColorPicker drawer header.
2. **UX-902 (small)** — Disable + buttons that are capped, and surface the same red inline error pattern that already works for Paint/Prime.
3. **UX-913 (trivial)** — Either redirect or implement `/auth/signout`.

---

## Strengths — what the app does well

- **The FOCUS section on /projects is genuinely lovely.** Big slot tiles, per-step note textareas, clear PAINTING NOW label, "2 SLOTS · 2 STEPS" meta in the corner. Focus selection + per-step notes both persisted across full page reload. (P13.11 ✓)
- **Sign-up flow is delightful.** Live username availability check, progressive disclosure of CONFIRM PASSWORD, disabled CREATE ACCOUNT until form valid, CHECKING… and CREATING… in-flight states.
- **Quick-add project parsing.** Typing "Necron Warriors x20" into /projects quick-add correctly extracted title, type (UNIT), and count (20 models).
- **Recipe empty states are friendly, not nagging.** The NEW RECIPE placeholder `Skin · gold trim · battle dust` and the helper text "Naming up front keeps the recipe library scannable — six 'Untitled recipe' rows piles up fast." That's a designer-painter speaking.
- **Delete project confirmation (P13.3) is best-in-class.** Red header, accurate cascade context, body copy that explains what's preserved (attached recipes stay in library), DELETE FOREVER red CTA. Polaris-grade.
- **Optimistic UI on stage bumps (P13.5) feels instant.** Sub-100ms click-to-feedback. Bonus: keyboard shortcuts (b/p/a/s/c) work and are documented.
- **Match brand filter (P13.7) — clean 3-column solid-fill grid.** No wrap-jumble, every brand is tappable.
- **Wheel harmonies (P13.8) — clean stacked rows.** Each row has [swatch preview][name][description][N SWATCHES] — educational + functional.
- **MATCH column (P13.9)** ditched the ΔE jargon — labeled "MATCH" with a tooltip icon.
- **Solid-fill button primitive (P13.1) held everywhere I checked** — sign-in, sign-up, /user, /projects, project detail, /recipes, recipe detail, /tools, /tools/match, /tools/gradient, /tools/wheel, /library, /wishlist. Zero `[ ]` brackets on action buttons.
- **Workspace simplification (P13.2) feels right.** Leaf project = COLOR SCHEME → children block → ROSTER → STAGES → action footer. Clean and purposeful, not sparse.
- **Library is content-dense and respects the cross-brand promise.** 7,144 paints, semiotic type icons, hue chips, full BRAND list.
- **Accessibility wins observed:** painting-notes textarea has `aria-label="Painting notes for Slot 1 · step 1"`. Active sidebar item gets `aria-current="page"`. Drag-to-reorder hint is text, not icon-only.

---

## Findings by severity

### High (2)

#### UX-901 — Projects table doesn't reflow on mobile (≤414px)
- **Principle:** WCAG 2.2 §1.4.10 Reflow
- **Fix:** Swap to stacked-card layout at ≤768px. Or hide PRIORITY+COMPLETION columns on mobile and reveal on row tap.
- **Effort:** small · **Confidence:** 0.92

#### UX-902 — Silent failure when bumping STAGE before OWNED > 0
- **Principle:** NN/g Heuristic 5 (Error prevention) + Heuristic 1 (Status)
- **Fix:** Visually disable + buttons whose target value is currently capped (greyed-out, aria-disabled, cursor not-allowed) AND fire the same inline red error on capped attempts.
- **Effort:** small · **Confidence:** 0.95

### Medium (5)

#### UX-903 — Generic "This page couldn't load" on recipe-assign (intermittent)
- **Fix:** Soft toast error overlay with retry button instead of full-page error. Add server-side telemetry on the assign mutation.
- **Effort:** medium · **Confidence:** 0.55

#### UX-904 — Two different "attach recipe" flows produce different outcomes
- **Fix:** Unify on a modal: "Pick from your library" + "Start new recipe" — surfaced from both + ATTACH and the COLOR SCHEME + tile.
- **Effort:** medium · **Confidence:** 0.88

#### UX-905 — Duplicate title in ColorPicker drawer header
- **Fix:** Remove the inner heading or repurpose as descriptive sub-label.
- **Effort:** trivial · **Confidence:** 0.96

#### UX-906 — ColorPicker drawer opens with stale color (not field's current value)
- **Fix:** Initialize wheel position, hex, and LIGHTNESS slider to the field's current value on drawer open.
- **Effort:** small · **Confidence:** 0.85

#### UX-907 — Multi-recipe per project not surfaced in FOCUS / leaf workspace
- **Fix:** Horizontal tab/segmented control above the slot grid when 2+ recipes attached; default to most recently used.
- **Effort:** medium · **Confidence:** 0.82

### Low (6)

#### UX-908 — Color picker LIBRARY matches include far-off paints
- **Fix:** Same MATCH score sort as standalone tool; show score next to each match; cap at ΔE threshold rather than padding to 50.
- **Effort:** small · **Confidence:** 0.78

#### UX-909 — Sign-up form likely missing `autocomplete=new-password`
- **Fix:** Add `autocomplete="new-password"` on /sign-up; `autocomplete="username"` on USERNAME; `autocomplete="current-password"` on /sign-in.
- **Effort:** trivial · **Confidence:** 0.7

#### UX-910 — Library paint names truncate aggressively on mobile
- **Fix:** Give NAME ~1.5× the width of BRAND on mobile.
- **Effort:** trivial · **Confidence:** 0.7

#### UX-911 — "NET · LAG" indicator lacks tooltip
- **Fix:** Add tooltip "Server's responding slower than usual. Your work is still saving." Optionally only show LAG if >1500ms.
- **Effort:** trivial · **Confidence:** 0.75

#### UX-912 — Slot swatch tint may not match labeled hex
- **Fix:** Render swatch from same hex the label shows.
- **Effort:** trivial · **Confidence:** 0.55

#### UX-913 — `/auth/signout` returns 404
- **Fix:** Redirect /auth/signout to /user OR implement as a real signout endpoint.
- **Effort:** trivial · **Confidence:** 0.92

---

## Suggested implementation order

Optimize for severity ÷ effort.

1. UX-905 (trivial, medium) — Remove duplicate drawer title
2. UX-913 (trivial, low) — Fix /auth/signout 404
3. UX-911 (trivial, low) — Tooltip on NET LAG
4. UX-909 (trivial, low) — Autocomplete attributes on sign-up/sign-in
5. UX-902 (small, high) — Disable capped + buttons + fire inline error
6. UX-906 (small, medium) — Initialize ColorPicker drawer to field's current value
7. UX-901 (small, high) — Stack-card layout for /projects table on mobile
8. UX-910 (trivial, low) — Re-proportion /library columns on mobile
9. UX-908 (small, low) — Sort LIBRARY matches by score in ColorPicker drawer
10. UX-912 (trivial, low) — Verify slot swatch tint matches labeled hex
11. UX-904 (medium, medium) — Unified attach-recipe modal
12. UX-907 (medium, medium) — Multi-recipe tab control on FOCUS / leaf workspace
13. UX-903 (medium, medium) — Server telemetry on assign mutation + soft toast retry

After items 1–7, Mini Manager is **🟢 unambiguously launch-ready** for the r/minipainting recruit cohort. Items 8–13 are post-launch quality-of-life that recruit feedback will help prioritize.

---

## Final note

The Phase 13 trajectory is clear and the call lands heads-up. Ross has shipped a paint-companion that actually feels designed for painters — not engineered for paint-tracking. The COLOR SCHEME · NECRON WARRIOR BONE on the leaf workspace, the PAINTING NOW header on the FOCUS panel, the placeholder text on the recipe-name field — these are the touches that make a recruit close the tab less. The headline P13.11 works end-to-end in production. The remaining work is friction-trimming, not foundation-laying. Send the invites with the three caveats above; ship the fixes during the recruit-feedback window.
