# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-06 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**7 unresolved threads awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-06, later pass):** no new clear/bounded fixes to ship. One brand-new `/recipes` thread (`uWkPLukPw_vr`) came in and got a specific clarifying question (below); left open. The other six needs-Ross threads are unchanged — no new input from you had landed on them.

---

## 🔴 NEEDS YOUR CALL (7)

| Thread | Page | Ask | Where it stands / what I need from you |
|---|---|---|---|
| `rIve1fnVpm-Q` | /recipes | "What do the gallery and shared tags even do? When I click nothing happens." | **Confirmed dead:** the MY RECIPES / GALLERY / SHARED bottom tabs aren't wired — the list only filters by the search box, so GALLERY/SHARED do nothing. **What should each show?** Proposed: GALLERY = browse public/published recipes (mirrors `/gallery`), SHARED = your own recipes that have a public link. Confirm that (or say remove them) and I'll build it. |
| `EhIoJIWORkKM` | /recipes | "What does this even share a link to? We want share on the per-recipe level, not everything." | The **⬡ SHARE LINK** button already shares *just this recipe* (publishes to `/r/<slug>`, copies that one link). The likely gotcha: minting the link **also lists the recipe on the public `/gallery`**. **Pick one:** (a) sharing a recipe should *not* also surface it in the public gallery (private/unlisted link), or (b) something else about what it shares. |
| `lPzb4lK-RfAE` | /library | Redesign the paint side panel: STATUS dropdown replacing NOT OWNED, HEX beside status, TYPE row, a RECIPE section (+ Use in a recipe + per-recipe chips), drop INVENTORY. | **Mostly shipped & live** (side-panel Wave 2, `8a68401`): NOT OWNED + Inventory pot-counter removed; STATUS control + HEX + TYPE row + RECIPE section with "+ Use in a recipe" and linked recipe chips all in. **One gap keeping it open:** STATUS can't auto-sync with the Collections paint table (that table title-matches paints with no `paintId` link). Bridging them needs a small schema change (add `paintId` to collection paint rows). **Want me to make that schema change so library STATUS and Collections stay in lockstep?** |
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name · game · faction · price · project dropdown · status) → save into the table; plus an edit ✎ next to the X on each row. | Substantial feature (new modal, manual-entry form + validation, edit/update flow, new row action) — beyond safe auto-fix scope, **queued as a dedicated build**. To lock scope: confirm that's the full manual field set, and that the edit ✎ reopens the same modal pre-filled with the row's values. |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title → `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT [REMAINING] / MODELS: …`), **plus** a per-project budget feature. | Relabel is locked and ready to ship on its own — the **only** blocker is the `REMAINING` field, which has no data source without budgeting. **Pick one and the relabel ships immediately:** (a) `REMAINING` = total cost of WISHLIST (not-yet-bought) items — shippable now; or (b) hold `REMAINING` until the per-project budget feature lands. Budgeting stays a separate feature either way. *(main/prod still shows the old ▸ COLLECTION bar — not resolving until it's genuinely on main.)* |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — remove it or make it add another circle." | **Not a bug** — the **+ Add layer** button is wired and appends a Layer N (hex + opacity) block, capped at 6. It feels dead because (1) the new block inserts *above* the button (so it lands off-screen), and (2) the Venn only renders 2 circles (undercoat ∩ top glaze) by design, so layer 3+ doesn't change it (the PREDICTED RESULT swatch does update). **Which do you want:** (a) auto-scroll/highlight the new layer when added, and/or (b) surface layers 3+ in the result preview? |
| `uWkPLukPw_vr` | /recipes | Widen the recipe page, bigger paint icons + full names, add a persisted NOTES box below DELETE/SAVE/ATTACH, auto-populate per-paint notes as styled lines (layer + name bold/coloured), feed into the "shared recipe experience". | Multi-part. Right-side panels were recently widened (`max-w-4xl`). A plain persisted NOTES text box is bounded/shippable; the auto-population + shared-recipe rendering is its own build. **One call to unblock:** ship the plain NOTES box now and treat auto-population + shared rendering as a follow-up, or hold and build the whole thing at once? |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `qQ647hi5H2_W` | Added UNDERCOAT to the recipe step/layer technique picker (SlotRow) — 2026-07-06 |
| `NY5ieezHa3ag` / `W0TJnSWm38nP` | Recipe "+ ADD STEP" button → "+ ADD PAINT" (both editors) — PR #84 |
| `s6zlyxVZ9-cI` | Stacking blurb "over a substrate" → "over an undercoat" — PR #84 |
| `Tcylyd5enVXT` / `Z2r21cCQAPQr` / `8myNPt4auK8V` | Landing/pricing colour fixes — PR #82 |
| `yT9vvxQhK3Ce` | Library TYPE filter facet |
| `VAzSk3GPrJcV`, `qMFgQPyIPVcx`, `iXM7bS2hnZyH`, `PNzm-KAFYLal`, `pArUXV1syxEs` | Resolved (answered / superseded) since an earlier snapshot |
