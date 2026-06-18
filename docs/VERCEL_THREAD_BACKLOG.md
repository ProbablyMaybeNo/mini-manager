# Vercel Preview Comment Backlog

Complete inventory of **all 93 unresolved Vercel toolbar threads** on the
`mini-manager` project (snapshot 2026-06-18, team `rkhilarysignups-8609s-projects`).

## Why this exists

Investigating "comments get answered but never completed" found the root cause:
an agent committed fixes to throwaway `claude/*` preview branches, replied
"✅ Fixed — preview READY", and the threads were marked resolved — but the
branches never merged to `main`, so production never changed. See
`docs/AGENT_ONBOARDING.md` → *Responding to Vercel preview comments* for the
corrected loop (PR → CI gate → merge → verify prod → **then** resolve).

This backlog makes every outstanding thread trackable so each one goes through
that loop instead of evaporating on a preview branch.

## Status — verify-and-resolve COMPLETE, 2026-06-18

All 93 threads triaged: a manual landing-page pass plus a 12-agent verification workflow that checked every remaining thread against shipped `main` source. **77 of 93 resolved** (each closed with a file-level citation, not a preview claim). **16 remain open** — the genuinely-outstanding work.

**Headline finding:** ~80% of "open" threads were **already built and just never marked resolved** — including items that *read* as unbuilt features. The dropper (`EyedropperTool.tsx`, MM-34), stacking/layering (`LayeringTool.tsx`, MM-35), colour-wheel rebuild (`ColourWheelTool.tsx`, MM-53/29) and the recipe slide-out picker (`RecipePaintPicker.tsx`, MM-25/UX-002) were all shipped after their comments. This was overwhelmingly a *tracking* failure, not a backlog of unbuilt work. Root cause fixed in `docs/AGENT_ONBOARDING.md` (gated PR→merge→verify→resolve loop).

### The 16 still open

**Small real changes / awaiting input (7):**
- `6hWtJA2oArmz` — stat-box colours done; **follow-up** (bigger numbers + Figma font) not done.
- `KOdXd3JTo7rS` — three-tier font *structure* shipped, but the **specific named fonts** (UAV OSD Mono / 3d PIXEL / Flexi IBM VGA True) and the **app-wide size increase** need Ross to supply the woff2/ttf files + a target size.
- `fZRWinmZ-syG` — +ATTACH should open a recipe dropdown (with +New) to attach without leaving the page.
- `RG-egS3QAoBi` — name an uploaded army-list before import + port model count/type into the table.
- `S3lZ40vuocCL` — projects KPI: strip to just the centered percentage / more stylistic.
- `UF5HOwXMpJxP` — make a `/projects` section smaller + scrollable.
- `yO830AqQH3Hu` — move the "Jun 2026" label between the calendar arrows (minor).

**Need a visual/screenshot check — can't confirm from source (7):**
`8TkHnT9drEl2` (remove which section?), `FZj63NkdAnZb` (remove which paint-table element?), `Jqx4pDn-NWw1` (recolour which element?), `hA-bzgS5S98r` (remove which redundant section?), `lq5hIKKHJdVT` (remove what?), `RuYiw7plQqDV` (focus recipe-box label order), `TmE3k580uZWc` (planner progress bars per Figma group 21).

**Page-scale redesign — needs a design pass first (2):**
`ORZm2dlzzxzq` and `vYOtzW8W9ciB` — the `/planner` full UI rethink.

> Process going forward: any new work on these goes through the gated loop (`fix/`-branch → PR → CI → merge → verify prod → reply + resolve). Don't resolve on a preview.

---

## `/` Landing page (14) — almost all copy/logo, likely already shipped

PR #21's audit (against the redesign merge) marked the landing copy ADDRESSED. **[VERIFY]** the whole group against prod, then bulk-resolve.

- `63comR8WGVsR` [VERIFY] — make the logo much bigger (MINI-MANAGER legible)
- `yIZBV2hJ4qG6` [VERIFY] — drop standalone title once logo carries it
- `c2Esss4Nv_v0` [VERIFY] — move boot animation inside the enlarged logo screen
- `8rIb9a7igtpf` [VERIFY] — tagline "Plan your projects…", bigger/stylized font
- `QrK3Ykfe7gxE` / `wweE4LkFYuNx` [VERIFY] — button text → "Start for Free"
- `REDm6lZkDER_` [VERIFY] — founders/limited-availability CTA copy
- `TXM5r--ty4sN` [VERIFY] — rename section "COLLECTION" + blurb
- `L2LWViG2-aLL` [VERIFY] — Project Dashboard title + blurb
- `XCq8tO2uAdY2` [VERIFY] — planner blurb (tournaments/deadlines/calendar)
- `eVjJtXB_lzsq` [VERIFY] — FOCUS title + productivity blurb
- `j5IyakoOYf7A` [VERIFY] — library blurb "7,144 paints…"
- `BjDVvGo-nE69` [VERIFY] — "Pick your paints… share with friends" copy
- `wN7EEyF5wylb` [VERIFY] — remove the secondary hero button

