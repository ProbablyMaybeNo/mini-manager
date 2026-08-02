# Vercel comments — Ross's decision queue

**Snapshot:** 2026-08-02 (cron pass · 2nd) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**6 unresolved threads · 2 blocked on infra · 1 answered → ready to build (hands-on) · 3 awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-08-02, 2nd cron pass): 0 safe auto-fixes shipped, 0 un-handled threads.** Every open thread already carries a prior bot reply from the last pass, so nothing was re-touched or re-replied (that would just echo my own comments). One status change since last pass: **`YtOKfPcOmKxq` — you answered "option A"**, so it moves from open-question to answered/ready-to-build. It is intentionally NOT auto-shipped: it's a flex-height refactor of the **shared** Pick & Paint `ColorPicker` (drives the Wheel tab + Stacking picker too), which is outside the clear/bounded auto-fix envelope and needs a hands-on build + visual QA.
> - **🔑 Two AI-recipe reports are one root cause:** the `ANTHROPIC_API_KEY` env var is missing from the **Production** environment. The code path (`src/lib/ai/recipeAi.ts` → `/api/recipe/ai`) is correct; it only needs the key set in Vercel Project Settings → Environment Variables (Production), then a redeploy.
> - **🎨 Paint-picker threads are the same UI area** (Pick & Paint modal + Stacking picker) mid-iteration — `YtOKfPcOmKxq` is now answered; `C3QMQBdYltw7`, `_aI8GvJu7Tc0` and `rcyKkEzZDs-k` still have a focused question posted, awaiting your call.

---

## 🔴 NEEDS YOUR CALL / ACTION (6)

### Blocked on infra — you (2)

- **`m65-f4O-Xi9p`** (/recipes) — "Anthropic API key not configured" when generating an AI paint scheme. **Not a bug.** Add `ANTHROPIC_API_KEY` to the **Production** env in Vercel and redeploy. Verified: `generateRecipe()` returns this exact string only when `process.env.ANTHROPIC_API_KEY` is unset.
- **`7RDcAE7fuDhY`** (/recipes) — duplicate of the above (same missing-key error). Clears the moment the key is set.

### Answered → ready to build (hands-on, not auto-shipped) (1)

- **`YtOKfPcOmKxq`** (/recipes · Pick & Paint · LIBRARY tab) — empty space below the FILTER list. **You picked option A:** matches list + company FILTER share the full panel height (~60/40, each scrolls internally). Not auto-shipped because it's a structural flex-height change across the shared `SlideOutPanel → PaintPickerPanel → ColorPicker` tree (same picker powers the Wheel tab + Stacking picker) — needs a hands-on build with a browser eyeball to avoid clipping/collapsing the list on some viewports.

### Need a design / sizing call — you (3)

_Paint-picker panels; each has a specific question posted on its thread, awaiting your answer._

- **`C3QMQBdYltw7`** (/recipes · Pick & Paint · WHEEL tab) — no matching-paints list on the WHEEL tab (it only exists on LIBRARY tab + Stacking picker). **Q:** add a live "paints matching this colour" list + company filter under the wheel, mirroring the Stacking picker?
- **`_aI8GvJu7Tc0`** (/recipes · Stacking paint picker) — FILTER section squashed at the bottom. **Q:** shrink the colour-wheel section to give the filter more height in place, or keep the wheel and let the panel scroll further to reach the full filter list?
- **`rcyKkEzZDs-k`** (/recipes/new · Pick & Paint · LIBRARY tab) — same empty-space-below-FILTER question as `YtOKfPcOmKxq`, raised on the `/recipes/new` route. **Q:** same option A vs B split — will apply your `YtOKfPcOmKxq` answer here too once the shared-picker layout build lands.

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `sFAkBUvAcSiF` | /collection auto-fill helper → persistent collapsible **Panel** section box (`TRACKING YOUR COLLECTION MADE EASY`), moved above the paste box; input copy → `Paste a URL to autofill…` — `src/components/collection/PasteUrlBar.tsx`, `src/lib/hooks/useAutoFillBoxCollapsed.ts` |
| `ra9QhujevTqM` | /collection "Auto-fills from…" paste-URL helper wrapped in a bordered box — `src/components/collection/PasteUrlBar.tsx` |
| `XvJwNsHNE89S` | Hero tagline glow intensified (five-layer) — re-landed on `main` through the gated loop |
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
