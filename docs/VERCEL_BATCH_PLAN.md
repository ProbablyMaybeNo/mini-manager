# Vercel comment batch — milestone plan

Implements the unresolved Vercel comments (39 threads, 2026-06-19). Built for the
`milestone-builder` agent. Thread ids in `(…)`.

## Ross's rulings (apply to ALL milestones)
1. **Button font stays `DePixel Klein`** (`--font-button`). Do NOT switch buttons to VT323 — those comments are superseded. Keep using kit `Button`/`IconButton` variants.
2. **Font sizes: per-element only.** Apply the specific size each comment asks for on the named element. Do NOT do a global scale bump (would re-break the just-fixed mobile layouts). Use Tailwind utilities (`text-sm`, `text-lg`, `text-[Npx]`) on the specific element.
3. **All dropdowns get the distinct "+Attach" menu style** — thinner font + dotted border — so a dropdown reads differently from a button app-wide (thread `8GfWoKTUukde`). Do this in the kit `Listbox` so every consumer inherits it.

## Rules for the builder (read first)
1. **Branch:** work on `feat/vercel-batch`. Do NOT push/merge/open PRs or resolve threads — Ross + CI handle that.
2. **Verify-before-build + target with the thread.** Many comments don't name the element in text. Use the Vercel toolbar MCP (`get_toolbar_thread` with the id + teamId `team_FqJjw2ukehBMlFAK8VePnElM`) to read each thread's `context.selector`/`page`/screenshot and pin the exact element before editing. If you still can't identify it confidently, HALT that milestone with a note — do not guess.
3. **Conventions:** kit primitives + tokens (`src/lib/palette.ts`, `src/app/globals.css`), square hard-edge aesthetic, fonts already loaded (`font-button`/`font-mono`/`font-osd`/`font-display`/VT323 via `font-body2`, "Flexi IBM VGA True" via `--font-mono` stack — to apply Flexi directly use `font-mono` or a `font-[…]` arbitrary).
4. **Per milestone:** implement → `npm run typecheck` (0) → `npm run test:unit` (green; `git checkout -- public/sw.js` if it dirties) → commit citing the thread id → tick the box. One commit per milestone.
5. **Halt + report** if a milestone needs a product/design decision or you can't target it.

---

## Ready to build

- [x] **M1 — Wire the status/activity icons** (`2SafK0GgPnr_`, recurring + high priority). Ross's SVGs live at `D:\AI-Workstation\mini-manager\Library\Icons` (`Wishlist.svg`, `Owned.svg`, `Priming.svg`, `Painting.svg`, `build or building.svg`, `Completed.svg`). They are NOT wired in — `kit/StatusIcon.tsx` still draws its own inline paths. Copy the SVGs into `public/icons/status/`, and render them from `StatusIcon` keyed by status/activity type (filename → type). Keep `currentColor`/accent tinting if the SVGs allow (else render as-is). Verify they appear on the dashboard activity feed + collection/projects status indicators.

