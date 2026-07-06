# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-06 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**11 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-06, recipes/library/tools batch):** shipped 3 clear, bounded copy fixes (PR #84 → `main`, CI-gated, resolved after prod verify) — `NY5ieezHa3ag` + `W0TJnSWm38nP` (recipe "ADD STEP" button → "ADD PAINT" in both editors) and `s6zlyxVZ9-cI` (stacking blurb "substrate" → "undercoat", matching the field label). Six new threads were genuinely ambiguous / feature-scale, so each got ONE clarifying question and was left **open** (below). No further code shipped.
>
> **Earlier runs (2026-07-06):** two `/dashboard` clarifications posted (`PNzm-KAFYLal`, `pArUXV1syxEs`); and 3 landing/pricing colour fixes shipped via PR #82 (`Tcylyd5enVXT`, `Z2r21cCQAPQr`, `8myNPt4auK8V`).

---

## 🔴 NEEDS YOUR CALL

### New this run (6) — clarifying question posted, left open

| Thread | Page | Ask | Question asked |
|---|---|---|---|
| `VAzSk3GPrJcV` | /recipes | Add an "Info"/help button that opens a popup explaining what each tool is and how to use it. | Real feature. Asked: Info button in the Pick & Paint header opening a per-tool popover (Match / Stacking / Wheel), or one combined "how these tools work" panel? And will you supply the copy or want me to draft it? |
| `qMFgQPyIPVcx` | /recipes | Change the recipe filter to look like the library filter (scrollable checkbox list of companies). | UI rework. Asked: confirm the target is the recipe brand/company filter → library-style multi-select checklist, replacing the current control in the same spot. |
| `ZtbnthysMzUv` | /recipes | "The text is messed up here and doesn't fit in the box." (RANKED MATCHES distance number.) | Can't reproduce from source — the flagged element is a single `tabular-nums` span that shouldn't overflow. Asked for a screenshot of exactly what's broken (number wrapping/overflowing vs a label overlapping). |
| `iXM7bS2hnZyH` | /recipes | Add a way to delete a recipe (button next to SAVE / ATTACH RECIPE). | Destructive feature — no delete affordance today. Asked: place a DELETE RECIPE button on the SAVE/ATTACH row, with a confirm ("can't be undone") before removing and returning to /recipes? |
| `yT9vvxQhK3Ce` | /library | Do the paint scrapes carry a type? If so, add a TYPE filter. | Answered: yes — catalog carries `type` (Paint/Wash/Metallic/Contrast/Air/Primer/Varnish/Pigment/Effect; Ink/Lacquer reserved). Not yet a filter axis. Asked: build it as a checkbox section like Company/Status (multi-select, AND-composed)? |
| `lPzb4lK-RfAE` | /library | Redesign the paint side panel: STATUS dropdown replacing NOT OWNED, a RECIPE section (+ Use in a recipe + per-recipe chips), move HEX beside status, drop INVENTORY. | Substantial redesign. Asked: confirm the full layout, and should panel status auto-sync one-way (Collection → panel) or write back to the Collection table too? |

### Carried over from earlier runs (5) — still awaiting your answer

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `PNzm-KAFYLal` | /dashboard | Do a whole-app pass so button font/casing is consistent across all button colours. | Systemic, not a one-switch fix — kit `Button` doesn't force casing; each call site's literal string decides. Most buttons are ALL-CAPS; the empty-state `+ Create your first project` is sentence-case. Asked: normalize **all** buttons to ALL-CAPS app-wide, or keep specific ones sentence-case? |
| `pArUXV1syxEs` | /dashboard | Make the blue a tiny bit darker — more navy. (welcome banner) | No target hex + ambiguous scope. Banner blue is `#2A6FC9` (deepened `--blue` accent `#3182E0`, kept dark for AA contrast). Asked: scope (this banner vs app-wide `--blue`, also on links) + shade (`#22508F`, toward `#1B3F6E`, or a specific hex)? |
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal, manual-entry form + validation, edit/update flow, new row action) — beyond safe auto-fix scope. Queued as a dedicated build; asked to confirm the field set + whether the edit pencil reuses the same modal pre-filled. |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title; `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT [REMAINING] / MODELS: …`) **and** a new per-project budget feature. | Relabel is locked and shippable EXCEPT the `REMAINING` field has no data source without the budget feature. Asked: for `REMAINING`, (a) total cost of WISHLIST items — shippable now — or (b) hold `REMAINING` until per-project budgeting lands? The moment you pick, the relabel ships on its own. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — remove it or make it add another circle." | Can't reproduce: the **+ Add layer** button is wired and appends a Layer N block (up to 6). It feels dead because the new block inserts *above* the button (lands off-screen) and the Venn only renders 2 circles. Asked: does no new Layer block appear at all, or did you expect a 3rd Venn circle? |

---

## 🟢 SHIPPED THIS RUN (resolved after prod verify)

| Thread | Page | Change | Files |
|---|---|---|---|
| `NY5ieezHa3ag` | /recipes | "+ ADD STEP" button → "+ ADD PAINT" | `src/components/recipe/RecipeWorkbench.tsx` |
| `W0TJnSWm38nP` | /recipes/new | "+ Add Step" button → "+ Add Paint" | `src/components/recipe/RecipeEditorView.tsx` |
| `s6zlyxVZ9-cI` | /recipes (stacking) | Blurb "over a substrate" → "over an undercoat" (matches the "Undercoat" field label) | `src/components/tools/LayeringTool.tsx` |
