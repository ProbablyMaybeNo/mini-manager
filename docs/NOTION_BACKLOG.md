# Notion Backlog — Round 5 polish

From the Notion **Testing Task Tracker** database (page `370c5770777180f3a847db6c6f48f5a7`). 14 items captured via voice-note, 1 is a real bug, 13 are design/polish asks plus one meta-pattern that ties most of them together.

**Voice-transcription note:** "Whistlers" / "whistles" throughout = **Wishlist**. Same surface.

**Meta-pattern (item 14):** Ross verbatim — _"USE SOLID COLOR BUTTONS WITH BLACK/WHITE TEXT INSTEAD OF THE [ ] that we have been using."_ This is the dominant theme. The Button primitive (`src/components/ui/Button.tsx`) already exists with `primary` / `secondary` / `ghost` / `danger` variants — the work is sweeping `[ ... ]` bracket-text buttons across the app and replacing with `<Button>`.

**Channels:**
- **Bug (item 7) + Grey Knights diagnosis (item 6):** Billy foreground.
- **Polish sweep (items 14, 2, 5, 1, 3, 4, 8, 9, 12):** ui-builder agent.
- **Tools color picker (item 13):** deferred — needs a new primitive, separate plan.

---

## Foreground (Billy)

- [ ] **Item 7 — Wishlist Project column not functioning.** Severity: Medium. Tags: wishlist, project, column.
  - **Steps to reproduce:** Navigate to wishlist, click the Project column on a row.
  - **Expected:** A list of projects to attach the kit to.
  - **Actual:** Column shows "none" and no picker opens on click.
  - **Where to look:** `src/components/wishlist/TagToProjectMenu.tsx` + `src/components/wishlist/WishlistTable.tsx` + the server action that backs project tagging.

- [ ] **Item 6 — Project page UI clarity for Grey Knights.** Severity: Medium. Tags: project page, ui, grey knights.
  - Vague — needs eyes-on the Grey Knights project on the live URL to know what's specifically broken.

---

## ui-builder polish sweep

### Big sweep — solid-button replacement

- [ ] **Item 14 — App-wide bracket → Button sweep.** Severity: Medium (but huge visual impact). Tags: ui, design, button.
  - Grep for `\[ .* \]` patterns inside JSX text content. Audit every match.
  - Replace ad-hoc `<button className="frame ...">[ + ] Some Action</button>` with `<Button variant="primary"|"secondary"|"ghost"|"danger">Some Action</Button>` from `src/components/ui/Button.tsx`.
  - Decision rule:
    - **Primary CTA** (the thing the user is most likely to want on this surface) → `variant="primary"` (filled cyan bg + dark text).
    - **Secondary action** (cancel, alternate path) → `variant="secondary"` (cyan outline).
    - **Destructive** (delete, remove, clear) → `variant="danger"` (red outline).
    - **Quiet / inline** (just-noticeable affordances, table-row controls) → `variant="ghost"` (border + fg text).
  - **Keep `[ x ]`-style bracket TEXT** where it represents code/data (e.g. `[24]` for a numeric counter cell, `[#FF6633]` for a hex literal). The pattern is buttons → solid; data → brackets stay.
  - Likely surfaces (non-exhaustive): NewProjectForm "[ + ] Create project", NewRecipeButton, AttachRecipeTrigger, ShareModal "[ Share via... ]", ToolFooterActions, InventoryControls full "[ Just bought +1 ]", FilterRail "[ Clear all filters ]", MobileHeader/LibraryPageClient "[ Filters ]" mobile trigger, RecipeNotes, ExportButton, CloneButton.
  - **Halt + check before shipping** if the sweep balloons into more than ~15 files; we may want to land it in multiple commits by surface area.

- [ ] **Item 2 — Replace recipe button with solid color and black text.** Tags: recipe, button, ui.
  - Subsumed by item 14, but flagging the recipe-create CTA + the `NewRecipeButton` component as a specific target.

- [ ] **Item 5 — Replace attach recipe button with a colored button.** Tags: projects page, recipe box, button design.
  - Subsumed by item 14, but `AttachRecipeTrigger.tsx` + `AttachRecipeModal.tsx` are specific targets. The trigger is currently `[ Attach recipe ]` text — make it `<Button variant="primary">Attach recipe</Button>`.

