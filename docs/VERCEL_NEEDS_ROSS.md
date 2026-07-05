# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-02 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**3 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-02):** no new auto-fixes. All 3 open threads are already handled — each carries a prior bot reply and is waiting on your input (below), so there was nothing safe and un-handled to ship. Since the last snapshot, the two `/focus` threads (`aANKU9jIO6ih` progress-font bump, `0Uwugdcrguxb` focus-dropdown bug) were resolved and dropped off the queue.

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal layout, manual-entry form + validation, an edit/update flow, a new row action) — beyond the safe auto-fix scope. Queued as a dedicated build awaiting your sign-off on the field set. Asked: confirm the manual fields (name / game / faction / price / project / status), and should the edit pencil reopen the same modal pre-filled? |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title; format as `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT $00 TOTAL REMAINING / MODELS: 00 WISHLIST 00 OWNED 00 COMPLETE $00 TOTAL SPENT $00 TOTAL REMAINING`; drop progress tracking here) **and** a new per-project budget feature. | The relabel is otherwise locked and shippable, but one field has no source yet: `$00 TOTAL REMAINING` needs a number to subtract from. Asked: for REMAINING, do you want **(a)** total cost of WISHLIST (not-yet-bought) items — shippable now, no budget needed — or **(b)** hold REMAINING until the per-project budget feature lands? The budget system stays a separate, net-new feature. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — either remove it or make it add another circle." | Can't reproduce a break from source: **+ Add layer** is wired and appends a Layer N block (hex + opacity), capped at 6. It just *feels* dead because the new block inserts **above** the button (so it lands off-screen) and the predicted-result Venn only ever renders 2 circles (undercoat ∩ top glaze) by design. Asked: want **(a)** auto-scroll/highlight the new layer when added, and/or **(b)** surface layers 3+ in the result preview? |

---

## 🟢 SHIPPED / RESOLVED SINCE LAST SNAPSHOT

| Thread | Page | Change |
|---|---|---|
| `aANKU9jIO6ih` | /focus | PROGRESS "x/100" numbers split into their own token and bumped to 18px — resolved. |
| `0Uwugdcrguxb` | /focus | Focus-dropdown "can't change focus" bug — resolved. |

*(Prior run 2026-06-24 shipped `h58lphoBt-Dc`, `e5VXBtQdALyg`, `bEv3zSo7wbsS` — all live on main and resolved.)*
