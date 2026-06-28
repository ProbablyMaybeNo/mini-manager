# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-28 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**3 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-06-28):** no new auto-fixable threads — every open thread already has a reply and is waiting on your input (below). Housekeeping only: the two `/focus` items from the 2026-06-24 queue (`aANKU9jIO6ih` 18px PROGRESS token, `0Uwugdcrguxb` focus-dropdown re-seed) both shipped and are now **resolved**, so they've dropped off this list.

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal layout, manual-entry form + validation, an edit/update flow, a new row action) — beyond the safe auto-fix scope. Queued as a dedicated build pending your sign-off on the field set. Asked: confirm the manual fields, and should the edit pencil reuse the same modal pre-filled with the row's values? |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (done) **and** a new per-project budget feature. | The stats-bar relabel **shipped** (dropped the "COLLECTION" title; bar now reads `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT $00 TOTAL REMAINING / MODELS: 00 WISHLIST 00 OWNED 00 COMPLETE $00 TOTAL SPENT $00 TOTAL REMAINING`, no progress tracking). The **per-project budget system** (set a budget, WISHLIST/OWNED costs subtract, show remaining per project + an overall total) is a net-new feature being spec'd separately — thread left open to track it. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — either remove it or make it add another circle." | Can't reproduce as broken from source: the **+ Add layer** button is wired and appends a Layer N block (hex + opacity), capped at 6. It *feels* dead because the new block inserts above the button (slides out of view) and the PREDICTED RESULT Venn only ever renders 2 circles by design (the swatch does update). Asked: want me to (a) auto-scroll/highlight the new layer on add, and/or (b) surface layers 3+ in the result preview? |

---

## 🟢 RECENTLY RESOLVED (carried off this list)

| Thread | Page | Change | Resolved |
|---|---|---|---|
| `aANKU9jIO6ih` | /focus | Dedicated 18px token (same VT323 face) for the focus PROGRESS `x/N` counter, leaving calendar/Time/% numbers untouched | 2026-06-24 run, verified live |
| `0Uwugdcrguxb` | /focus | Focus-dropdown switch now re-seeds the PROGRESS `x/N` counter to the new project (header/recipe/time already updated) | 2026-06-24 run, verified live |
