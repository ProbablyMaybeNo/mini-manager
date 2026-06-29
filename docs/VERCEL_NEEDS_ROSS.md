# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-29 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**3 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-06-29):** no un-handled open threads and no new safe auto-fixes. All 3 open threads already carry a bot reply and are waiting on your input (below). The two `/focus` items that were carried over on 2026-06-24 (`aANKU9jIO6ih` 18px progress token, `0Uwugdcrguxb` focus-dropdown re-seed) are now **resolved** — both shipped and verified live. No code changes shipped this run; this is a doc-state refresh only.

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal layout, manual-entry form + validation, an edit/update flow, a new row action) — beyond the safe auto-fix scope. Queued as a dedicated build, awaiting your sign-off on the field set. Asked: confirm the manual fields (name / game / faction / price / project / status), and should the edit pencil reopen the **same** modal pre-filled with the row's values? |
| `d0MWLSNNjDTd` | /collection | Per-project + overall **budget** feature: enter a budget, WISHLIST/OWNED costs subtract, show remaining per project + an overall total. | The bundled stats-bar relabel piece already shipped & is live (dropped the "COLLECTION" title; bar now reads `PAINT: … / MODELS: …`, no progress tracking). The budgeting idea is a net-new feature, not a label tweak — speccing separately. Asked: share your thoughts on how you'd want budgeting to work so it can be scoped. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — either remove it or make it add another circle." | Not actually broken: **+ Add layer** appends a Layer N block (hex + opacity), capped at 6. It *feels* dead because (1) the new block inserts above the button so it lands off-screen, and (2) the predicted-result Venn only renders 2 circles (undercoat ∩ top glaze) by design, so layer 3+ doesn't change it (the result swatch does update). Asked: want (a) auto-scroll/highlight the new layer when added, and/or (b) surface layers 3+ in the result preview? |

---

## 🟢 RESOLVED SINCE LAST SNAPSHOT (2026-06-24 → 2026-06-29)

| Thread | Page | Change | Status |
|---|---|---|---|
| `aANKU9jIO6ih` | /focus | Focus PROGRESS `x/N` counter given its own 18px token (same VT323 face); calendar/Time/% numbers untouched | Shipped & resolved |
| `0Uwugdcrguxb` | /focus | Focus dropdown now re-seeds the PROGRESS `x/N` counter on project change (header/recipe/time already updated) | Shipped & resolved |