- [x] **M2 — Dashboard stat colours** (`icu1mlFtJeya` time-total → pastel **purple**; `awIApwrPCRs3` streak # → pastel **yellow**; `zsgMLZrqO_ha` completion % → neon **green**; `_tsKQEEUbfvT` active-projects # → neon **cyan**). Colour each dashboard stat number via the StatBox/StatRow accent. Map to palette tokens (`--color-purple/yellow/green/cyan`).

- [x] **M3 — Calendar "deadline" date does nothing** (`d9cfJYAVIx0C`): adding a deadline date had no effect, but "tournament" worked. Investigate the add-event/event-kind path (`MiniCalendar` / planner add-date form / the event `kind` enum) — likely the "deadline" kind isn't wired into add or render. Fix so a deadline date saves + shows a dot like other kinds. **Real bug.**

- [x] **M4 — All dropdowns → distinct menu style + bigger font** (`8GfWoKTUukde`, `0o2HEmQzVjyU`, `w5cZimrBYgGh`). In kit `Listbox`: apply the recipe-"+Attach" treatment (thinner font + **dotted** border) and raise the dropdown font ~25% so it's on par with the project-table title-column cells (per `w5cZ`). Every Listbox consumer inherits it.

- [x] **M5 — Priority dropdown** (`ynb3l8JdxhaE`): give it the +Attach dropdown style + dotted border, and colour it by priority — **Red = High, orange = mid, Yellow = Low**.

- [x] **M6 — Completion bar + % font +50%** (`kdV6XB6eFsRS`) on /projects (the progress bar value + label). Per-element size bump only.

- [x] **M7 — Paint cards: bigger squares + fonts** (`1wGf-tbEKkh_`, `9OIIQF3jUrz2`): increase the paint/colour square size; set the **layer** text to VT323 (`font-body2`) and the **paint name** to "Flexi IBM VGA True" (`font-mono`); increase the Flexi (paint-name) size ~50%. Brand-acronym-in-corner idea from `9OIIQF3jUrz2` is optional — only if straightforward, else note it.

- [x] **M8 — "+ Attach" / add-button consolidation** (`9lgIwII2oBy7`, `foqbcZx93a6F`, `t7doCednL8MP`, `CiBUwVgwwQRD`): standardise attach/add affordances as **pastel purple "+ Attach"** (KEEP the DePixel Klein button font — do NOT use VT323). `+COLOR SCHEME` → neon green; `+RECIPE` → pastel purple; `share` → neon green. Use the canonical `Button`/`IconButton` variants where possible.

- [x] **M9 — Bright-white text** (`1Xq1P5W3Yvzq`, `mWGF8f6O1IEQ`): make the flagged page subtitle / text bright white (`text-fg`), and for `mWGF` write a short, informative per-page description under the title (1–2 lines summarising that page's features). Target via the threads' selectors.

- [x] **M10 — Backgrounds to pure black** (`T4nuELRRnFtJ` "crept toward blue"; `BRFouQHNaUUx` side panel). The blue is likely the faint cyan scanline gradient on `body` in `globals.css` and/or `bg-bg-raised` panels. Cut the tint toward pure `--color-bg` where flagged; side-panel/nav background → `bg-bg`. Keep scanlines subtle if removing entirely changes the vibe — match the threads.

- [x] **M11 — Harmony dropdown + brand-name font size** (`2tgkNEd6g32w`): increase the harmony dropdown + brand-name text size, nothing else.

- [x] **M12 — Priority indicator font matches Status/Type** (`U3vAGGyt-AjD`): make the PRIORITY indicator use the same font/size/treatment as the STATUS and TYPE chips.

- [x] **M13 — Bigger WISHLIST/OWNED indicators on the colour map** (`rg1uauzAsVG4`): enlarge them on the library colour map for at-a-glance coverage (ok if they cover slightly more than the single paint).

- [ ] **M14 — Heading hierarchy** (`0uxze0Chc7dB`): table indicator text too large → match column-title size; column headers = H3 scale, table/stat-box titles = H2 scale, page titles = H1 scale. Apply the named scale consistently.

---

## Halt — needs Ross / a design call / a Figma ref (do NOT guess)
- `8AYy8A9H_J9L` — "button down to 68×68px": which button? read thread; only if unambiguous.
- `wBJeqQHQLK4g` — ±droppers feature (start with 3, add/remove). New feature.
- `C9gZQOzR7nUM` — add one more paint brand for symmetry. Data + Ross.
- `TXjhrdKPsrda` — skip recipe-name slide-out → "+ RECIPE" straight to create page. Flow change.
- Glaze-combo **suggestions** (`Rm4pY3fLzz6k`, `WKEG10G3FccH`) — new content feature (venn itself already shipped).
- `e-j6I1OfIINp`, `aPHdSR4h7a_Z`, `iqf9wTFo-zHm` — "increase font size" with no clear target/page. Read thread; halt if vague.
- `5qy6mswKnugb` — "VT323 font needed": if it targets a button, it conflicts with the DePixel Klein ruling — halt + flag.
- `S3lZ40vuocCL` (Figma group 20), `UF5HOwXMpJxP` (which section?), `RuYiw7plQqDV` (recipe-box text order) — design/Figma calls.

## Known issue (separate, not in this batch)
The Theme Studio role-size sliders (`--text-button/dropdown/element`) don't move the live UI — the runtime CSS-var override isn't taking on those `text-*` utilities. Logged to fix separately; per-element sizes in this batch are applied directly, so they're unaffected.
