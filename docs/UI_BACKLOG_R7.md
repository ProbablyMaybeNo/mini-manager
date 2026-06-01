# UI Builder Backlog — Round 7

Ross's feedback batch on 2026-06-01 after the Phase 12 deploy. Surgical surface fixes already shipped in commit `b9e1713` (PAINT/HIGH labels, paint-detail button colors, ViewModeToggle terminal-button style, wishlist column overflow, NEW PROJECT + IMPORT ARMY LIST sized down). This file is the heavier remainder.

Reference: Terminal_UI dashboard — INIT / SAVE / PAUSE / KILL buttons. Small, bold mono-caps, bordered with colored text OR filled with dark text. The size + density Ross wants app-wide.

## Items in scope

- [ ] **R7-1 — Project table inline editing.** `/projects` table currently lets the user navigate to a project to edit its info. Ross wants direct table-cell editing:
  - **Status cell** → click opens a dropdown with the 8 derived statuses (WISHLIST / PURCHASED / BUILDING / PRIMING / PAINTING / BASING / COMPLETE / SHELVED). Picking one updates the project's lead-stage equivalent. **However:** statuses are DERIVED from stage counts, not stored. To support inline status change, either (a) expose stage bump shortcuts ("Bump to PAINTING" = ensure paintCount ≥ 1), or (b) add a `manual_status_override` column with a clear-override action. Option (a) is cleaner — propose this and ship if approved.
  - **Type cell** → click opens a dropdown with the 6 project types (Army / Warband / Unit / Single Model / Terrain Piece / Diorama). Updates `project.type` via `updateProject` server action.
  - **Recipe cell** → click navigates to the attached recipe's editor if attached; otherwise opens an "Attach recipe" picker (reuse the existing AttachRecipeModal flow). Don't open a recipe creator side panel from the dashboard — that's the project-detail color-scheme box's job.
  - **Priority cell** → click opens a dropdown with the 4 priorities (Urgent / High / Medium / Low) + Clear.
  - Reuse the popover pattern from the Wishlist `StatusChangePopover` for consistency.

- [ ] **R7-2 — App-wide small-button sweep.** Cross-cutting size discipline. Every `<Button size="md">` and `<Button size="lg">` audited and demoted to `sm` UNLESS it's:
  - The single primary auth-page CTA (Sign in, Create account)
  - The "RUN" / "AUTHENTICATE" / "Save recipe" big primary actions on a hero surface
  - The Save button on the Recipe header (deliberately prominent)

  Default elsewhere → `size="sm"`. Match the terminal_ui INIT/SAVE button proportions: ~28-32px tall, px-3-4, bold mono caps. Search all `<Button ... size=` usages and reclassify.

- [ ] **R7-3 — ColorPicker brightness/lightness slider.** The mini color wheel in the ColorPicker primitive currently lets the user pick hue + saturation but not lightness. Ross wants the ability to pick darker colors. Add a vertical or horizontal lightness slider (range 0-100) below the wheel + harmony dropdown. Output hex updates as the slider moves. The harmony swatches also re-render at the new lightness.

- [ ] **R7-4 — Tools color assignment UX (Match + Layering).** Both tools currently render a fixed color palette but the user can't TELL them what color to start from. Fix:
  - **Match tool:** add a "Start with..." input row at the top with three options (matching the ColorPicker side panel sub-panels). User picks a hex via mini wheel OR types/pastes a hex OR picks from library. The Match results regenerate against that hex.
  - **Layering tool:** same pattern. User picks a base color → tool computes shadow / mid / highlight variants → each variant lists matching paints filtered by company.
  - Reuse the existing `<ColorPicker>` primitive's library-filterable list + hex-input sub-panels.

- [ ] **R7-5 — Library top-right "random filter button" verification.** Ross reports a "random filter button that does nothing" in the top-right of `/library`. Locate the actual element:
  - Investigate whether the `md:hidden fixed top-14 right-3` mobile filter trigger is leaking onto Ross's viewport (his viewport may be < 768px wide, OR the md breakpoint isn't applying).
  - If leaking: add a more aggressive `xl:hidden` or restructure into a proper desktop-aware control.
  - If something else: remove it.
  - Add a Playwright check that on a 1440px viewport, no element with text matching `/^Filters?$/i` exists outside the FilterRail header (which has its own collapse toggle).

- [ ] **R7-6 — Surface check on app-wide button discipline.** After R7-2 sweep, audit each top-level page for cyan buttons that survived the Phase 12 P12.24 pass. Cyan is banned from buttons. Common offenders to grep: `bg-[var(--color-cyan)]`, `btn-primary` consumers, ad-hoc `text-cyan` buttons. Flip each to the right semantic (green/yellow/red/purple).

- [ ] **R7-7 — Recipes page button sweep.** Ross approved the recipe redesign but flagged "buttons should be smaller and look more like the UI example image buttons." Audit `/recipes` + `/recipes/[id]` + the new recipe-action bar. Apply R7-2 sweep treatment to every button on the recipe surfaces. The `Save` + `Assign to project` buttons stay prominent (size sm but visually loud via their tone).

## Out of scope

- The launch-readiness items (Lighthouse, credential rotation, recruit DMs, Stripe) — Billy is handling those in parallel.
- Schema changes — Ross's brief in P12 didn't ask for any beyond what already shipped.

## Conventions

- Standard ui-builder loop (see `~/.claude/agents/ui-builder.md`).
- One commit per item where practical. R7-2 + R7-6 may need 2-3 commits split by surface area.
- Tests INTO feature commit. No orphans.
- `npm test` must stay green (baseline: 961 passed / 1 skipped).
- Typecheck clean before every commit.
- Use existing primitives. No new tokens or primitives without flagging.
- Local commit only — Billy merges + pushes.
