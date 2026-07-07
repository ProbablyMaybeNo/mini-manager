# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-07 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**1 unresolved thread awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-07, later pass):** the unresolved queue has collapsed to a **single** thread. The 13 threads carried in the previous snapshot are all off the unresolved list now (resolved/closed since). One brand-new single-message thread came in on `/tools/wheel`; it bundles an ambiguous layout move plus a question, so it got a specific clarifying reply and was left open. No fixes shipped this run — nothing was clear-and-bounded enough to auto-fix without your input.

---

## 🔴 NEEDS YOUR CALL (1)

| Thread | Page | Ask | The one thing I need from you |
|---|---|---|---|
| `O2QLNGljsS1A` | /tools/wheel | "Remove the SLOTS −/+ from the right-hand panel and add it under the colour list in the main body. Also remove GENERATE RECIPE from under the colour list. Also didn't I write a comment previously about changing the save palette / send to recipe buttons?" | Three parts, and one doesn't match the live build: **(1)** SLOTS −/+ currently lives in the **left PICK panel**, not the right — confirm you want it pulled out and dropped directly under the colour list in the main SCHEME body. **(2)** Remove GENERATE RECIPE — clear, ready to do. **(3)** I don't have your earlier comment about the **Save Palette / Send to Recipe** buttons — tell me the change (rename / recolour / drop one) and I'll ship all three in one PR. Clarifying reply posted; thread left open. |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `g_ypRnCdHcCC` | Stacking page blurb "…stack on a **substrate**" → "…stack on an **undercoat**" |
| `glGmhi0OxcAF` | Colour-wheel disclosure label "**More matches** (N)" → "**Matches** (N)" |
| `qYDF4_PrSnyZ` | Library paint side-panel recipe chips recoloured cyan → **neon green** |
| `qQ647hi5H2_W` | Added UNDERCOAT to the recipe step/layer technique picker (SlotRow) — 2026-07-06 |
| `NY5ieezHa3ag` / `W0TJnSWm38nP` | Recipe "+ ADD STEP" button → "+ ADD PAINT" (both editors) — PR #84 |
| `s6zlyxVZ9-cI` | Stacking blurb "over a substrate" → "over an undercoat" — PR #84 |
| `Tcylyd5enVXT` / `Z2r21cCQAPQr` / `8myNPt4auK8V` | Landing/pricing colour fixes — PR #82 |
| `yT9vvxQhK3Ce` | Library TYPE filter facet |
| `rIve1fnVpm-Q`, `EhIoJIWORkKM`, `uWkPLukPw_vr` | Off the unresolved list since the 2026-07-07 earlier snapshot (resolved/closed) |
| `ESVDHH6Wg78p`, `lvIX6pa9x_ab`, `jSE6LvB7hD6l`, `dOySZp3HEhJs`, `4kCdsjyL0QsK`, `c_ruBc9qWKQy`, `UPPY_FbB0xfF`, `CIzKXQx-W4iN`, `8tB-qrqkOfMm`, `BadRkuli5Ljp` | The 10 clarifying-question threads from the earlier 2026-07-07 snapshot — all off the unresolved list now |