### Surface polish

- [ ] **Item 1 — UI for creating a new recipe looks unstyled and inconsistent.** Tags: ui, recipe, font, buttons.
  - Recipe creation flow (`NewRecipeButton` → the new recipe page or modal → `RecipeEditorClient`) needs typography + button consistency with rest of app.
  - Specifically: the NewRecipeButton + any form labels + the editor's `[ + Add zone ]` / `[ + Add step ]` controls.

- [ ] **Item 3 — Update star and wishlist color and simplify owned adjustment options.** Tags: paint, slide out panel, star, whistles.
  - Already shipped yellow wishlist semantic (V3, V4). This item asks for further tightening on the PaintDetailPanel slide-out (the `full` variant of InventoryControls).
  - "Simplify owned adjustment" — the current `[− 0 + Just bought +1]` cluster is busy. Consider a single combined stepper or drop the "Just bought +1" button (the `+` already does the same job).

- [ ] **Item 4 — Improve spacing and appearance of list and grid buttons on library page.** Tags: library, buttons, ui, spacing.
  - The `ViewModeToggle` (list/grid pair at the top of library) needs a polish pass — likely just spacing inside each button, alignment with adjacent chrome, hover treatment.

- [ ] **Item 8 — Improve status change experience on Wishlist page from table view.** Tags: wishlist, table view, status change.
  - When you click a wishlist row's status (Wanted / Bought / Cancelled) in the table view, the UX is currently clunky. Look at WishlistTable.tsx status column + any dropdown/popover and tighten — likely an inline pill toggle or a hover dropdown.

- [ ] **Item 9 — Improve design of right hand slide-out panel on wishlist.** Tags: wishlist, panel, design, ui.
  - WishlistDetailDrawer.tsx — apply the same polish that landed on PaintDetailPanel.tsx (card-elevation, status-pill alignment, button-variant consistency).

- [ ] **Item 11 — Match page brand filters look terrible, hard to read.** Tags: ui, design.
  - `/tools/match` brand filter UI needs a vintage-style rework. Likely currently a checkbox list or chip grid; needs solid-button chips with clearer state.

- [ ] **Item 12 — Add tooltip explaining ΔE notation.** Tags: ui, design.
  - The `△E 0.5` figure on Match results is industry standard (CIE Delta-E 2000 color-difference) but unfamiliar to most painters.
  - Add a tooltip / inline `(?)` icon next to the ΔE column header explaining: "ΔE = color difference. Lower is closer. <1 is imperceptible to the eye, 1-3 is a close match, 5+ is noticeably different."

---

## Deferred — separate plan

- **Item 13 — Color picker beyond hex on Gradient + Match tools.** Tags: ui, design.
  - Currently those tools take only a hex input. Ross wants a clickable color wheel OR a slider-bar interface to pick colors visually.
  - **Needs a new primitive** (`<ColorPicker>` with HSL sliders + 2D saturation/lightness grid) — defer until a dedicated plan.

- **Item 10 — "Test test test testing now"** — noise from a voice-test entry. Skip.

---

## Build order (recommended)

1. **Item 7** — bug fix (Billy)
2. **Item 14 + 2 + 5** — solid-button sweep (agent, big commit OR small chained commits)
3. **Item 1** — recipe creation polish (falls out of #14)
4. **Items 11, 12, harmony part of 14** — tools polish
5. **Items 8, 9, 3, 4** — surface polish trickle
6. **Item 6** — Grey Knights (Billy, after eyes-on)
7. **Item 13** — color picker (separate plan, deferred)

## Conventions for the agent run

- Standard ui-builder conventions (see `C:\Users\Admin\.claude\agents\ui-builder.md`).
- One commit per Notion item where practical; item 14's sweep MAY be multiple commits split by surface area.
- Tick `[x]` here with SHA on completion.
- Do NOT push. Billy merges.
- **Critical:** keep `[ ]` brackets where they represent **data**, not buttons. Numeric cells, hex literals, status pills, log tags, etc. all keep brackets. Buttons drop them.
