# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-21 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**2 unresolved threads** need your call after this run. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-06-21):** shipped 3 clear, bounded fixes and resolved them after prod verify — `JZBOMvZVuFFf` (pure-black canvas to match the logo), `NVOzFLAjh-vq` (drop the redundant "X/Y models" line under the dashboard progress bars), `oRc-Pp1u9Gsk` (stop the first activity-tracker row clipping). Two threads stay open pending your input (below).

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `aANKU9jIO6ih` | /focus | Separate the PROGRESS "x/100" numbers into their own font group and bump them to 18px | **Confirmed:** they share the `num2` category (VT323, ~15.5px) with the calendar day numbers — *and* the projects-table Time column and the progress-bar % labels, so I can't just bump `num2` globally without enlarging all of those. Asked: OK to add a dedicated token (same VT323 face) at 18px for the focus stat only? |
| `0Uwugdcrguxb` | /focus | "Not letting me change my focus using the dropdown." | A functional bug I can't reproduce confidently from source (the Listbox + URL-driven focus look wired correctly). Asked: when you pick a different project, does the menu not open, do the options not click, or does it select but the bench header not update? |

---

## 🟢 SHIPPED THIS RUN (resolved after prod verify)

| Thread | Page | Change | Files |
|---|---|---|---|
| `JZBOMvZVuFFf` | /focus | `--color-bg` `#06080a` → `#000000` so body + sidebar + page read true black (logo art samples #000000) | `src/app/globals.css` |
| `NVOzFLAjh-vq` | /dashboard | Removed the "X/Y models" line beneath each PROJECTS progress bar — bar + % only | `src/components/dashboard/ProjectsTable.tsx` |
| `oRc-Pp1u9Gsk` | /dashboard | Added `pt-1` to the ACTIVITY TRACKER scroll container so the first row stops clipping | `src/components/dashboard/RightRail.tsx` |
