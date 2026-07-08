# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-08 (follow-up cron pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**6 unresolved threads awaiting your call. No CI blocker — `main` is green again.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **✅ This run (2026-07-08, follow-up cron pass): nothing un-handled — shipped 0, posted 0 new questions. The earlier CI blocker has CLEARED.**
> - All 6 open threads below already carry a clarifying question from earlier runs and are still waiting on you — no new action, listed so they don't get lost.
> - **The repo-wide CI blocker flagged in the earlier 2026-07-08 pass is resolved.** `1e6NuOqXabYV` (DASHBOARD→PROJECTS) merged to `main` as **PR #110** (`ffe270f`) — the same PR fixed the pre-existing auth/billing E2E failures (sign-up specs now fill the required email field; the beta-gated paid-upgrade flow is `describe.skip`ped), so the Playwright gate went green. That thread is **resolved**. `main`'s merge gate is healthy — Vercel-comment fixes can pass CI and merge again.
> - `XeheRPMOLslU` (/tools/match — reuse the recipe PAINT PICKER PANEL for COLOR MATCH) also landed: **PR #111** (`063dc77`, re-land of #100/#102) — resolved. `main` is now at `063dc77`.
>
> **Earlier run (2026-07-08, cron pass):** re-landed `1e6NuOqXabYV` as PR #110 and initially reported it BLOCKED on the red E2E gate; that gate was subsequently repaired within #110 and the PR merged (see above).
>
> **Previous run (2026-07-07, late cron pass):** shipped **1** and posted **1** new clarifying question.
> - Shipped `ra9QhujevTqM` — /collection "add this text into an actual box". Wrapped the "Auto-fills from…" paste-URL helper paragraph in a bordered box (`rounded-[6px] border border-border`, matching the CollectionStatsBar/CollectionTable container pattern) in `src/components/collection/PasteUrlBar.tsx`. Went through the gated loop (PR → CI → merge → prod verify → resolve).
> - Posted a clarifying question on `XzIZJoGqnY-a` (/tools/match) — "offer more than one match possibility for each colour". With a harmony selected the tool shows exactly **one** best paint per harmony hue; surfacing alternates is a real feature and needs your call on how (see table). Left open.
> - `XeheRPMOLslU` (/tools/match — reuse the recipe PAINT PICKER PANEL for COLOR MATCH) already carries a "picked up" note from another Claude Code task (`t_8083d79c`) with a PR to follow, so I left it to that run and did not touch it.
> - `4odMSzb6-6zR` and `haCS2-aXxUQb` (the other two filter-placement cluster threads) no longer appear in the unresolved list — resolved since the last pass, shrinking the cluster to the two below.
>
> **Previous run (2026-07-07, cron pass):** shipped **1** and posted **2** new clarifying questions.
> - Shipped `XvJwNsHNE89S` — hero tagline "add more glow". The intensified five-layer glow had been merged as PR #97 **but into the throwaway `fix/library-list-header-opaque` branch, not `main`** — so the "✅ live on production" reply on that thread was wrong; production still had the older subtle glow. Re-landed the exact change on `main` through the gated loop, verified prod, then resolved.
> - Posted clarifying questions on `4odMSzb6-6zR` (/recipes/new picker) and `haCS2-aXxUQb` (/tools/match picker) — both are the same "move the Company/brand filter below the paint list" ask as `7rH5cPa`/`-D41OlDEcOYF`. All four share the one `ColorPicker` component and hinge on the same unresolved decision (keep the collapsed toggle vs. move below the list). Left open. NB: a prior agent already implemented "move below" as PR #98 on that same dead `fix/library-list-header-opaque` branch — it is **not** on `main`; I did not land it, pending your call so all four resolve consistently.
>
> **Previous run (2026-07-07, evening):** shipped **2** and posted **1** new clarifying question.
> - Resolved `WcnTP2Vzy1hM` — the "floating" library list header. The fix (`bg-bg/95` → opaque) had already landed in PR #91 (`de3b6fe`) and was live; the thread just never got closed. Verified against prod and resolved.
> - Resolved `C3ygtbGZufsu` — hero tagline → neon green + glow. Merged the pre-existing PR #92 (`f4c2de7`) after confirming CI green + that the change matched your screenshot, verified the production deploy, then resolved.
> - `-D41OlDEcOYF` (filter placement) had only a stale "picked up" note and no reply — posted a clarifying question (see below) and left it open.
>
> The other 5 threads already carry a clarifying question from earlier today and are still waiting on you — no new action taken, listed here so they don't get lost.

---

## 🔴 NEEDS YOUR CALL (6)

