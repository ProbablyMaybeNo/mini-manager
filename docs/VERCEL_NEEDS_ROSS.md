# Vercel comments — Ross's decision queue

**Snapshot:** 2026-09-05 (cron pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Team:** `team_FqJjw2ukehBMlFAK8VePnElM` · **Prod:** mini-mainframe.com (Vercel alias)
**7 unresolved threads · 2 blocked on infra · 1 answered → held for hands-on build · 2 paint-picker layout/sizing calls · 1 duplicate awaiting your call · 1 NEW gallery clarification (asked this pass).** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-09-05 cron pass): 0 safe auto-fixes shipped — 1 new thread handled, no forced heartbeat deploy.**
> Re-listed all open toolbar threads (teamId `team_FqJjw2ukehBMlFAK8VePnElM` + projectId `prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`): **7 open**. Six carry a prior bot reply as their last message (no new user input) and were skipped as handled. **One is new — `37V2RAr4qw2f` (/gallery)** — asking to let users *manually type* the share-card details (name etc.) instead of only auto-populating from their projects. That's a net-new, unbounded feature (which fields? does a typed title also satisfy the "recipe must be named" gallery-submission guard?), **not** a clear/bounded safe auto-fix — so it was triaged **NEEDS CLARIFICATION**: replied on the thread with one specific question (which fields should become manually editable; flagged the gallery naming-guard interaction), left open, no commit.
> **Production is caught up:** the live **production** deployment is commit `38b2d31` (`docs(vercel-loop): 49th-firing heartbeat … (#244)`, target `production`, state `READY`, `ref=main`, aliased to `mini-mainframe.com` / `www.mini-mainframe.com`). No app behaviour changed this pass.
> **No self-merged heartbeat this pass** (continuing the prior 50th-firing run's call): a doc-only prod-pointer bump has no app value and each such merge becomes the next prod deploy — the loop would advance a pointer to itself forever. This doc refresh goes out as a **draft PR** for Ross, superseding the earlier draft **PR #245** (which predates the `/gallery` thread). The only work that could move production is real, in-scope fixes — there were none this pass.
> - **🔑 Two AI-recipe reports are one root cause:** the `ANTHROPIC_API_KEY` env var is missing from the **Production** environment. The code path (`src/lib/ai/recipeAi.ts` → `/api/recipe/ai`) is correct; it only needs the key set in Vercel Project Settings → Environment Variables (Production), then a redeploy.
> - **🎨 Three paint-picker threads are the same UI area** (Pick & Paint modal + Stacking picker). `YtOKfPcOmKxq` is **answered "option A"** but is a flex-height refactor of the *shared* `ColorPicker` (LIBRARY tab + Wheel tab + Stacking picker) — queued for a hands-on build + visual check, not a blind automated edit. `C3QMQBdYltw7` (Wheel tab) and `_aI8GvJu7Tc0` (Stacking picker) still need your call.
> - **🌀 Duplicate:** `rcyKkEzZDs-k` (/recipes/new) mirrors the `YtOKfPcOmKxq` LIBRARY-tab question — replied asking whether to track them together; left open.
> - **🖼️ New:** `37V2RAr4qw2f` (/gallery) — manual entry of share-card details; question posted, awaiting Ross's field list.

---

## 🔴 NEEDS YOUR CALL (7)

### Blocked on infra — you (2)

- **`m65-f4O-Xi9p`** (/recipes) — "Anthropic API key not configured" when generating an AI paint scheme. **Not a bug.** Add `ANTHROPIC_API_KEY` to the **Production** env in Vercel and redeploy. Verified: `generateRecipe()` returns this exact string only when `process.env.ANTHROPIC_API_KEY` is unset.
- **`7RDcAE7fuDhY`** (/recipes) — duplicate of the above (same missing-key error). Clears the moment the key is set.

### Answered → ready to build, held for a hands-on visual check (1)

- **`YtOKfPcOmKxq`** (/recipes · Pick & Paint · LIBRARY tab) — empty space below the FILTER list. **Answered: option A** — matches list + company FILTER share the full panel height (~60/40, each scrolls internally). Not shipped from the automated pass: it's a flex-height refactor of the *shared* `ColorPicker` (LIBRARY tab + Wheel tab + Stacking picker), where a wrong flex/min-height contract can collapse or clip the list on some viewports. Needs a hands-on build + browser eyeball, then the gated PR → CI → merge → prod-verify loop.

### Need a design / sizing call — you (2)

_Both are the paint-picker panels; each has a specific question posted on its thread._

- **`C3QMQBdYltw7`** (/recipes · Pick & Paint · WHEEL tab) — no matching-paints list on the WHEEL tab (it only exists on LIBRARY tab + Stacking picker). **Q:** add a live "paints matching this colour" list + company filter under the wheel, mirroring the Stacking picker?
- **`_aI8GvJu7Tc0`** (/recipes · Stacking paint picker) — FILTER section squashed at the bottom. **Q:** shrink the colour-wheel section to give the filter more height in place, or keep the wheel and let the panel scroll further to reach the full filter list?

### Duplicate — awaiting your call (1)

- **`rcyKkEzZDs-k`** (/recipes/new) — a single message echoing the `YtOKfPcOmKxq` LIBRARY-tab layout question, on the `/recipes/new` route. Replied asking whether anything about `/recipes/new` differs or if it can be tracked together with `YtOKfPcOmKxq`. Left open.

### New clarification — awaiting your call (1)

- **`37V2RAr4qw2f`** (/gallery) — "make it so users can manually enter all the details needed to share an image of their model… allow them to type in the name and details if they want." Today the **Share as card** composer (`src/components/recipe/ShareCardComposer.tsx`) already lets users edit the **photo** and **notes**, but the **title is locked** to the picked recipe's saved name, and a card whose recipe has no saved name is blocked from *Post to gallery* (only *Download* works). **Q posted:** which fields should become manually editable — just the title/name, or the title plus extra free-text lines (painter credit / subtitle)? And should a manually-typed title also let someone *Post to gallery* (that would change the "recipe must be named" submit guard), or is manual entry for *Download* only? Left open, no commit — it's a net-new feature, not a bounded safe auto-fix.

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
</content>
</invoke>
