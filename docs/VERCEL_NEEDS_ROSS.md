# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-06 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**5 unresolved threads** — every one is already triaged and **awaiting your call**; none is a pending auto-fix. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-06):** no code shipped. All 5 open threads already carry a clarifying/status reply and are waiting on your input — no new answers had landed, so there was nothing new to build. Refreshed this doc down from 11 → 5 to match the live unresolved set (6 threads previously listed here have since been resolved: `VAzSk3GPrJcV`, `qMFgQPyIPVcx`, `iXM7bS2hnZyH`, `yT9vvxQhK3Ce`, `PNzm-KAFYLal`, `pArUXV1syxEs`).
>
> **Earlier runs (2026-07-06):** shipped copy fixes via PR #84 (`NY5ieezHa3ag`, `W0TJnSWm38nP`, `s6zlyxVZ9-cI`) and colour fixes via PR #82 (`Tcylyd5enVXT`, `Z2r21cCQAPQr`, `8myNPt4auK8V`); plus the library TYPE facet, paint side-panel Wave 2 redesign, and picker Company facet now on `main`.

---

## 🔴 NEEDS YOUR CALL (5)

| Thread | Page | Ask | Where it stands / what I need from you |
|---|---|---|---|
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title → `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT [REMAINING] / MODELS: …`), **plus** a per-project budget feature. | Relabel is locked and ready to ship on its own — the **only** blocker is the `REMAINING` field, which has no data source without budgeting. **Pick one and the relabel ships immediately:** (a) `REMAINING` = total cost of WISHLIST (not-yet-bought) items — shippable now; or (b) hold `REMAINING` until the per-project budget feature lands. Budgeting stays a separate feature either way. *(Note: an earlier reply falsely said the relabel was "shipped & live" — it never merged; main/prod still shows the old ▸ COLLECTION bar. Not resolving until it's genuinely on main.)* |
| `lPzb4lK-RfAE` | /library | Redesign the paint side panel: STATUS dropdown replacing NOT OWNED, HEX beside status, TYPE row, a RECIPE section (+ Use in a recipe + per-recipe chips), drop INVENTORY. | **Mostly shipped & live** (side-panel Wave 2, `8a68401` on main): NOT OWNED + Inventory pot-counter removed; STATUS control + HEX + TYPE row + RECIPE section with "+ Use in a recipe" and linked recipe chips all in. **One gap keeping it open:** the STATUS control reads/writes the library's own ownership store but can't auto-sync with the Collections paint table (that table title-matches paints with no `paintId` link). Bridging them needs a small schema change (add `paintId` to collection paint rows). **Do you want me to make that schema change so library STATUS and the Collections list stay in lockstep?** |
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name · game · faction · price · project dropdown · status) → save into the table; plus an edit ✎ next to the X on each row. | Substantial feature (new modal, manual-entry form + validation, edit/update flow, new row action) — beyond safe auto-fix scope, **queued as a dedicated build**. To lock scope: confirm that's the full manual field set, and that the edit ✎ reopens the same modal pre-filled with the row's values. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — remove it or make it add another circle." | **Not a bug** — the **+ Add layer** button is wired and appends a Layer N (hex + opacity) block, capped at 6. It feels dead because (1) the new block inserts *above* the button (so it lands off-screen), and (2) the Venn only renders 2 circles (undercoat ∩ top glaze) by design, so layer 3+ doesn't change it (the PREDICTED RESULT swatch does update). **Which do you want:** (a) auto-scroll/highlight the new layer when added, and/or (b) surface layers 3+ in the result preview? |
| `ZtbnthysMzUv` | /recipes | "The text is messed up here and doesn't fit in the box." (RANKED MATCHES distance number.) | **Can't reproduce from source** — the flagged element is a single `tabular-nums` CIEDE2000 match-distance span that shouldn't overflow, and the captured DOM predates a recent recipe-panel component swap so it no longer maps to anything overflowing in the live build. **Need a fresh screenshot of the exact box (or which field/label it is)** to target the precise fix. |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify in earlier 2026-07-06 runs — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `NY5ieezHa3ag` / `W0TJnSWm38nP` | Recipe "+ ADD STEP" button → "+ ADD PAINT" (both editors) — PR #84 |
| `s6zlyxVZ9-cI` | Stacking blurb "over a substrate" → "over an undercoat" — PR #84 |
| `Tcylyd5enVXT` / `Z2r21cCQAPQr` / `8myNPt4auK8V` | Landing/pricing colour fixes — PR #82 |
| `yT9vvxQhK3Ce` | Library TYPE filter facet |
| `VAzSk3GPrJcV`, `qMFgQPyIPVcx`, `iXM7bS2hnZyH`, `PNzm-KAFYLal`, `pArUXV1syxEs` | Resolved (answered / superseded) since the last snapshot |