> **Filter-placement cluster (2 threads):** `-D41OlDEcOYF`, `7rH5cPa-w3PQ` are the *same* ask on the *same* shared `ColorPicker` component (the other two, `4odMSzb6-6zR`/`haCS2-aXxUQb`, have since been resolved). One answer (keep the collapsed toggle vs. move the filter below the list) resolves both — I'll ship it once.

| Thread | Page | Ask | The one thing I need from you |
|---|---|---|---|
| `-D41OlDEcOYF` | /library (?) | "Move the filter list below the paints or hide it behind a button/dropdown — confusing having it between the search bar and the paints." | **Which screen?** On `/library` the filters already sit behind a **Filter** button (slide-out), and on the Match/recipe paint-picker the Company filter was collapsed behind a toggle in PR #90 — so this may already be sorted. Tell me the page, and whether it's good now or you still want the remaining filters **below the list** rather than behind a button. |
| `7rH5cPa-w3PQ` | /tools/match | Same "move the filter list" ask, on the Match tool's paint-picker. | Pick one: **(1)** collapse behind a "Filters" toggle above the list (my lean), or **(2)** move the whole filter panel below the paint list. |
| `T9TlAL3KQ3GX` | /tools/wheel | "Use a white lock icon that matches our aesthetic" (per-slot lock toggle, currently the gold emoji padlock). | Icon colour: **pure white in both states**, or **white when unlocked / keep the yellow tint when locked** (locked-yellow is the current at-a-glance signal). |
| `APNNqpJtZIeH` | /tools/match | "Clicking GENERATE does nothing." | It's not broken — with only 1 slot there's nothing to fill. Which fix: **(1)** disable/grey GENERATE until 2+ slots (with a hint), or **(2)** auto-add slots so one click always yields a scheme. |
| `tSx5YUJMik8i` | /tools/wheel | "Remove this GENERATE RECIPE button — we have the same one on the left." | They're **not** the same: left GENERATE fills slots from the harmony; GENERATE RECIPE builds the full layered recipe + opens the dialog. Confirm you still want GENERATE RECIPE removed (I'll also handle the matching ask on `O2QLNGljsS1A` in one go). |
| `O2QLNGljsS1A` | /tools/wheel | "Move SLOTS −/+ under the colour list; remove GENERATE RECIPE; + a question about the save-palette / send-to-recipe buttons." | **(1)** SLOTS −/+ currently lives in the **left PICK panel**, not the right — confirm you want it pulled out and dropped under the colour list in the main SCHEME body. **(2)** GENERATE RECIPE removal — ready. **(3)** I don't have your earlier save-palette / send-to-recipe comment — tell me the change (rename / recolour / drop one) and I'll ship all three together. |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `XeheRPMOLslU` | Color Match reuses the shared **PAINT PICKER PANEL** (extracted from the recipe picker); harmony mode now shows the top 3 ranked matches per hue — PR #111 (`063dc77`, re-land of #100/#102) |
| `1e6NuOqXabYV` | User-facing **DASHBOARD → PROJECTS** label rename across the app (nav, header, breadcrumbs, tour, 404, focus hint, landing card); route paths/types/anchors unchanged — PR #110 (`ffe270f`) |
| `WcnTP2Vzy1hM` | Library list-view sticky header made fully opaque (`bg-bg/95` → solid) — PR #91 (`de3b6fe`), `src/components/library/PaintListTable.tsx` |
| `C3ygtbGZufsu` | Homepage hero tagline → bright neon green (`#39ff14`) + subtle glow — PR #92 (`f4c2de7`) |
| `g_ypRnCdHcCC` | Stacking page blurb "…stack on a **substrate**" → "…stack on an **undercoat**" |
| `glGmhi0OxcAF` | Colour-wheel disclosure label "**More matches** (N)" → "**Matches** (N)" |
| `qYDF4_PrSnyZ` | Library paint side-panel recipe chips recoloured cyan → **neon green** |
| `qQ647hi5H2_W` | Added UNDERCOAT to the recipe step/layer technique picker (SlotRow) |
| `NY5ieezHa3ag` / `W0TJnSWm38nP` | Recipe "+ ADD STEP" button → "+ ADD PAINT" (both editors) — PR #84 |
| `s6zlyxVZ9-cI` | Stacking blurb "over a substrate" → "over an undercoat" — PR #84 |
| `Tcylyd5enVXT` / `Z2r21cCQAPQr` / `8myNPt4auK8V` | Landing/pricing colour fixes — PR #82 |
| `yT9vvxQhK3Ce` | Library TYPE filter facet |
</content>
</invoke>
