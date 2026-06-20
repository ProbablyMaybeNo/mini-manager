# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-20 (run 3) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**16 unresolved threads** after this run. This is the single durable home for the "blocked" list — the `vercel-comment-loop` routine regenerates it each run (its NEEDS-ROSS output). Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run:** shipped 3 clear fixes — `O9MuXo7ZQdM-` (library colour-match bug: red was matching black/white — now perceptual ΔE2000), `44Ij8gQnqlHS` (bigger recipe-name font on /recipes), `sEz1kM32vGbi` (bigger TYPE/HEX values in the library paint panel). Resolved after prod verify. Replied on every remaining open thread with one specific question; they stay open pending your call.

---

## ⭐ The one decision that unblocks the most: the body-font / readability cluster

Eight comments are the **same ask** — the "regular/body" text is too small and too pixelated; switch it to **Flexi IBM VGA True** and increase the size app-wide. I can't do this autonomously: **the font file isn't in the repo** and the magnitude is unspecified. Make this one call (Flexi for body text + a target size, e.g. 15–16px, and drop the woff2/ttf into the repo) and the routine can clear the whole cluster in one batch:

| Thread | Page | Ask |
|---|---|---|
| `D5rNizh_a_aV` | /focus | Flexi IBM VGA True for ALL regular text (notes, sub-titles, paste-URL, instructions) app-wide |
| `pj1NxDMT6Eeq` | /library | body font way too small → Flexi + bigger |
| `MXYr3npJ-vPG` | /recipes | colour-square font hard to read / too thin → non-pixelated, bold, easier-to-read face |
| `2Jw51D8ETR0t` | /focus | SESSION text "needs to be quite a bit bigger" |
| `e-j6I1OfIINp` | /recipes/[id] | "font size increase" (no element/target named) |
| `aPHdSR4h7a_Z` | /recipes/[id] | "whole page font sizes increased" |
| `YYVDgCQcd0ma` | /tools/stacking | bigger fonts in the layering squares + colour selector |
| `swThO7pd9NE4` | /recipes | decrease SHARE button font *(opposite direction, same readability theme)* |

**What I need from you:** (1) confirm Flexi IBM VGA True is the body face **and commit the font file**, (2) a target body size (or "match the dashboard title bump"), (3) is `font-mono`/VT323 staying anywhere, or does Flexi replace all body text? For `swThO7pd9NE4`: all buttons currently share one font token by design — confirm you want to break that for just the SHARE button, and a target px.

---

## 🔴 BLOCKED — needs your call (beyond the font cluster)

| Thread | Page | Ask | Why blocked |
|---|---|---|---|
| `8AYy8A9H_J9L` | /dashboard | "decrease button to 68×68px" | Contradictory — those buttons already render ~28px; 68px would *enlarge* them and break the table row. Which button / which direction? (asked on thread) |
| `wBJeqQHQLK4g` | /tools/dropper | ± dropper buttons (start at 3, add/remove); move Save/Send right | New feature — confirm scope (asked on thread) |
| `C9gZQOzR7nUM` | /tools/match | "add one more brand so it's symmetrical" | Needs a brand + paint data from you |
| `RuYiw7plQqDV` | /focus | reorder recipe box → "RECIPE BOX" then "No Recipe Attached" (MM-22) | Awaiting your confirmation of exact order (asked on thread last run) |
| `7RFkgNxn5Cl6` | /library | colour-map overhaul: Flexi font, **circle/icon** OWNED/WISHLIST indicators with 1–2px black stroke (replace the "glitchy bars"), slightly bigger | Multi-part redesign — needs a design pass |
| `EYIM_Wd9wKjl` | /library | "space all the columns out" (type/hex collide, big name→brand gap) | Bounded direction but no target widths — confirm specific column widths or which to widen (asked on thread) |
| `UF5HOwXMpJxP` | /projects | section "way smaller + scrollable" | Pinned selector points at an old /projects layout — confirm which section on the current page (asked on thread) |
| `S3lZ40vuocCL` | /projects | KPI → just the centered % | Pinned to an old layout + refers to Figma group 20 — confirm against the current page (asked on thread) |

---

## 🟢 SHIPPED THIS RUN (resolved after prod verify)

| Thread | Page | Change |
|---|---|---|
| `O9MuXo7ZQdM-` | /library | **Bug fix:** colour match was hue-only (red → black/white); now perceptual CIEDE2000 |
| `44Ij8gQnqlHS` | /recipes | recipe-name font `text-sm` → `text-base` |
| `sEz1kM32vGbi` | /library | TYPE + HEX value font `text-sm` → `text-base` |
