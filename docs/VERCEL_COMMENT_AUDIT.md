# Vercel Preview Comment Audit — `mini-manager`

Audited against merged tree at commit `7577a30` (branch `claude/integration-redesign`, = PR #20 to `main`). Classification reflects what the shipped code actually implements, not whether the Vercel thread was clicked "resolve."

## Summary

- **Total threads:** 98
- **ADDRESSED:** 86
- **PARTIAL:** 9
- **PENDING:** 3
- **Already resolved in Vercel:** 9 (all ADDRESSED — the MM-27/32/37/38/41/42/43/44/48 ship-confirmed color/text tweaks)

PARTIAL/PENDING are concentrated in: the app-wide "green + button" rule (built but not rolled out), focus per-project time, the recipe-table side-panel port, planner stylistic/figma asks, the collection project-dropdown element, the paint "type" column, and two unidentifiable "remove this" notes.

---

## `/` — Landing page (`src/components/public/LandingView.tsx`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | QrK3Ykfe7gxE | Button text → START FOR FREE | "Start for Free" in LandingView |
| ADDRESSED | REDm6lZkDER_ | Founders/limited-availability CTA copy | exact copy present in final CTA |
| ADDRESSED | XCq8tO2uAdY2 | Planner blurb (tournaments/deadlines/calendar) | exact copy present |
| ADDRESSED | eVjJtXB_lzsq | Focus title + productivity blurb | Focus card reworded (commit db754d4) |
| ADDRESSED | TXM5r--ty4sN | Rename section COLLECTION + blurb | exact copy present |
| ADDRESSED | L2LWViG2-aLL | Project Dashboard title + blurb | reworded (2fca1eb/8904cfb) |
| ADDRESSED | BjDVvGo-nE69 | "Pick your paints…share with friends" copy | Color-tools card reworded (e812c4c/412450f) — intent captured |
| ADDRESSED | j5IyakoOYf7A | Library blurb "7,144 paints…" | exact copy present |
| ADDRESSED | wN7EEyF5wylb | Remove this button | secondary hero button removed |
| ADDRESSED | wweE4LkFYuNx | Button text → Start for Free | present |
| ADDRESSED | c2Esss4Nv_v0 | Move animation inside enlarged logo, drop section | BootSequence overlay inside Logo(size 320) |
| ADDRESSED | yIZBV2hJ4qG6 | Drop title section once logo enlarged | standalone heading removed; title in logo |
| ADDRESSED | 8rIb9a7igtpf | Tagline + bigger/stylized font | "Plan your projects…" font-display + glow |
| ADDRESSED | 63comR8WGVsR | Make logo much bigger | hero Logo size=320 (commit 019f139) |

## `/dashboard` (`src/components/dashboard/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | RgS1wwnBvIIT | MM-50 enlarge sidebar logo | Logo size=140 in SidebarRail (019f139) |
| ADDRESSED | 6hWtJA2oArmz | MM-49 per-box tracker colors | statBoxAccents in palette.ts (6925ecb) |
| ADDRESSED | PDySWAZSgoay | MM-47 click calendar day → +Date prefilled | PlannerCalendar.openAddForDay (94a3eb9) |
| ADDRESSED | WVWX39228b0k | MM-46 popup date-picker | MiniCalendar popover on date field |
| ADDRESSED | yJjhcE5bnaza | MM-45 color-code activities | activityAccent map in ActivityFeed |
| ADDRESSED | _2VtJQotFMIe | How to track project progress? | ProgressBar + "n/N models" in ProjectsTable |
| ADDRESSED | Q-13AAVj14Bm | Missing sub-project dropdown arrow | expand chevron when hasChildren (7577a30 leaf-contract) |
| ADDRESSED | OR6fdfRMMIPu | No way to add sub-projects | green "+" inline add UI (canAddSub) |
| ADDRESSED | YJeJmTj6xc0Y | Calendar events: +Date, colored tags, ticker, hover tooltip | PlannerCalendar + UpcomingEventsBar + MiniCalendar tooltips |

## `/tools` and `/tools/*` (`src/components/tools/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | jlyL9VSmBMdA | MM-35 build Stacking tool + layering section | LayeringTool (stacking + layering); stacking/page.tsx |
| ADDRESSED | ub2Xvf4L2mok | MM-34 build Color Dropper (port) | EyedropperTool: upload, k-means, pins, match |
| ADDRESSED | USx5rvtrvdGD | MM-33 ASSIGN pastel-purple + recipe dropdown | ColourMatchTool + AssignToRecipeDialog |
| ADDRESSED | lRmu1mjMhc1Y | MM-31 "NN% color match" label + green bars | ColourMatchTool bar label + bg-green |
| ADDRESSED | _TqzGP_4Ge3U | MM-30 color-harmony modes | buildHarmony (analogous/comp/split/triadic) |
| ADDRESSED | XWzPP7o_zPJK | MM-29 useful CLOSEST PAINTS panel | brand + match% + Assign button in ColourWheelTool |
| ADDRESSED | SKZvvuFMWO7I | MM-53 rebuild color wheel w/ old features | WheelCanvas draggable HSL + harmonies + pins + deep-link |
| ADDRESSED | Q6fs2DHiGvnM | Body font → mono terminal app-wide | IBM Plex Mono in globals.css (019f139) |
| ADDRESSED | p9DIDcsozQYM | Better tool thumbnails | bespoke SVG ToolThumbnails (c4a0880) |

## `/collection` (`src/components/collection/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | Jo7RaPrtjFIg | MM-40 list supported paste stores + flag unsupported | PasteUrlBar SUPPORTED_STORE_NAMES + isSupportedStoreUrl |
| ADDRESSED | gMWAXp8F7Ydr | MM-39 paint/model toggle purple styling | PasteUrlBar toggle (purple border/text, pastel fill) |
| ADDRESSED | saHWeY2Y7_kY | MM-36 bug: model URL lands in paint table | kind honored in wishlist action (6d696f8) |

## `/recipes` — index (`src/components/recipe/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| PARTIAL | JlrBYUITMqoa | MM-52 this + button green; ALL + buttons green (except wishlist) | `variant="add"` (green)/`addWishlist` exist + shown in /gallery, but app + buttons (`+ Recipe`, `+ Add slot`, `+ New Project`, `+ Date`, `+ Focus`, `+ Add paint/model`, `+ Add layer`) still use default/secondary cyan — global rule not rolled out |
| PARTIAL | XBqE3QWDGUsW | MM-51 (1) bigger readable swatches (2) side panel w/ old recipe-creator tools | swatches enlarged ✓; click-paint opens ColorPickerPanel (wheel+library+dropper) ✓, but not the full layering side-panel scope of MM-25 |
| ADDRESSED | FEtdr2muxDWt | MM-28 click recipe row → recipe page | RecipeIndexTable onClick→onOpenRecipe |
| ADDRESSED | 5gi2AXAYb9el | MM-24 bug: name field loses focus per keystroke | SlideOutPanel onCloseRef fix (a2ef451) |
| ADDRESSED | l9-EpV22mrgx | Bigger squares w/ name center + layer bottom | RecipePaintTile (brand top/name center/layer bottom) |

## `/recipes/new` — editor

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | RbRsabgbCFGR | MM-26 pasted inspiration image URL not showing | next.config remotePatterns `**`; InspoBoard `<img>` |
| ADDRESSED | DJHI5xdCDBze | MM-25 wheel/match/filterable library in Pick-a-paint | ColorPickerPanel (wheel + library + eyedropper) |

## `/recipes/<id>` — recipe detail

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | -zP2IBqKlwTs | Company top / name center / layer bottom, solid B/W text | RecipePaintTile + readableText() |
| ADDRESSED | -bxkXH8bgcNR | Shorter Notes section (symmetry) | NOTES textarea rows=3 |
| ADDRESSED | ndZ9hE2Dgbqj | Remove inspo from recipe creator | no inspo section in RecipeEditorView |
| ADDRESSED | C1Dj9tlm_zMl | Even bigger recipe squares | RecipePaintTile size=lg (h-28 w-28) |
| PENDING | luPYg1TbETRy | "What to do with all this empty space?" | vague layout complaint; no specific traceable change |
| ADDRESSED | zfnUzPyTp2De | Borders too thick | thinned to 1px gold-standard weight |
| PENDING | DJIASK6DXP49 | "more pixels, less blocky" (graphic/icon) | vague target; no traceable change |

## `/library` (`src/components/library/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| PARTIAL | 0rPSRZogS7ix | MM-19 (1) yellow wishlist btn (2) click does nothing (3) clarify owned counter | yellow btn ✓, toggle wired ✓, "Owned" label+tooltip ✓; PaintListTable wishlist btn uses `text-glow-cyan` (style mismatch) |
| ADDRESSED | -GJphTRItErU | MM-20 enlarge sidebar logo | Logo size=140 (annotated MM-20) |
| ADDRESSED | NzVQI3ESFmK0 | Praise — "one of the only decent pages" | no action required (compliment) |
| ADDRESSED | Jqx4pDn-NWw1 | Recolor to neon green / cyan | ColorMapRail accent="green" |
| ADDRESSED | hASzc6IbhvUc | Fit whole color map without scrolling | ColorMapRail min-h-0/flex-1 fit layout |

## `/focus` (`src/components/focus/`)

| status | id | ask (short) | evidence |
|---|---|---|---|
| PARTIAL | TnEMMzwgjnul | MM-21 PROGRESS updates with focused project | bound to focus ✓; but `projectMinutes` prop never passed from /focus page — per-project time never renders |
| ADDRESSED | RuYiw7plQqDV | MM-22 reorder recipe box / label | recipe box reflowed (flex-wrap) per MM-22 |
| ADDRESSED | Tf4DQgqWUp7C | MM-23 +Focus dropdown of projects + Remove Focus | FocusPicker tree + clear; focus.ts actions |

## `/planner` (redesigned into `/focus`; legacy route redirects)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | vYOtzW8W9ciB | Page so bad — make focus a real page | Focus is its own page (b417d96); planner role absorbed |
| PARTIAL | TmE3k580uZWc | "not enough — see figma group 21 progress bars" | progress reworked in batch D, but figma-spec parity unverifiable |
| ADDRESSED | ORZm2dlzzxzq | Fundamental full UI redesign | batch D reworked focus/planner (FocusPicker, InspoBoard, Stopwatch) |
| ADDRESSED | ZsWmymCpw3Wx | Smaller INSPO; thumbnails → dbl-click lightbox, close outside | InspoBoard thumbnails + InspoZoom overlay + Esc/outside-click |
| PARTIAL | A5qzbPnMzfVH | (1) stopwatch own section (2) log → dashboard per-project time total | stopwatch section ✓, Log button persists ✓; no visible dashboard per-project time total |

## `/projects` (dashboard tracker boxes + projects table; legacy route redirects)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | r-N-8lHdYTyl | Make calendar WAY smaller | RightRail PLANNER capped ~170px (1fb5929) |
| ADDRESSED | UF5HOwXMpJxP | Smaller + scrollable section | ACTIVITY max-h-56 overflow-y-auto |
| ADDRESSED | C_T1fX-q-B9W | Solid progress bar (golden standard) | ProgressBar solid green/cyan |
| ADDRESSED | 8TkHnT9drEl2 | Remove this whole section | removed in 1fb5929; Upload Army List restored later per product decision (7577a30) |
| ADDRESSED | qHYZNwc8UHQk | Trackers: title+number only, 4 colors | StatRow 4 centered boxes; statBoxAccents |
| ADDRESSED | 4g3IE20foZSZ | Center title and 0m | StatBox center layout |
| ADDRESSED | JxHyrHyQm8h1 | Centered numbers only (01,02) | padStart(2,"0"), no labels |
| ADDRESSED | SrUlN-A40kgh | Border thicker than others | uniform 1px border |
| ADDRESSED | vZsXjhzZaj22 | Background solid black | DashboardView bg-black |
| ADDRESSED | hA-bzgS5S98r | Remove redundant section | removed 1fb5929; events ticker restored per product decision (7577a30) |
| PARTIAL | S3lZ40vuocCL | More stylistic; then "just centered % number" | solid ProgressBar present; no added "stylistic" treatment / not reduced to bare centered % |
| PARTIAL | wwiRkmlTX1qp | Terminal/retro font with shadow/outline | display font → VT323 ✓; text-display-shadow util defined but NOT applied to stat numbers |
| ADDRESSED | bKcNYALyGZ-t | PURCHASED → OWNED, neon green | OWNED status → green accent |
| ADDRESSED | JRH4S-NKjwjl | Project name white vs TYPE | name text-fg (white) on highlighted row |
| ADDRESSED | ovBXfJWDLMn7 | Bigger logo, legible mini-manager | SidebarRail Logo size=140 |

## `/wishlist` (redesigned into `/collection`; legacy route redirects)

| status | id | ask (short) | evidence |
|---|---|---|---|
| ADDRESSED | 8PrFCca1ZYBw | Add RECIPE column on paints table | PAINT_COLS includes "Recipe" w/ swatch strip |
| PENDING | lq5hIKKHJdVT | "No idea what this is, remove it" | vague; element not identifiable |
| ADDRESSED | EJnqEGcpmnkD | Bottom stats overview bar (paints/models) | CollectionStatsBar (owned/spend + model stages) |
| ADDRESSED | nwVv41uZ4y1X | (duplicate of above) | CollectionStatsBar |
| PENDING | FZj63NkdAnZb | "Remove this from the paint table" | vague; column not identifiable |
| PARTIAL | wyeWvL6goRGH | Better dropdown listing active projects | lists active projects ✓, but still a native `<select>`, not the "better element" requested |
| PARTIAL | 5smqxhn3hp2D | Two tables (paint/model) w/ full column + status spec | both tables, all statuses, delete X, name→URL link present; missing paint **Type** column (Contrast/Wash/…) — slot used for Recipe instead |
| ADDRESSED | 2OWFoagGltwl | Only Models/Paints; filters Wishlist/Purchased/Hold | split MODEL + PAINT tables; status filters Wishlist/Owned/Hold |
| ADDRESSED | KpdEPo3KJr3r | Per-table Filter button far right, opens small panel | Filter button on title row + per-table popover |
| ADDRESSED | R4938tQghFQK | Add button match other button styles | shared Button green variant |
| PARTIAL | 77YGgp1xyl8f | Layout overhaul; no h-scroll; vibrant status; URL="link" col; better project dropdown | no-scroll ✓, color StatusDropdown ✓, compact link column ✓; project dropdown still native `<select>` |

## Already-resolved in Vercel (9) — all ADDRESSED

| id | path | ask | evidence |
|---|---|---|---|
| 6VeTbFzzPagr | /dashboard | MM-48 UPCOMING EVENTS white | shipped |
| I8oE5OZJOocL | /collection | MM-44 table text white | shipped |
| L7kx59tW-PgV | /collection | MM-43 model footer btn green | shipped |
| JKhb93LS-onh | /collection | MM-42 paint footer btn green | shipped |
| 3tRa54mNB_MZ | /collection | MM-41 +ATTACH pastel purple | shipped |
| BL2IRYa0W8Wd | /collection | MM-38 model empty-state btn green | shipped |
| jCYGgFgjYWMl | /collection | MM-37 collection action btn green | shipped |
| ZBl0XGP-o1ku | /tools/match | MM-32 USE button green | shipped |
| fZE7ym-7XI_z | /recipes/new | MM-27 SAVE button green | shipped (dd97aa6) |

---

## PENDING / PARTIAL — needs attention

| status | id | path | ask | why |
|---|---|---|---|---|
| PARTIAL | JlrBYUITMqoa | /recipes | MM-52: make all "+" buttons neon green (except wishlist) app-wide | `variant="add"`(green)/`addWishlist`(yellow) built and shown only in /gallery; real app "+" buttons still cyan/default. Global rule not applied. |
| PARTIAL | XBqE3QWDGUsW | /recipes | MM-51: side panel with full old recipe-creator tools | swatches enlarged + a color picker panel exist, but not the full wheel/match/library/dropper/layering side panel scope (= MM-25). |
| PARTIAL | 0rPSRZogS7ix | /library | MM-19: yellow wishlist button | btn/toggle/owned-counter done, but PaintListTable wishlist button uses `text-glow-cyan` (color mismatch vs yellow). |
| PARTIAL | TnEMMzwgjnul | /focus | MM-21: PROGRESS reflects focused project (per-project time) | progress bound, but `projectMinutes` prop never passed from the /focus page → per-project time never renders. |
| PARTIAL | A5qzbPnMzfVH | /focus (planner) | Log time → dashboard per-project total | stopwatch section + Log button persist time, but no dashboard section showing per-project time totals. |
| PARTIAL | TmE3k580uZWc | /planner | "not enough — match figma group 21 progress bars" | progress reworked in redesign, but parity with the referenced figma spec is unverifiable from code. |
| PARTIAL | S3lZ40vuocCL | /projects | completion: more stylistic, then "just centered % number" | solid progress bar present; not reduced to a bare centered percentage and no extra stylistic treatment. |
| PARTIAL | wwiRkmlTX1qp | /projects | retro/terminal font with shadow/outline | display font is VT323; `text-display-shadow` utility exists but is NOT applied to the stat numbers. |
| PARTIAL | wyeWvL6goRGH | /wishlist (collection) | better project-assignment dropdown element | lists active projects but is still a native `<select>`, the element the user called "terrible." |
| PARTIAL | 5smqxhn3hp2D | /wishlist (collection) | full two-table collection spec | implemented except the paint **Type** column (Contrast/Wash/Acrylic/…); that slot shows Recipe instead. |
| PARTIAL | 77YGgp1xyl8f | /wishlist (collection) | collection layout overhaul | most done (no scroll, vibrant status, link column); project dropdown still native `<select>`. |
| PENDING | luPYg1TbETRy | /recipes/<id> | "what to do with all this empty space?" | vague; no specific change traceable to it. |
| PENDING | DJIASK6DXP49 | /recipes/<id> | "more pixels, less blocky" graphic | vague target; no traceable change. |
| PENDING | lq5hIKKHJdVT | /wishlist (collection) | "no idea what this is, remove it" | vague; element not identifiable, cannot confirm removal. |
