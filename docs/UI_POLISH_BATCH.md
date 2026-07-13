# UI Polish Batch — 2026-07-13 audit follow-ups

Deduped high/medium fixes from the desktop (`ux-audit/full-app-2026-07-13/`) and
mobile (`mobile-ux-audit/full-app-2026-07-13/`) audits. All verified live; none
are regressions from the gallery-moat merges.

## Conventions
- Node 24. Validate with `npm run build` (typecheck + lint); it stamps
  `public/sw.js` → run `git checkout public/sw.js` after every build.
- **Do all six fixes on ONE branch** `fix/ux-audit-polish-2026-07-13` off latest
  `main`, one commit per fix (co-author line:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).
  Open ONE PR to `main` at the end. Do NOT merge — the caller merges after CI.
- Do NOT edit this batch doc (it lives on `main`; editing it on a branch causes
  merge conflicts). Track progress in your own head/notes.
- Match existing primitives + design tokens. TS strict, zero type errors.
- Halt + report only if a fix needs a genuine design decision.

---

## P1 — White-on-red buttons fail AA (desktop UX-001 / mobile MUX-005)
White text on `--color-red` (#f7143e, globals.css:80) is ~4.1:1 — below AA 4.5:1.
- Add a deeper red token for white-text surfaces in `src/app/globals.css`
  (next to the existing red tokens ~line 80):
  `--color-red-deep: #c81032;` /* white text ≈ 5.6:1 */
- In `src/components/kit/Button.tsx`, change the `danger` (line ~39) and
  `solidRed` (line ~58) variants' fill from `bg-red` → `bg-red-deep` (keep
  `border-red`, `text-white`; hover can stay `hover:bg-red-deep/85` or similar).
  Tailwind v4 maps `--color-red-deep` → `bg-red-deep` automatically.
- Apply the same to the `/tools/wheel` red badge the mobile audit flagged (white
  on #f7143e ≈ 4.34:1) — find it and give it `bg-red-deep` (or ensure its text
  meets 4.5:1). Leave `--color-red` untouched everywhere else (borders/icons/
  small fills/priority reds are unaffected).
- Acceptance: white-on-red fills ≥ 4.5:1; no other red usage changes; build green.

## P2 — /tools/stacking panel clipped & unreachable on phones (mobile MUX-001)
At 375px the LAYERING panel (`src/app/(app)/tools/stacking/page.tsx` + its
components) extends ~59px past the viewport with no scroll, so the hex field,
ASSIGN button, and ALTERNATIVES dropdown are off-screen.
- Make the panel/rows fluid at compact width — stack the controls under the
  swatch below ~`sm`, or wrap the wide row in an `overflow-x-auto` container with
  a scroll cue. Follow the responsive pattern already used by the other tools
  (match/wheel handle this).
- Acceptance: at 375px AND 320px every stacking control is reachable, no
  page-level horizontal scroll; desktop layout unchanged; build green.

## P3 — Tool swatch labels illegible on light user colours (desktop UX-002)
White labels are painted directly on user-picked swatch colours across
wheel/match/dropper/stacking → fails AA on many hues.
- Make the on-swatch label colour luminance-adaptive (black on light swatches,
  white on dark) or add a subtle neutral scrim behind the text. Check
  `src/lib/color*` for an existing luminance/contrast helper and reuse it rather
  than adding one.
- Acceptance: label text ≥ 4.5:1 against its swatch across the hue range; build green.

## P4 — Status / priority / sort dropdowns below the 24px tap floor (mobile MUX-002)
The LOW/MED/HIGH and sort ("Completion ↓") dropdowns on `/dashboard` and
`/projects` are ~21px tall — under WCAG 2.5.8 (24px) and high-frequency.
- Raise those select/dropdown controls to `min-h-11` (44px), glyph vertically
  centred. Find the shared primitive if there is one so the fix is single-source.
- Acceptance: those controls ≥ 44px tall on mobile; desktop density acceptable;
  build green.

## P5 — Gallery sort chips: wrap + comfortable height (mobile MUX-007)
In `src/app/(app)/gallery/GalleryBrowser.tsx`: the sort-chip group
(`role="group"` div, ~line 52) needs `flex-wrap`; the `SortChip` height
(`min-h-6`, ~line 110) should go to `min-h-11` for a comfortable 44px target.
- Acceptance: chips wrap instead of overflowing; ≥44px tall; build green.

## P6 — Promote "Post to gallery" to primary in the share footer (desktop UX-004)
Ross's call: the higher-value community action should lead. In
`src/components/recipe/ShareCardComposer.tsx` footer, swap the two variants —
"Post to gallery" becomes the filled primary; "Download card" becomes the
secondary/outline (`variant="outlineCyan"`). Keep both helper lines, the
`recipeId` guard, the success/resubmit state, and the admin-approve note.
- Acceptance: Post is the visually-primary action, Download secondary, both still
  work; the `qa_share_card.spec.ts` E2E still finds "Download card" (it doesn't
  assert variant) — don't rename the buttons; build green.
