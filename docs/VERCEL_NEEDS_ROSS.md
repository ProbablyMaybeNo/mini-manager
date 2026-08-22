# Vercel comments — Ross's decision queue

**Snapshot:** 2026-08-22 (cron pass, 46th firing) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** mini-mainframe.com (Vercel alias)
**6 unresolved threads · 2 blocked on infra · 3 paint-picker layout (1 answered → held for hands-on build) · 1 duplicate awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-08-22, cron pass — 46th firing): 0 safe auto-fixes shipped — state unchanged.** Re-listed all open threads (teamId + projectId): the same 6 remain, each already carrying a prior bot reply (last message on every thread is the bot's — no new user input), all skipped as handled; no new un-handled thread arrived. Production has advanced: the current live **production** deployment is commit `acdd013` (`docs(vercel-loop): 45th-firing heartbeat … (#240)`, target `production`, state `READY`, `ref=main`, aliased to `mini-mainframe.com` / `www.mini-mainframe.com`) — the pipeline is caught up (advanced the recorded prod pointer here from `30ec068` to `acdd013`; the lag is inherent, as each heartbeat doc-merge itself becomes the next prod deploy). No app behaviour changed this pass. The open work is unchanged: infra (a missing prod `ANTHROPIC_API_KEY`, no repo change fixes it) or shared-component (`ColorPicker`) flex-height layout tuning that must not be shipped blind from an unattended pass.
> - **🔑 Two AI-recipe reports are one root cause:** the `ANTHROPIC_API_KEY` env var is missing from the **Production** environment. The code path (`src/lib/ai/recipeAi.ts` → `/api/recipe/ai`) is correct; it only needs the key set in Vercel Project Settings → Environment Variables (Production), then a redeploy.
> - **🎨 Three paint-picker threads are the same UI area** (Pick & Paint modal + Stacking picker). `YtOKfPcOmKxq` is now **answered "option A"** but is a flex-height refactor of the *shared* `ColorPicker` (LIBRARY tab + Wheel tab + Stacking picker) — queued for a hands-on build + visual check, not a blind automated edit. The other two still need your call.
> - **🌀 New duplicate:** `rcyKkEzZDs-k` (/recipes/new) mirrors the `YtOKfPcOmKxq` LIBRARY-tab question — replied asking whether to track them together; left open.

---

## 🔴 NEEDS YOUR CALL (6)

### Blocked on infra — you (2)

- **`m65-f4O-Xi9p`** (/recipes) — "Anthropic API key not configured" when generating an AI paint scheme. **Not a bug.** Add `ANTHROPIC_API_KEY` to the **Production** env in Vercel and redeploy. Verified: `generateRecipe()` returns this exact string only when `process.env.ANTHROPIC_API_KEY` is unset.
- **`7RDcAE7fuDhY`** (/recipes) — duplicate of the above (same missing-key error). Clears the moment the key is set.

### Answered → ready to build, held for a hands-on visual check (1)

- **`YtOKfPcOmKxq`** (/recipes · Pick & Paint · LIBRARY tab) — empty space below the FILTER list. **Answered: option A** — matches list + company FILTER share the full panel height (~60/40, each scrolls internally). Not shipped from the automated pass: it's a flex-height refactor of the *shared* `ColorPicker` (LIBRARY tab + Wheel tab + Stacking picker), where a wrong flex/min-height contract can collapse or clip the list on some viewports. Needs a hands-on build + browser eyeball, then the gated PR → CI → merge → prod-verify loop.

### Need a design / sizing call — you (2)

_Both are the paint-picker panels; each has a specific question posted on its thread._

- **`C3QMQBdYltw7`** (/recipes · Pick & Paint · WHEEL tab) — no matching-paints list on the WHEEL tab (it only exists on LIBRARY tab + Stacking picker). **Q:** add a live "paints matching this colour" list + company filter under the wheel, mirroring the Stacking picker?
- **`_aI8GvJu7Tc0`** (/recipes · Stacking paint picker) — FILTER section squashed at the bottom. **Q:** shrink the colour-wheel section to give the filter more height in place, or keep the wheel and let the panel scroll further to reach the full filter list?

### New duplicate — awaiting your call (1)

- **`rcyKkEzZDs-k`** (/recipes/new) — a single message echoing the `YtOKfPcOmKxq` LIBRARY-tab layout question, on the `/recipes/new` route. Replied asking whether anything about `/recipes/new` differs or if it can be tracked together with `YtOKfPcOmKxq`. Left open.

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