## `/dashboard` (13)

- `pfKcweyeSrWA` ✅ DONE (PR #25, resolved) — Terrain accent → red
- `6hWtJA2oArmz` [VERIFY] — per-box tracker colours (statBoxAccents shipped)
- `yJjhcE5bnaza` [VERIFY] — colour-code activity types from the style guide
- `PDySWAZSgoay` [VERIFY] — click calendar day → opens +Date prefilled
- `WVWX39228b0k` [VERIFY] — popup date-picker on the date field
- `fZRWinmZ-syG` [FIX] — + ATTACH button → app purple (re-asked "a million times")
- `OR6fdfRMMIPu` [FEATURE] — add sub-projects (units under army, models under unit)
- `_2VtJQotFMIe` [FEATURE] — way to track a project's progress
- `RG-egS3QAoBi` [FEATURE] — name an uploaded army-list before import; port model count + type into the table
- `YJeJmTj6xc0Y` [FEATURE] — schedule events/tournaments/deadlines via the calendar
- `2FW4v62uniS5` [FIX] — add the Figma activity-tracker icons
- `KOdXd3JTo7rS` [FIX] — app-wide font pass (UAV OSD Mono for headers/menu/section)
- `yO830AqQH3Hu` [FIX] — move "Jun 2026" between the calendar arrows, not below

## `/projects` (16)

- `vZsXjhzZaj22` [FIX] — background → solid black
- `JRH4S-NKjwjl` [FIX] — project name text → white (readable vs the TYPE accent)
- `bKcNYALyGZ-t` [FIX] — PURCHASED element → neon green; rename to OWNED
- `C_T1fX-q-B9W` [FIX] — solid progress bar (GOLDEN STANDARD ref image)
- `JxHyrHyQm8h1` [FIX] — tracker numbers centered, numerals only (01, 02…)
- `4g3IE20foZSZ` [FIX] — center the title and "0m"
- `SrUlN-A40kgh` [FIX] — one border thicker than the others
- `qHYZNwc8UHQk` [FIX] — drop the bottom of all 4 tracker cards, keep title+number
- `r-N-8lHdYTyl` [FIX] — make the calendar WAY smaller (ref attached)
- `UF5HOwXMpJxP` [FIX] — make a section much smaller + scrollable
- `drevz4sd58tK` [FIX] — drop the text bar if "NEW PROJECT" button exists
- `hA-bzgS5S98r` [FIX] — remove a redundant section
- `8TkHnT9drEl2` [FIX] — remove a section (can re-add later)
- `ovBXfJWDLMn7` [VERIFY] — make the logo bigger (legible)
- `S3lZ40vuocCL` [REDESIGN] — more stylistic (Figma group 20 / moodboard)
- `wwiRkmlTX1qp` [FIX] — terminal/retro font instead of arcade (font pack added)

## `/wishlist` (11) — flagged as broadly unfinished

- `0rPSRZogS7ix` [FIX] — wishlist button → yellow; click does nothing; clarify counter
- `R4938tQghFQK` [FIX] — add button → match the app's button styles
- `wyeWvL6goRGH` [FIX] — replace dropdown with one listing active projects
- `KpdEPo3KJr3r` [FIX] — Filters panel: clarify which table; move Filter to a button
- `FZj63NkdAnZb` [FIX] — remove a column from the paint table
- `lq5hIKKHJdVT` [FIX] — remove an unknown element
- `2OWFoagGltwl` [FEATURE] — denote item kind (box/bits/paint/tool) to drive filters
- `8PrFCca1ZYBw` [FEATURE] — "RECIPE" column showing recipes a paint is attached to
- `EJnqEGcpmnkD` / `nwVv41uZ4y1X` [FEATURE] — bottom stats overview bar (collection totals)
- `77YGgp1xyl8f` [FIX] — tables cut off at the top / too short / forced scroll
- `5smqxhn3hp2D` [REDESIGN] — page looks unfinished, needs a rethink

## `/recipes` + recipe detail (12)

- `JlrBYUITMqoa` [VERIFY] — all + buttons neon green (except wishlist) — UX-001 shipped
- `FEtdr2muxDWt` [FEATURE] — click a recipe-table row → open the recipe page
- `5gi2AXAYb9el` [FIX] — text box de-selects on every keystroke (input bug)
- `XBqE3QWDGUsW` / `l9-EpV22mrgx` / `C1Dj9tlm_zMl` [FIX] — bigger recipe-table swatch squares with paint name inside
- `-zP2IBqKlwTs` [FIX] — square layout: company top, name center, layer bottom (b/w)
- `-bxkXH8bgcNR` [FIX] — shorten Notes section to match recipe slots
- `ndZ9hE2Dgbqj` [FIX] — remove inspo section from the recipe creator
- `luPYg1TbETRy` [FIX] — fill the empty space on the recipe detail page
- `zfnUzPyTp2De` / `DJIASK6DXP49` [FIX] — borders too thick / pixel art too blocky
- `DJHI5xdCDBze` [FEATURE] — restore old slide-out side panel (wheel + match + dropper) on recipe creation
- `RbRsabgbCFGR` [FIX] — image URL via inspiration paste doesn't render

## `/tools` + tool pages (9)

- `USx5rvtrvdGD` [VERIFY] — Match "assign" button → pastel purple (MM-33 shipped)
- `lRmu1mjMhc1Y` [VERIFY] — Match bars: add "NN% colour match" label (MM-31 shipped)
- `_TqzGP_4Ge3U` [FEATURE] — colour-harmony modes in the Match tool
- `SKZvvuFMWO7I` / `XWzPP7o_zPJK` [FEATURE/REDESIGN] — rebuild the colour wheel from the old app
- `ub2Xvf4L2mok` [FEATURE] — build the Dropper tool (port from old app)
- `jlyL9VSmBMdA` [FEATURE] — build the Stacking tool (port from old app)
- `p9DIDcsozQYM` [VERIFY] — better tool thumbnails (PNG thumbnails shipped via PR #23)
- `Q6fs2DHiGvnM` [FIX] — body font → IBM Plex Mono / JetBrains, app-wide

## `/planner` (5) — page-scale rework

- `vYOtzW8W9ciB` / `ORZm2dlzzxzq` [REDESIGN] — full UI redesign of the planner
- `TmE3k580uZWc` [FIX] — progress bars per Figma group 21
- `ZsWmymCpw3Wx` [FIX] — shrink INSPO to thumbnails that open a popup overlay
- `A5qzbPnMzfVH` [FIX] — split the stopwatch into its own section

> Note: `/planner` was folded into the dashboard in a later phase (`f7017e1`). Confirm whether these threads still apply or are obsolete.

## `/focus` (3)

- `Tf4DQgqWUp7C` [FEATURE] — pick a project from the table to "focus on"
- `TnEMMzwgjnul` [FEATURE] — focus content updates with the chosen project
- `RuYiw7plQqDV` [FIX] — swap recipe-box label/text order (RECIPE BOX then status)

## `/library` (5) — "one of the only decent pages"

- `NzVQI3ESFmK0` [VERIFY/RESOLVE] — positive feedback only, no action → resolve
- `-GJphTRItErU` [VERIFY] — make the logo image bigger (legible)
- `0rPSRZogS7ix` — (see /wishlist; same wishlist-button ask)
- `Jqx4pDn-NWw1` [FIX] — recolour an element to a brand colour (green/cyan)
- `hASzc6IbhvUc` [FIX] — fit the whole colour map in the side panel without scroll

## `/collection` (3)

- `gMWAXp8F7Ydr` [FIX] — toggles: purple outline + purple text; active = pastel purple fill
- `saHWeY2Y7_kY` [FIX] — pasting a model URL adds to the paint table, not model table (bug)
- `Jo7RaPrtjFIg` [FEATURE] — restrict auto-populate to supported stores + signal which

---

## Rough shape

- **~25 [VERIFY]** — likely already shipped (esp. all of `/`, several dashboard/recipe/tools colour items); confirm in prod then bulk-resolve.
- **~40 [FIX]** — small, real, gateable changes (colours, layout, copy, a couple of input bugs).
- **~20 [FEATURE]** — net-new builds (sub-projects, calendar scheduling, army-list naming/import, recipe click-through, harmony modes, rebuild dropper/stacking/wheel tools).
- **~8 [REDESIGN]** — page-scale reworks (`/planner`, `/wishlist`) needing a design pass first.

The two highest-leverage real features by repeat mention: **sub-projects** (`OR6fdfRMMIPu`) and the **army-list naming + model/type import** (`RG-egS3QAoBi`).
