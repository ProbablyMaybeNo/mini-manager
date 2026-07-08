# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-08 (cron pass) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app (live alias: mini-mainframe.com)
**1 unresolved thread — awaiting your call.** This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-08, cron pass): shipped 0, posted 1 new clarifying question.**
> - Only **one** un-handled open thread this pass. Every other previously-open thread has been resolved since the last snapshot (see below).
> - Posted a clarifying question on `sFAkBUvAcSiF` (/collection) — "make the paste-URL helper look like the project-page rectangle sections, persistent with a slide-out toggle, moved above the paste box." The visual reference (project-page `CollapsibleSection`, cyan-bordered notched-label boxes) is clear, but two things aren't: the **desktop toggle behaviour** (those sections are always-expanded on desktop; the chevron only collapses on mobile — so "persistent slide-out toggle" needs a call: collapsed-by-default vs open-by-default) and the **notch label** text. Also, that box currently doubles as the paste input's `aria-describedby` unsupported-store warning, so the restyle has to preserve that. Left the thread **open**.
>
> **✅ Repo-wide CI blocker CLEARED.** The earlier 2026-07-08 pass flagged `main`'s merge gate as red on 5 pre-existing auth/billing Playwright E2E tests, jamming the whole auto-fix pipeline. That is fixed: `1e6NuOqXabYV` (DASHBOARD→PROJECTS) landed as **PR #110** which also repaired the post-signup / paid-upgrade E2E flows, and `main` has since advanced cleanly through **#111–#116** (now at `e164f38`). The merge gate is healthy again — future clear-and-bounded fixes can go through the gated loop and merge on green.
>
> **The 6 threads that were awaiting your call last snapshot are all resolved now** — `-D41OlDEcOYF`, `7rH5cPa-w3PQ`, `T9TlAL3KQ3GX`, `APNNqpJtZIeH`, `tSx5YUJMik8i`, `O2QLNGljsS1A` no longer appear in the unresolved list. Dropped from the table; the queue is down to the single new item above.

---

## 🔴 NEEDS YOUR CALL (1)

| Thread | Page | Ask | The one thing I need from you |
|---|---|---|---|
| `sFAkBUvAcSiF` | /collection | "Make the 'Auto-populate…' paste-URL helper look like the same rectangle sections on the project page (same colour/format), persistent with a slide-out toggle — you could even move it above the URL paste box." | **(1)** Desktop toggle behaviour — the project-page section boxes are always expanded on desktop (chevron only collapses on mobile). Do you want this box **collapsed by default** with a toggle to open it, or **open by default** with a toggle to hide it? **(2)** What label goes in the notch — `AUTO-FILL`, `SUPPORTED STORES`, or something else? Answer those two and I'll ship it (cyan-bordered `CollapsibleSection` style, moved above the paste box). |

---

## 🟢 Recently shipped & resolved (context)

Landed on `main` and resolved after prod verify — kept here only so the loop doesn't re-open them:

| Thread | Change |
|---|---|
| `1e6NuOqXabYV` | Renamed the DASHBOARD label → PROJECTS app-wide + repaired the auth/billing E2E gate — PR #110 |
| `XeheRPMOLslU` | /tools/match reuses the shared recipe PAINT PICKER PANEL for COLOR MATCH — PR #111 |
| `-D41OlDEcOYF` / `7rH5cPa-w3PQ` | Filter-placement cluster (shared `ColorPicker`) — resolved |
| `T9TlAL3KQ3GX` | /tools/wheel per-slot lock icon — resolved |
| `APNNqpJtZIeH` | /tools/match GENERATE behaviour — resolved |
| `tSx5YUJMik8i` / `O2QLNGljsS1A` | /tools/wheel GENERATE RECIPE / SLOTS controls — resolved |
| `ra9QhujevTqM` | /collection "Auto-fills from…" paste-URL helper wrapped in a bordered box — `src/components/collection/PasteUrlBar.tsx` |
| `XvJwNsHNE89S` | Hero tagline glow intensified (five-layer) — PR re-landed on `main` |
| `WcnTP2Vzy1hM` | Library list-view sticky header made fully opaque (`bg-bg/95` → solid) — PR #91 (`de3b6fe`) |
| `C3ygtbGZufsu` | Homepage hero tagline → bright neon green (`#39ff14`) + subtle glow — PR #92 (`f4c2de7`) |
| `g_ypRnCdHcCC` | Stacking page blurb "…stack on a **substrate**" → "…stack on an **undercoat**" |
| `glGmhi0OxcAF` | Colour-wheel disclosure label "**More matches** (N)" → "**Matches** (N)" |
| `qYDF4_PrSnyZ` | Library paint side-panel recipe chips recoloured cyan → **neon green** |
| `qQ647hi5H2_W` | Added UNDERCOAT to the recipe step/layer technique picker (SlotRow) |
| `NY5ieezHa3ag` / `W0TJnSWm38nP` | Recipe "+ ADD STEP" button → "+ ADD PAINT" (both editors) — PR #84 |
| `s6zlyxVZ9-cI` | Stacking blurb "over a substrate" → "over an undercoat" — PR #84 |
| `Tcylyd5enVXT` / `Z2r21cCQAPQr` / `8myNPt4auK8V` | Landing/pricing colour fixes — PR #82 |
| `yT9vvxQhK3Ce` | Library TYPE filter facet |
