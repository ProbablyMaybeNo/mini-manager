# Vercel comments — Ross's decision queue

**Snapshot:** 2026-06-20 (run 2) · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**~18 unresolved threads** after this run. This is the single durable home for the "blocked" list — the `vercel-comment-loop` routine regenerates it each run (its NEEDS-ROSS output). Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (PR #43):** shipped 5 clear `/library` threads — `sscZQl83q23A` + `zK02tKyENQm3` (remove clipped SWATCHES/PAINTS label + bump LIBRARY subtitle), `o5znIgUUa5kB` (OWNED counter neon green), `vIHF_GBc6mqo` (COPY → green glyph), `7o0saVEXxaBJ` (standard +Wishlist button). Resolved after prod verify. Prior run's `iqf9wTFo-zHm` (dashboard Title +25%, PR #41) is now merged + live — resolved.

---

## ⭐ The one decision that unblocks the most: the body-font / readability cluster

Eight+ comments are the **same ask** — the "regular/body" text is too small and too pixelated; switch it to **Flexi IBM VGA True** and increase the size app-wide. Make this one call (Flexi for body text + a target size, e.g. 15–16px) and the routine can clear the whole cluster in one batch:

| Thread | Page | Ask |
|---|---|---|
| `D5rNizh_a_aV` | /focus | Flexi IBM VGA True for ALL regular text (notes, sub-titles, paste-URL, instructions) app-wide |
| `pj1NxDMT6Eeq` | /library | body font way too small → Flexi + bigger |
| `MXYr3npJ-vPG` | /recipes | colour-square font hard to read / too thin → non-pixelated, bold, easier-to-read face |
| `2Jw51D8ETR0t` | /focus | SESSION text "needs to be quite a bit bigger" |
| `e-j6I1OfIINp` | /recipes/[id] | "font size increase" |
| `aPHdSR4h7a_Z` | /recipes/[id] | "whole page font sizes increased" |
| `sEz1kM32vGbi` | /library | increase TYPE and HEX font size |
| `YYVDgCQcd0ma` | /tools/stacking | bigger fonts in the layering squares + colour selector |

**What I need from you:** (1) confirm Flexi IBM VGA True is the body face, (2) a target body size (or "match the dashboard title bump"), (3) is `font-mono`/VT323 staying anywhere, or does Flexi replace all body text?

---

## 🔴 BLOCKED — needs your call (beyond the font cluster)

| Thread | Page | Ask | Why blocked |
|---|---|---|---|
| `8AYy8A9H_J9L` | /dashboard | "decrease button to 68×68px" | Contradictory — those buttons already render ~28px; 68px would *enlarge* them and break the table row. Which button / which direction? |
| `wBJeqQHQLK4g` | /tools/dropper | ± dropper buttons (start at 3, add/remove); move Save/Send right | New feature — confirm scope |
| `C9gZQOzR7nUM` | /tools/match | "add one more brand so it's symmetrical" | Needs a brand + paint data from you |
| `RuYiw7plQqDV` | /focus | reorder recipe box → "RECIPE BOX" then "No Recipe Attached" (MM-22) | Awaiting your confirmation of exact order (I asked on the thread) |
| `7RFkgNxn5Cl6` | /library | colour-map overhaul: Flexi font, **circle/icon** OWNED/WISHLIST indicators with 1–2px black stroke (replace the "glitchy bars"), slightly bigger | Multi-part redesign — needs a design pass |
| `5qy6mswKnugb` | /recipes | "VT323 font needed" | Conflicts with the Flexi direction + your DePixel button ruling — clarify |

---

## 🟡 QUEUED — clear & actionable, the routine will handle (no input needed)

| Thread | Page | Change |
|---|---|---|
| `O9MuXo7ZQdM-` | /library | **Bug:** colour match shows wrong results (red selected → black/white matches) |
| `swThO7pd9NE4` | /recipes | decrease SHARE button font size |
| `44Ij8gQnqlHS` | /recipes | increase recipe-name size |
| `vIHF_GBc6mqo` | /library | change COPY to a neon-green icon/symbol |
| `o5znIgUUa5kB` | /library | make OWNED counter neon green |
| `7o0saVEXxaBJ` | /library | change button to standard **+WISHLIST** |
| `sscZQl83q23A` | /library | "PAINTS" label getting cut off → remove it |
| `zK02tKyENQm3` | /library | "SWATCHES" title cut off → remove; bump LIBRARY subtitle size |
| `EYIM_Wd9wKjl` | /library | type/hex columns colliding → space columns out |
| `S3lZ40vuocCL` | /projects | KPI → just the centered % *(routine flagged: re-pin — old layout)* |
| `UF5HOwXMpJxP` | /projects | section smaller + scrollable *(routine flagged: re-pin — old layout)* |

---

## 🟢 IN PROGRESS

| Thread | Page | Status |
|---|---|---|
| `iqf9wTFo-zHm` | /dashboard | Title column font +25% — **PR #41** (draft, gated; resolves once merged + live) |
