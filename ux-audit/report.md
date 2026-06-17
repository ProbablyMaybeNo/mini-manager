# Mini Manager — UX/UI Audit (production build, `main`)

**Date:** 2026-06-17 · **Method:** live audit via real Chromium (Playwright), authed as dev user, all 18
pages at 1440/768/375 — screenshots + DOM/a11y tree + computed contrast + touch-target sizes + focus-ring
probe + console errors, cross-checked against source and the Figma refs. Audit only — no source edited.
**Data:** `ux-audit/findings.json` (structured) · `ux-audit/shots/` (84 screenshots) · `ux-audit/evidence/`.

## Executive summary
A genuinely launch-grade build. The vintage-terminal aesthetic is executed with real craft, console is
clean on all 18 pages, contrast mostly passes (3 AA fails app-wide), every page has a visible 2px cyan
focus ring, landmarks/labels are correct, and the layout reflows to mobile. Findings cluster where asked —
missing features and Figma discrepancies. **15 findings: 0 critical, 3 high, 6 medium, 6 low.**

## Verdict on the 9 known PARTIAL/PENDING items
1. **+ buttons green except wishlist** — NOT resolved (`variant="add"` only in `/gallery`) → UX-001
2. **Recipe paint → full toolset** — NOT resolved (only reduced slot editor opens) → UX-002
3. **Library wishlist yellow** — MOSTLY (yellow, but cell keeps `text-glow-cyan`, `PaintListTable.tsx:95`) → UX-005
4. **Focus per-project TIME** — NOT resolved (`projectMinutes` never passed from `focus/page.tsx`) → UX-003
5. **Dashboard per-project time totals** — NOT present (only global Time Total) → UX-011
6. **Completion = bare centered %** — RESOLVED (no defect)
7. **Stat numbers shadow/outline** — PARTIAL (multi-colour but flat, no phosphor glow) → UX-006
8. **Collection dropdown styled vs native** — NOT resolved (native `<select>` throughout) → UX-007
9. **Collection paint "Type" column** — NOT resolved (slot shows Recipe, no Type) → UX-004

## Findings

### HIGH
- **UX-001** Add/"+" buttons render cyan, not green. `variant="add"` only in `/gallery`; "+ New Project"
  default-cyan (`DashboardView.tsx:107`), "+ RECIPE / + ADD SLOT / + ADD PAINT / + DATE" raw cyan. Apply
  `variant="add"` everywhere (`addWishlist` for wishlist), keep "◎ Focus" cyan. *(small, 0.95)*
- **UX-002** Recipe paint-click opens a reduced slot editor, not wheel+match+library+dropper+layering per
  Figma `Recipe.png`. Rich toolset exists for Library (`PaintInfoPanelContent.tsx`) but isn't reused.
  *(large, 0.85, needs Ross)*
- **UX-003** Focus per-project Time never renders — `focus/page.tsx` doesn't pass `projectMinutes`
  (render path exists `FocusView.tsx:103`). *(small, 0.9)*

### MEDIUM
- **UX-004** Collection paint table has no Type column (`CollectionTable.tsx:37`). *(small, 0.8, needs Ross)*
- **UX-005** Wishlist list-cell keeps `text-glow-cyan` on yellow text (`PaintListTable.tsx:95`) → `text-glow-yellow`. **Trivial, 0.97.**
- **UX-006** Dashboard stat numbers flat — add per-accent phosphor glow. *(trivial, 0.7, needs Ross)*
- **UX-007** Native `<select>` across Focus/Recipe/Collection/project-detail breaks the terminal look;
  Figma shows styled pills. One shared themed listbox. *(medium, 0.85, needs Ross)*
- **UX-008** 39 dashboard touch targets < 24×24px (WCAG 2.2 §2.5.8): row toggles 20px, "Change attached
  recipe" 16px, calendar arrows, "+ attach". *(small, 0.9)*
- **UX-009** Collection PAINT/MODEL active toggle is black-on-dark = **1.05:1**, unreadable (WCAG 1.4.3). *(trivial, 0.9)*

### LOW
- **UX-010** Sign-in/Sign-up have no `<h1>` (inputs are labelled). *(trivial, 0.9)*
- **UX-011** No per-project time on dashboard/project-detail (companion to UX-003). *(medium, 0.7, needs Ross)*
- **UX-012** Project-detail TARGET DATE is a native US-format date input. *(small, 0.65, needs Ross)*
- **UX-013** Library shows no loading state during the ~2–3.5s Dexie populate. *(small, 0.7, needs Ross)*
- **UX-014** Minor paint-info Figma deltas — "Wishlist" vs Figma "MARK AS WANTED"; live adds a MATCH section. *(trivial, 0.6, needs Ross)*
- **UX-015** Dense tables lean on hairline borders — optional row-banding polish. *(small, 0.5, needs Ross)*

## Strengths
Authentic, disciplined terminal aesthetic; the Library (7,144 paints + live hue colour-map + rich
paint-info slide-out) is a standout; strong a11y baseline (skip link, landmarks, labelled inputs, visible
focus ring everywhere, zero console errors); contrast mostly AA on neon-on-black; clean mobile reflow.

## Suggested order (severity ÷ effort)
UX-005 → UX-001 → UX-003 → UX-009 → UX-010 → UX-008 → UX-004 → UX-006 → UX-013 → UX-007 → UX-012 → UX-011
→ UX-002 → UX-014/UX-015 (confirm-only).
