# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-08 (cron pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**1 unresolved thread awaiting your call · 0 blocked.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-08, cron pass): queue is essentially clear — nothing to auto-fix, one thread waiting on you.**
> - The only unresolved Mini Manager thread is `sFAkBUvAcSiF` (/collection), and it already carries a clarifying question from an earlier run — no new action, listed below so it doesn't get lost.
> - **🟢 The `main` merge gate is GREEN again.** The 5 auth/billing Playwright E2E failures that blocked *every* fix from merging (documented in the 2026-07-08 morning pass — `qa_credentials_signup`, `qa_credentials_signin`, `qa_billing_upgrade`) now pass on `main` HEAD `e164f38`. Both CI jobs (Typecheck/unit/integration/build **and** Playwright E2E) are green. The signup redirect / email-verification work landed via `#115`/`#116` and the surrounding commits. Fixes can merge again.
> - Since the gate reopened, the whole prior backlog cleared: the 6 threads that were on this list (`-D41OlDEcOYF`, `7rH5cPa-w3PQ`, `T9TlAL3KQ3GX`, `APNNqpJtZIeH`, `tSx5YUJMik8i`, `O2QLNGljsS1A`) and the BLOCKED item `1e6NuOqXabYV` (PR #110) are all off the unresolved list. Nothing carried over except the one thread below.

---

## 🔴 NEEDS YOUR CALL (1)

| Thread | Page | Ask | The one thing I need from you |
|---|---|---|---|
| `sFAkBUvAcSiF` | /collection | Restyle the "Auto-populate…" paste-URL helper into the same bordered section box the project page uses, move it **above** the URL paste box, and make it collapsible with a slide-out toggle. | Two things, then I ship it: **(1) Desktop toggle behaviour** — collapsed by default (toggle slides it open, saves space) **or** open by default (toggle just hides it)? The project-page `CollapsibleSection`s are always expanded on desktop, so I need your pick. **(2) Notch label** — `AUTO-FILL` or `SUPPORTED STORES`? |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
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
