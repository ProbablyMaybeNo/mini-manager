# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-07 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**13 unresolved threads awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-07):** shipped 3 clear/bounded fixes (see *Shipped this run* below) via PR to `main`. Triaged 13 remaining open threads — 10 brand-new single-message threads each got a specific clarifying question and were left open; the 3 older needs-Ross threads are unchanged (no new input from you had landed). The 4 needs-Ross threads from the 2026-07-06 snapshot (`lPzb4lK-RfAE`, `trogZqV-Yo8w`, `d0MWLSNNjDTd`, `8Wxk5lw0uh5c`) are no longer in the unresolved list — resolved/closed since then.

---

## 🔴 NEEDS YOUR CALL (13)

### New this run — a clarifying question is waiting on each thread (10)

| Thread | Page | Ask | The one question I need answered |
|---|---|---|---|
| `ESVDHH6Wg78p` | /tools/stacking | Rework the Venn: 1 circle at undercoat+1 layer, 3 overlapping circles at 2 layers with result in the centre — **or** drop "undercoat" entirely and make everything renameable LAYER # with the result = where all circles overlap. | **(a)** tweak the current Venn, or **(b)** full rename-to-layers rebuild? |
| `lvIX6pa9x_ab` | /tools/stacking | Remove the paint-library match list from the Color Picker + Eyedropper; make them pure colour-finders that feed colours into recipes (paint-matching becomes a later step). | Full rework of picker/dropper, or just **hide** the library list on those two tools as a quick first step? |
| `jSE6LvB7hD6l` | /tools/stacking | "WTF does this even mean?!?" — confused by a line of microcopy. | Which line — the RAMP placeholder "Enter valid shadow / base / highlight hexes." or the STACKING blurb? (paste the text and I'll rewrite it) |
| `dOySZp3HEhJs` | /tools/dropper | "Send to recipe" is dead. Keep dropper as pure colours; retitle subtitle; rename buttons → "Create Recipe" / "Assign to Recipe"; add a per-row Assign button. | Build the whole thing (incl. the send-colours→recipe wiring) as one piece, or ship the button/subtitle copy now and wire later? |
| `4kCdsjyL0QsK` | /tools/match | Add a paint-**type** filter to the Match tool (avoid matching an acrylic to a clearcoat). | TYPE facet identical to Library's, default "all types" — and should it remember the last selection or reset each visit? |
| `c_ruBc9qWKQy` | /library | When a filter is added, default the sort to **colour** instead of brand. | Flip to colour for **any** filter or **only** the TYPE filter? And override a manually-chosen sort, or respect it? |
| `UPPY_FbB0xfF` | /library | Replace with one `[STATUS]` button that cycles grey [STATUS] → green [OWNED] → yellow [WISHLIST] → grey. | Each click persists status immediately (confirm), and does this **replace** the new side-panel STATUS dropdown? |
| `CIzKXQx-W4iN` | /tools/wheel | "Send to recipe" navigates to /recipes but carries no colours — what's it meant to do? | On click: **(a)** create a new recipe from all picked colours, or **(b)** show a new-vs-existing chooser? |
| `8tB-qrqkOfMm` | /tools/wheel | "Generate recipe" is unintuitive — proposed a seed-colour + harmony auto-fill flow. | Confirm the flow (N slots → seed → pick harmony → auto-fill rest), and should the seed stay pinned or can the harmony re-order slots? |
| `BadRkuli5Ljp` | /tools/wheel | Add / remove / lock color slots + drag-to-reorder in the colour scheme. | Does "lock" = keep-this-colour-while-Generate-refills-the-rest, and what's the max slot count (harmonies top out ~6)? |

### Carried over — older threads, still awaiting you (3)

| Thread | Page | Ask | Where it stands / what I need from you |
|---|---|---|---|
| `rIve1fnVpm-Q` | /recipes | "What do the gallery and shared tags even do? When I click nothing happens." | **Confirmed dead:** the MY RECIPES / GALLERY / SHARED tabs aren't wired — the list only filters by the search box. **What should each show?** Proposed: GALLERY = browse public recipes, SHARED = your own recipes with a public link. Confirm (or say remove them). |
| `EhIoJIWORkKM` | /recipes | "What does this even share a link to? We want share on the per-recipe level, not everything." | The **⬡ SHARE LINK** button already shares *just this recipe* (`/r/<slug>`). Likely gotcha: minting the link **also lists it on the public `/gallery`**. Pick: (a) sharing shouldn't surface it in the gallery (unlisted link), or (b) something else. |
| `uWkPLukPw_vr` | /recipes | Widen the recipe page, bigger paint icons + full names, add a persisted NOTES box below DELETE/SAVE/ATTACH, auto-populate per-paint notes as styled lines, feed into the shared-recipe experience. | Right-side panels were recently widened (`max-w-4xl`). A plain persisted NOTES box is shippable now; auto-population + shared rendering is its own build. **Ship the plain NOTES box now and treat the rest as a follow-up, or hold and build it all at once?** |

---

## 🟢 Shipped this run (2026-07-07) — pending merge/prod-verify, then resolved

| Thread | Change | Files |
|---|---|---|
| `g_ypRnCdHcCC` | Stacking page blurb "…stack on a **substrate**" → "…stack on an **undercoat**" | `src/app/(app)/tools/stacking/page.tsx` |
| `glGmhi0OxcAF` | Colour-wheel disclosure label "**More matches** (N)" → "**Matches** (N)" | `src/components/tools/ColourWheelTool.tsx` |
| `qYDF4_PrSnyZ` | Library paint side-panel recipe chips recoloured cyan → **neon green** | `src/components/library/PaintInfoPanelContent.tsx` |

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
| `lPzb4lK-RfAE`, `trogZqV-Yo8w`, `d0MWLSNNjDTd`, `8Wxk5lw0uh5c` | Off the unresolved list since the 2026-07-06 snapshot (resolved/closed) |
