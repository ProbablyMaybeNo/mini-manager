# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-07 (latest pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**5 unresolved threads awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-07, later pass):** no fixes shipped — nothing in the open queue was clear-and-bounded enough to auto-fix without your input. Four new single-message threads came in (three on `/tools/wheel`, one on `/tools/match`); each got a specific clarifying reply and was left open. Three other new threads (`C3ygtbGZufsu`, `WcnTP2Vzy1hM`, `-D41OlDEcOYF`) are already being handled by other Claude Code tasks (each carries a "picked up — PR will follow" marker), so this run left them alone; `WcnTP2Vzy1hM` (library sticky-header floating) looks already fixed by merged PR #91.

---

## 🔴 NEEDS YOUR CALL (5)

| Thread | Page | Ask | The one thing I need from you |
|---|---|---|---|
| `O2QLNGljsS1A` | /tools/wheel | "Remove the SLOTS −/+ from the right-hand panel and add it under the colour list; remove GENERATE RECIPE; didn't I comment before about the save-palette / send-to-recipe buttons?" | Unchanged from earlier: **(1)** SLOTS −/+ actually lives in the **left PICK panel**, not the right — confirm you want it pulled out and dropped under the colour list in the main SCHEME body. **(2)** GENERATE RECIPE removal — see `tSx5YUJMik8i` below before I touch it. **(3)** I don't have your earlier Save Palette / Send to Recipe comment — tell me the change (rename / recolour / drop one). |
| `tSx5YUJMik8i` | /tools/wheel | "Remove this GENERATE RECIPE button if we have the same button in the panel to the left." | **They aren't the same button.** Left **GENERATE** fills the slots from the chosen harmony; **GENERATE RECIPE** builds a full layered paint recipe (opens the recipe dialog). Removing GENERATE RECIPE drops the "colours → real recipe" path (Send to Recipe would remain). Confirm you still want it gone. |
| `APNNqpJtZIeH` | /tools/wheel | "Clicking the GENERATE button seemingly does nothing." | It's the **left** GENERATE (harmony fill). With **1 slot** there's nothing to fill, so it looks dead. Pick the fix: **(a)** disable/grey GENERATE until 2+ slots, or **(b)** auto-add slots for the chosen harmony so one click always yields a visible scheme. |
| `T9TlAL3KQ3GX` | /tools/wheel | "Change the lock to match our aesthetic — use a white lock icon." | It's the per-slot **lock toggle** (currently a gold emoji padlock). I'll swap it for a monochrome glyph. Confirm the colour rule: **pure white in both states**, or **white unlocked / keep the yellow tint when locked** (today's "locked" signal)? |
| `7rH5cPa-w3PQ` | /tools/match | "Move the filter list below the paints or behind a button — it's confusing between the search bar and the paints." (paint-picker filter) | Pick the layout: **(1)** collapse behind a "Filters" toggle above the list (my lean), or **(2)** move the whole filter panel below the paint list. Same shared paint-picker also flagged on the `/recipes` thread `-D41OlDEcOYF` (currently owned by another task). |

---

## 🟡 In flight by other tasks (not mine to touch)

Each carries a "🛠️ picked up by Claude Code — PR will follow" marker from a separate task; left alone this run to avoid collisions.

| Thread | Page | Ask | Note |
|---|---|---|---|
| `C3ygtbGZufsu` | / | Landing tagline text → bright neon green with a subtle glow | Owned by task `t_236879fb` |
| `WcnTP2Vzy1hM` | /library | Sticky paint-list header floating / see-through → make fully opaque | Owned by task `t_f86090e0`; looks already fixed by merged PR #91 |
| `-D41OlDEcOYF` | /recipes | Move the paint-picker filter list below the list / behind a button | Owned by task `t_04c9916c` (same shared picker as `7rH5cPa-w3PQ`) |

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
