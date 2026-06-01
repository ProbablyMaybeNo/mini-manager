# R7 Critical Fixes (auditor verdict: NOT YET launch-ready)

Round 7 auditor returned with 30 findings, 3 critical. **UX-R7-003 is a phantom** — verified the code, `/tools/layering` doesn't exist anywhere; all Layering links go to `/tools/gradient` consistently. That leaves **2 real criticals** blocking the recruit launch.

This file is the post-ui-builder follow-up sweep. Wait for the in-flight ui-builder (a155e8d618dda3f3e) to finish R7-1 through R7-7 before working this list, so we don't collide on ColorPicker / recipe surfaces.

## Real criticals

- [x] **UX-R7-001 — Custom wheel "Use this colour" silently drops the selection.** → 5b13351
  - File: `src/components/ui/ColorPicker.tsx`
  - Reported: pick a hex on the wheel → click "Use this colour" → drawer closes but the recipe slot doesn't get the paint. Library row clicks DO persist; only the custom wheel hex is lost.
  - Fix: wire the wheel's "Use this colour" handler to call the same `onSelect` callback the library row click uses. The slot-add server action should accept `{ hex, paintId: null }` to record a custom hex with no paint ID — verify the action signature accepts this shape.
  - **The headline action of the Phase 12 rebuild.** Recruits will hit this first.

- [x] **UX-R7-002 — "EDIT SLOT" panel ambiguates "replace paint" vs "add step."** → 5b13351
  - Files: `src/components/recipes/ZoneList.tsx` + the ColorPicker side-panel mount point in RecipeEditorClient
  - Reported: instruction text says "Click a filled slot to swap its paint" — but in EDIT SLOT mode, clicking a library row APPENDS a step instead of swapping the slot's paint, leaving slot colour and step paint disjoint.
  - Fix: introduce a `mode: 'add-slot' | 'edit-slot'` prop on ColorPicker. When `edit-slot`, library-row click REPLACES the slot's first-step paint (mutates the existing step's paintId rather than inserting a new step row). When `add-slot`, library-row click adds a new slot. Add explicit "+ Add step" affordance in the Steps panel below for users who actually want to layer.

## High-severity follow-ups (ship same sprint)

These are NOT launch-blockers per the auditor but are "audit-ready recruit build" candidates:

- [x] **UX-R7-004** — `/tools/wheel?name=...` deep-link doesn't pre-seed the wheel. Switch to `?hex=` query param + read it in the WheelClient mount. → 4feb1c5
- [x] **UX-R7-005** — Form input borders at 1.4:1 fail WCAG 1.4.11. Lift `--color-border-input` (or wherever input borders resolve) to `#404040`. → 7381e07
- [x] **UX-R7-006** — Cyan resurfaced on 10+ buttons (ATTACH RECIPE / ASSIGN TO PROJECT / ADD NAMED MODEL / CHANGE PASSWORD / SAVE FILTER / USE CAMERA / FIND IN LIBRARY / SEND TO RECIPE). Phase-12 cyan-on-buttons ban regression. Sweep these to the right semantic (green for ADD/SAVE/ATTACH, yellow for SHARE, etc). → b54a620
- [x] **UX-R7-007** — Six "Untitled recipe" rows after three sessions. No name prompt on NEW RECIPE. Add a required-name prompt on creation OR auto-prompt to rename inline. → 18d87d5
- [x] **UX-R7-008** — Project title not inline-editable. The recipe editor's `<h1>` is contenteditable; project detail's `<h1>` (same visual treatment) is plain text. Spread the pattern. → 9662cd9
- [x] **UX-R7-009** — Mobile users have no path to `/user`. Top-right avatar pill in MobileHeader doesn't navigate. Wrap it in a `<Link href="/user">`. → 673ce86 (already-fixed sentinel)
- [x] **UX-R7-010** — Wishlist "Tools ▾" collides with sidebar Tools page name. Rename to "USE WITH ▾" or "OPEN IN ▾". → 571c4a0
- [x] **UX-R7-011** — Disclosure caret 20×20px fails WCAG 2.5.8 24px floor. Bump to 36×36; add `aria-expanded` + rotate-on-expand. → 0089876
- [x] **UX-R7-013** — Decorative "02" at 1.06:1 contrast, 96px font, no semantic meaning (library top-right). Drop or shrink to chrome scale. → e3f5ed8

## Definitely deferred

- **UX-R7-012** (59 text nodes ≤11px) — would be a giant typescale rebuild. Out of scope for the recruit-prep sweep.
- **UX-R7-014/023** (status bar layout shift) — needs investigation; could be a single CSS fix or could be a layout rework. Defer until the next audit cycle confirms it.
- **UX-R7-020** (mobile dashboard stacked cards) — substantial mobile redesign. Defer.

## Conventions

Standard ui-builder loop. One commit per critical + per high item. Tests INTO commit. No push (Billy merges).
