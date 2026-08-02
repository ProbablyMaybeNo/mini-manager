# Vercel comments — Ross's decision queue

**Snapshot:** 2026-08-02 (cron pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**5 unresolved threads awaiting your call · 2 blocked on infra · 2 need a design/sizing call · 1 answered → ready for a hands-on build.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-08-02, second cron pass): 0 safe auto-fixes shipped.** All 5 open threads are either infra (a missing prod env var, which no repo change fixes) or paint-picker layout work where shipping blind would risk a wrong change to a shared core component. Each got a specific reply and was left open — none resolved.
> - **🔑 Two AI-recipe reports are one root cause:** the `ANTHROPIC_API_KEY` env var is missing from the **Production** environment. The code path (`src/lib/ai/recipeAi.ts` → `/api/recipe/ai`) is correct; it only needs the key set in Vercel Project Settings → Environment Variables (Production), then a redeploy.
> - **🎨 `YtOKfPcOmKxq` is now answered — Ross picked option A** (matches + company FILTER share the panel height, ~60/40, each scrolling internally). Not auto-shipped: it's a structural flex-height refactor of the *shared* `ColorPicker` (drives the Wheel tab + Stacking picker too), which can't be visually verified in an unattended pass — queued for a hands-on build + eyeball.
> - **🎨 Two paint-picker threads still need a call** (`C3QMQBdYltw7`, `_aI8GvJu7Tc0`) — same UI area, mid-iteration; one focused question posted on each, awaiting your answer.

---

## 🔴 NEEDS YOUR CALL (5)

### Blocked on infra — you (2)

- **`m65-f4O-Xi9p`** (/recipes) — "Anthropic API key not configured" when generating an AI paint scheme. **Not a bug.** Add `ANTHROPIC_API_KEY` to the **Production** env in Vercel and redeploy. Verified: `generateRecipe()` returns this exact string only when `process.env.ANTHROPIC_API_KEY` is unset.
- **`7RDcAE7fuDhY`** (/recipes) — duplicate of the above (same missing-key error). Clears the moment the key is set.

### Answered → ready for a hands-on build (1)

- **`YtOKfPcOmKxq`** (/recipes · Pick & Paint · LIBRARY tab) — empty space below the FILTER list. **Ross chose option A:** the matches list and company FILTER list flex to share the full panel height (~60/40), each scrolling internally. **Why not auto-shipped:** this is a structural height-flow refactor across `SlideOutPanel → PaintPickerPanel → ColorPicker`, and `ColorPicker` is shared with the Wheel tab and the Stacking picker. A wrong flex/`min-height` contract can collapse or clip the list on some viewports, and an unattended pass has no way to eyeball it — so it needs a hands-on build + browser check before it ships. Scope note: the library-only flex layout should be gated to the exact `showLibrary && !showWheel && !showEyedropper` combo (only the LIBRARY tab) so the stacked and Wheel-tab layouts stay untouched.

### Need a design / sizing call — you (2)

_Both are paint-picker panels; each has a specific question posted on its thread, awaiting your answer._

- **`C3QMQBdYltw7`** (/recipes · Pick & Paint · WHEEL tab) — no matching-paints list on the WHEEL tab (it only exists on LIBRARY tab + Stacking picker). **Q:** add a live "paints matching this colour" list + company filter under the wheel, mirroring the Stacking picker?
- **`_aI8GvJu7Tc0`** (/recipes · Stacking paint picker) — FILTER section squashed at the bottom. **Q:** shrink the colour-wheel section to give the filter more height in place, or keep the wheel and let the panel scroll further to reach the full filter list?

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
