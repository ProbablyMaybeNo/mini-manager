# Mini Manager — Phase 2 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal (per V2-BUILD-PLAN §11.2):** Library + Inventory + Wishlist ship together because they share infrastructure (paint catalog fetch, scraper-agent for URL parsing, owned-vs-wanted mental model). Ship criterion:

- Flow 7 — "do I own Mephiston Red?" — three taps from cold start.
- Flow 8 — paste vendor URL → wishlist row populated — under five seconds.
- Flow 9 — mark bought → existing unit's `owned_count` increments — clean round-trip.

**Already shipped (do not re-run):** none — Phase 2 starts fresh on top of Phase 1.

**Remaining (build in this order):**

---

## P2.1 — Paint catalog static asset + IndexedDB read-through cache

- [x] Build this milestone

**Context.** The library reads from a static `paints.json` served by Next.js. v1 already produced one at `../app-src/public/data/paints.json` (7,128 paints). We re-export from the canonical Webscraper SQLite DB so v2 owns its own copy and the export script lives in this repo. On the client, a tiny Dexie store keeps a copy in IndexedDB so the table view doesn't re-fetch on every navigation.

**Files to create.**
- `app/public/data/paints.json` — generated artifact, ~2-3MB. Gitignored if size is a concern, otherwise committed (decide via the .gitignore check below). Schema per `Paint` type.
- `scripts/export-paints.ts` — node-only script (run via tsx). Reads `apps/Webscraper/data/webscraper.db`, selects the `paints` table, normalises rows into the `Paint` shape, writes to `app/public/data/paints.json`. Logs row count + brand breakdown. No new npm deps — use the existing `better-sqlite3`-equivalent path via `@libsql/client/node` with a `file:` URL, OR shell out to `py -3.13 -c "..."` if simpler. Pick whichever is shorter; flag the choice in the commit body.
- `src/lib/paints/types.ts` — shared `Paint` type: `{ id, brand, line, name, sku, type, hex, hexConfidence, hexSource, sourceUrl }`. `type` is a union of `"Paint" | "Wash" | "Metallic" | "Contrast" | "Air" | "Primer" | "Varnish" | "Pigment" | "Effect" | "Ink" | "Lacquer"`. `hexConfidence` is `"high" | "medium" | "low"` (green/amber/grey per spec).
- `src/lib/paints/loader.ts` — client-side loader. Exports `loadPaints(): Promise<Paint[]>`. Tries Dexie cache first (keyed by paints.json ETag or last-modified header); on miss, fetches `/data/paints.json`, stores in Dexie, returns. SSR-safe: guards `typeof window` so server components can import the type but never run the cache code.
- `src/lib/paints/dexie.ts` — minimal Dexie setup. One table `paints` keyed by `id`. Add `dexie` dependency in `package.json` (flag in commit body).
- `package.json` script: `"db:export-paints": "tsx scripts/export-paints.ts"`.

**Files to modify.**
- `.gitignore` (root and/or `app/.gitignore`) — add `app/public/data/paints.json` if we decide not to commit it. Decision: **commit it** for v1, since the file is reproducible from Webscraper and committing avoids a "first dev pull is broken" footgun. Revisit when Stahly + scraper backlog grows the file past 5MB.

**Patterns to follow.**
- `import "server-only"` for any module that hits the filesystem or Webscraper DB. Loader / Dexie code does **not** import server-only.
- Dexie schema is versioned; bump version when adding indexes later.
- Paint type is the single source of truth — every downstream component (table row, detail panel, slot picker) imports it from `src/lib/paints/types.ts`.

**Implementation notes.**
- The Webscraper `paints` table has known brand-alias quirks (see Webscraper memory). The export script does NOT try to fix them — it's a faithful dump. Brand normalisation is the library page's problem, not the catalog's.
- Hex confidence buckets: if the row has a Stahly hand-painted swatch source → `high`; manufacturer site → `medium`; community / minimatch / unknown → `low`. The webscraper.db column for this is `hex_source` (text); the script maps source strings → confidence levels with a small dictionary.
- Cache-bust strategy: include the export's `Date.now()` ms in the JSON as `__exported_at`. The loader uses that timestamp as the Dexie cache key. Skip ETag/header-based invalidation — overkill for v1.

**Acceptance criteria.**
- `npm run db:export-paints` writes `app/public/data/paints.json` with ≥ 7,000 rows.
- `npm run typecheck` exits 0.
- A throwaway client component in `/library` can `await loadPaints()` and console.log the row count; second load hits Dexie (verifiable in browser devtools → Application → IndexedDB).

**Commit message:** `P2.1: paint catalog export + IndexedDB cache`

---

## P2.2 — Library page: table, filters, detail panel

- [x] Build this milestone

**Context.** The library is the painter's catalog. Default view is a dense table (Linear-style); filter rail collapses on mobile. Clicking a row opens a side panel with full detail. Owned/wishlist marks come in P2.3 — this milestone renders read-only catalog data.

**Files to create.**
- `src/app/library/page.tsx` — replace the placeholder. Server component shell with a client child for interactivity. Renders header + filter rail + table + detail panel slot.
- `src/components/library/LibraryTable.tsx` — `'use client'`. Receives `paints: Paint[]` + filter state. Renders a virtualised list if row count > 500 (use a simple windowing impl — `react-window` is allowed; flag dep in commit body). Columns per V2-BUILD-PLAN §7.2: swatch (24px square), brand, line, name, SKU, type icon, hex, owned (✓/✗ placeholder for P2.3), wishlist (★/☆ placeholder for P2.3), actions (… menu). 36-44px row height per density rules.
- `src/components/library/FilterRail.tsx` — `'use client'`. Brand multi-select (collapsible group), line multi-select (filtered by selected brands), type multi-select with icons, hue band (8 chips spanning the spectrum), owned-only toggle (disabled until P2.3), hex search box with a colour swatch preview as user types. Desktop: left rail 240px wide. Mobile: collapses into a bottom-sheet drawer triggered by `[ Filter ]` button.
- `src/components/library/PaintDetailPanel.tsx` — `'use client'`. Slide-in from the right (desktop) or bottom-sheet (mobile). Renders: large swatch (200×200), brand + line + name + SKU header, hex (with copy button), type icon + label, hex-confidence dot + tooltip with source URL, harmonies strip (8 swatches around the wheel — use culori), similar-in-other-brands list (placeholder for now — full ΔE2000 match is the Tools/Match page in Phase 4).
- `src/components/library/TypeIcon.tsx` — 11 single-glyph icons per the v1 set (`○` opaque, `◐` transparent, `≋` wash, `◆` contrast, `✦` metallic, `⬡` enamel, `·` pigment, etc.). Match v1 `TypeLegend` glyph set so the visual language carries over.
- `src/components/library/HexConfidenceDot.tsx` — small (8px) coloured dot, hoverable tooltip with `hexSource` URL. Green = high, amber = medium, grey = low.
- `src/lib/paints/filters.ts` — pure filter functions: `filterByBrand`, `filterByLine`, `filterByType`, `filterByHueBand`, `filterByHex`. Each takes `(paints, filter) → paints`. The page composes them. Includes `HUE_BANDS` const: 8 named bands with `{ start, end }` degrees on the HSL hue wheel.
- `src/lib/paints/sort.ts` — `sortPaints(paints, mode)` for the four sort modes: brand-line-sku (default), hue, name, recent.

**Files to modify.**
- `src/lib/paints/types.ts` (from P2.1) — add `PaintFilter` union type used across filter components.
- `package.json` — add `culori`, `react-window` if used. Flag in commit body.

**Patterns to follow.**
- Server component fetches the JSON via `await fetch(...)` with `next: { revalidate: 86400 }` (1-day ISR cache). Passes to client child via prop.
- Filter state lives in a URL-search-param hook (`useSearchParams` + `useRouter().replace(...)`) so the filter state is shareable and back-button-friendly. Don't store filter state in component state; bind it to the URL.
- Detail panel state: `?paint=<id>` query param. Closing the panel removes the param. Direct link to a paint detail = bookmarkable URL.
- Mono for table data, sans for any prose in the detail panel (paint description, notes). Glow only on the active row's accent.
- Table row hover state: `bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]`. Active row: left border like NavRail items.

**Implementation notes.**
- Brand multi-select collapses brands into A-Z headers when the list is > 12 brands. Selecting a brand un-collapses its lines automatically.
- Hue band: 8 bands of 45° each across HSL hue. Names: Red / Orange / Yellow / Green / Cyan / Blue / Violet / Magenta. The hex search and hue filter compose with AND (not OR) — narrow further.
- For now, `Owned` and `Wishlist` columns render placeholder glyphs (`✗` / `☆`). P2.3 wires them up.
- Performance: with ~7,500 paints, a virtualised list is mandatory on mobile. Test on a phone before declaring this milestone done.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `/library` loads the table within 2s on first paint (assuming paints.json is cached).
- Selecting "Citadel" brand + "Layer" type narrows the table to Citadel Layer paints (verify visually).
- Clicking a row opens the detail panel; URL updates to `/library?paint=<id>`.
- Sharing that URL with the panel open re-opens the panel on load.
- Hex search "5a9dd8" returns rows whose hex is within ΔE < 10 of that colour (rough match acceptable; tight ΔE matching is Phase 4).

**Commit message:** `P2.2: library page — table, filters, detail panel`

---

## P2.3 — Inventory: owned + wishlist marks on paints

- [x] Build this milestone

**Context.** A painter marks paints owned (✓), wishlisted (★), or neither. Marks are per-user. The library row and detail panel show the user's current marks; the "Owned only" filter starts working. Wishlist marks here are LIGHTWEIGHT — a star on a paint. The full WishlistItem entity (vendor URLs, prices, projects) is P2.4 and is a different shape. Don't conflate them.

**Files to create.**
- `src/db/schema.ts` — add `inventoryEntries` table:
  ```
  inventoryEntry (sqliteTable "inventory_entry")
    id (nanoid)
    ownerId (fk → users.id, cascade)
    paintId (text, not null) -- references paints.json by id; no SQL FK
    ownedCount (integer, default 0) -- how many bottles
    isWishlisted (boolean, default false)
    lastPurchasedAt (timestamp, nullable)
    createdAt / updatedAt
  -- Unique index on (ownerId, paintId)
  -- Index on ownerId for fast list queries
  ```
  Add the relation to `usersRelations` as `many(inventoryEntries)`.
- `src/db/queries/inventory.ts` — `listInventoryByUser(userId): Promise<Map<paintId, InventoryEntry>>`. Returns a Map keyed by paintId for O(1) lookup in the library table.
- `src/lib/actions/inventory.ts` — server actions:
  - `setOwnedCount(paintId, count)` — clamp ≥ 0; upsert row.
  - `toggleWishlistedPaint(paintId)` — boolean flip; upsert row.
  - `markPurchased(paintId, deltaCount)` — increments `ownedCount` by delta, sets `lastPurchasedAt = now()`.
  Each validates via Zod, uses `currentUserId()`, calls `revalidatePath("/library")`. Return `{ ok: true } | { ok: false, error }`.
- `src/components/library/InventoryControls.tsx` — `'use client'`. Two-button cluster shown in the table row (compact) and in the detail panel (full). Compact: `[ ✓ ]` toggle + `[ ★ ]` toggle (visual states muted/active). Full: bottle-count stepper (`−` / `+` around an integer), wishlist toggle, "mark just bought" quick action that bumps owned by 1 and stamps `lastPurchasedAt`.

**Files to modify.**
- `src/components/library/LibraryTable.tsx` — replace placeholder owned/wishlist columns with `<InventoryControls compact />`. Receives the user's inventory map as a prop from the page.
- `src/components/library/PaintDetailPanel.tsx` — embed `<InventoryControls />` (full version) above the harmonies strip.
- `src/components/library/FilterRail.tsx` — enable the "Owned only" toggle. Filtering happens client-side: `paints.filter(p => inventory.get(p.id)?.ownedCount > 0)`.
- `src/app/library/page.tsx` — fetch `listInventoryByUser` server-side, pass to the table + detail panel.
- New Drizzle migration generated via `npm run db:generate`.

**Patterns to follow.**
- Optimistic UI: `useTransition` wraps the server action call; local component state flips first, server reconciles. On error, revert and toast (no toast lib yet — use a simple inline `[ ! ] error` line under the control).
- Don't re-fetch the entire paints.json on inventory change; only `revalidatePath` so the inventory map re-loads from the DB.
- For the bottle-count stepper, clamp the `−` button at 0 (can't go negative). When `ownedCount === 0`, the row is functionally "not owned" but the DB row may still exist (e.g., from a previous purchase that's been depleted). That's fine — the "Owned only" filter checks `ownedCount > 0`.

**Implementation notes.**
- A wishlist mark on a paint (`isWishlisted=true`) is a lightweight intent ("I'd like this paint someday"). It does NOT create a `WishlistItem` row — that comes only when the user pastes a vendor URL. Two reasons we keep them separate: (a) painters star paints they're idly interested in without committing to a purchase plan; (b) WishlistItem carries vendor/price/project context that doesn't apply to a generic "I want this paint."
- The library's "Wishlist" column reflects `isWishlisted` only. The /wishlist page (P2.4+) is a different list.
- Bottle count is integer, no fractional support. Real painters track "ml left" but that's out of scope.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Flow 7 works: navigate to /library on a phone, search "meph", tap Mephiston Red. If owned, the detail panel shows the bottle count. Three taps max from the home screen.
- Tapping the `[ ✓ ]` button on a row flips its state and persists across reload.
- "Owned only" filter narrows the table to rows where `ownedCount > 0`.
- Wishlist column stars (`★`) light up amber for wishlisted paints; muted (`☆`) otherwise.

**Commit message:** `P2.3: inventory — owned + wishlist marks on paints`

---

## P2.4 — Wishlist: schema, quick-add bar (manual entry), list view

- [x] Build this milestone

**Context.** The wishlist is a first-class shopping list. This milestone gets the data model + the page + the quick-add bar for MANUAL entries (free-form title, optional fields). The URL-paste scrape is the next milestone (P2.5) — separating them keeps the schema landed before we add scraping complexity.

**Files to create.**
- `src/db/schema.ts` additions:
  ```
  wishlistItem (sqliteTable "wishlist_item")
    id (nanoid)
    ownerId (fk → users.id, cascade)
    projectId (fk → projects.id, set null on delete, nullable)
    title (text, not null)
    imageUrl (text, nullable)
    sourceUrl (text, nullable)
    vendor (text, nullable)
    price (real, nullable)        -- numeric, currency-bare
    currency (text, default "USD") -- ISO 4217
    category (text enum: "Box" | "Bits" | "Paint" | "Tool" | "Terrain" | "Other")
    priority (text enum: "Urgent" | "High" | "Medium" | "Low", default "Medium")
    status (text enum: "Wanted" | "Bought" | "Cancelled", default "Wanted")
    notesMd (text, nullable)
    scrapedMetadata (text, nullable) -- raw JSON blob from the scrape (P2.5)
    dateAdded (timestamp, default now)
    dateResolved (timestamp, nullable) -- set when status leaves "Wanted"
  -- Indexes: (ownerId, status); (ownerId, projectId); (ownerId, vendor)
  ```
  Add to `usersRelations` and `projectsRelations`.
- `src/db/queries/wishlist.ts` — `listWishlist(userId, opts?)` with filter args (status, category, projectId, vendor); `getWishlistItem(userId, id)`; `wishlistTotals(userId, status?)` returning `{ count, totalByCurrency: Record<string, number> }` for the price footer.
- `src/lib/actions/wishlist.ts` — server actions:
  - `createWishlistItem(input)` — manual creation. Zod-validate; insert; `revalidatePath("/wishlist")`.
  - `updateWishlistItem(id, patch)` — partial update; ownership check; revalidate.
  - `deleteWishlistItem(id)` — soft-delete is overkill; hard-delete; revalidate.
  - `setWishlistStatus(id, status)` — convenience wrapper; stamps `dateResolved` when leaving "Wanted".
- `src/app/wishlist/page.tsx` — replace the placeholder. Server component. Renders header + quick-add bar + filter chips + table + price footer. URL search params drive filters/sort.
- `src/components/wishlist/QuickAddBar.tsx` — `'use client'`. Single text input with placeholder `'Paste a vendor URL — or type a title to add manually'`. Submit handler: if input looks like a URL (`/^https?:\/\//`) → call P2.5's `scrapeAndCreateWishlistItem` (added in P2.5; for P2.4 the URL branch shows "URL scraping coming in P2.5" toast). Otherwise → call `createWishlistItem({ title: input })` with minimal defaults.
- `src/components/wishlist/WishlistTable.tsx` — `'use client'`. Table columns: image (40×40, fallback to first letter of title in a frame), title (link to detail drawer), vendor, price + currency, project tag (clickable to project), priority dot (colour-coded), status badge, row actions menu (`Mark Bought` / `Open vendor link` / `Tag to project` / `Set priority` / `Delete`).
- `src/components/wishlist/WishlistDetailDrawer.tsx` — `'use client'`. Side panel (desktop) / bottom sheet (mobile). Editable: title, vendor, price, currency, category, priority, status, projectId (combobox of user's projects), notes (Markdown).
- `src/components/wishlist/WishlistFilters.tsx` — `'use client'`. Chips bar above the table: `[Wanted]` (default on), `[Bought]`, `[All]`; category chips; priority chips; project filter combobox. Filters live in URL search params.
- `src/components/wishlist/PriceFooter.tsx` — sticky bottom on the page. Renders `Σ N items · $XX.XX USD` per currency. Optional "shopping cart math" expand: per-vendor breakdown with running totals (toggle, not default).

**Files to modify.**
- New Drizzle migration via `npm run db:generate`.
- `src/components/NavRail.tsx` — already has `[W] Wishlist` entry. No change.

**Patterns to follow.**
- All server actions: `"use server"`, Zod-validated, `currentUserId()`, `revalidatePath(...)`, structured return.
- Date storage: `timestamp_ms` mode (matches existing patterns).
- Free-text title is the only required field for `createWishlistItem` — everything else is optional so users can mash a string and move on.
- Detail drawer: inline saves on blur or explicit `[ Save ]` button. Use `useTransition` for optimistic.

**Implementation notes.**
- For the priority dot colour: Urgent = red, High = amber, Medium = cyan-dim, Low = fg-subtle.
- The `[Wanted]` chip is on by default. Toggling to `[All]` shows Bought + Cancelled too. `[Bought]` toggle is the "spending review" / "bought history" view.
- Status badges: `WANTED` (cyan), `BOUGHT` (green-dim), `CANCELLED` (fg-muted with strikethrough).
- Project tag column shows the project's name as a `<Link>` to its workspace; empty when `projectId` is null.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Visiting `/wishlist` shows an empty-state if no items, or a table + filters if any exist.
- Typing "Citadel Mephiston Red 17ml" + Enter in the quick-add creates a row (status=Wanted, category defaulted, priority=Medium).
- Clicking a row opens the detail drawer; editing fields persists.
- The `[Bought]` chip filters the table to bought items only.
- The price footer sums visible items per currency.

**Commit message:** `P2.4: wishlist schema + quick-add + list view`

---

## P2.5 — Wishlist URL paste: vendor scrape pipeline

- [x] Build this milestone

**Context.** The killer affordance. Painter pastes an Element Games / Wayland / Goblin Gaming / GW / Amazon / eBay URL into the quick-add bar — app scrapes title, image, price, vendor, category — row appears in two seconds. For everything else, fall back to OpenGraph metadata.

**Files to create.**
- `src/lib/scrape/types.ts` — `ScrapedProduct` shape: `{ title, imageUrl?, price?, currency?, vendor, category?, raw: Record<string, unknown> }`.
- `src/lib/scrape/index.ts` — dispatcher. `scrapeUrl(url): Promise<ScrapedProduct | null>`. Resolves the URL's hostname against the per-vendor parser map; falls back to the OG parser; returns `null` if even OG fails.
- `src/lib/scrape/og.ts` — OpenGraph fallback. Fetches the URL with a polite User-Agent (`"Mini Manager / wishlist-scrape (https://miniaturemanager.app/bot)"`), parses meta tags via a regex or `linkedom` (flag dep in commit body). Extracts `og:title`, `og:image`, `og:price:amount`, `og:price:currency`. Vendor is the hostname.
- `src/lib/scrape/parsers/elementgames.ts` — Element Games adapter. Hostname `elementgames.co.uk`. Extracts `.product-title`, `.product-image`, `.price`, currency `GBP`, category from breadcrumb. CSS-selector parsing — use `linkedom`.
- `src/lib/scrape/parsers/wayland.ts` — Wayland Games. Hostname `waylandgames.co.uk`.
- `src/lib/scrape/parsers/goblin.ts` — Goblin Gaming. Hostname `goblingaming.co.uk`.
- `src/lib/scrape/parsers/gw.ts` — Games Workshop direct. Hostname `games-workshop.com` (multi-region: `us.`, `uk.`, etc.). Currency varies by subdomain.
- `src/lib/scrape/parsers/amazon.ts` — Amazon. Hostnames `amazon.com`, `amazon.co.uk`, `amazon.de`, etc. Currency by TLD.
- `src/lib/scrape/parsers/ebay.ts` — eBay item listings.
- `src/lib/actions/wishlist.ts` — add `scrapeAndCreateWishlistItem(url)`. Server action: validates URL, calls `scrapeUrl`, creates the row with the scraped fields + raw metadata in `scrapedMetadata`. On scrape failure: still creates the row with just `sourceUrl + title=<hostname>`, so the user isn't stranded.

**Files to modify.**
- `src/components/wishlist/QuickAddBar.tsx` — wire the URL branch to `scrapeAndCreateWishlistItem`. Show a 2-second optimistic placeholder row while the scrape runs (skeleton with the URL's hostname as a stand-in title). On success, replace with the real row; on failure, surface the error inline.
- `package.json` — add `linkedom` if used.

**Patterns to follow.**
- Server-only by default: `import "server-only"` on every file in `src/lib/scrape/`. This stuff CANNOT run in the browser (CORS).
- Parser interface: each parser exports `{ hostnames: string[], parse(html: string, url: URL): Promise<ScrapedProduct> }`. The dispatcher matches by hostname suffix.
- Polite scraping: respect `robots.txt` is overkill for v1 since we're not crawling — single-URL fetch initiated by the user is fine. Do set the User-Agent and a 10s timeout.
- Never store full raw HTML in `scrapedMetadata`; store only the parsed JSON used + a `parser: "elementgames" | "og-fallback"` field for debugging.
- On scrape failure, NEVER throw — return `null` and let the action create a minimal row. Painters paste URLs in bulk; one broken parse shouldn't block the next.

**Implementation notes.**
- For Amazon: the live product page is heavy and aggressively anti-bot. Best-effort fetch; if it returns a redirect or anti-bot challenge, fall back to OG. Don't add headless-browser dependencies for this; that's a Webscraper-service-agent concern (P2.x future, not Phase 2).
- Category inference: if the URL path contains "paints" → "Paint"; "brush" → "Tool"; "terrain" → "Terrain"; otherwise default per vendor (most vendors → "Box").
- Currency: trust the parser's value over OG; if both are missing default to the user's `preferences.defaultCurrency` (not yet wired — fall back to "USD" for now).
- Test fixtures: drop a few saved HTML snapshots into `src/lib/scrape/__fixtures__/` so we can iterate parsers without re-fetching live. Optional but recommended.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Pasting an Element Games kit URL into the quick-add bar produces a row with title, image, price, currency=GBP, vendor=Element Games within 5 seconds (Flow 8).
- Pasting a totally unsupported URL (e.g. a random blog post) produces a row with title=hostname, vendor=hostname, no image/price — the user can edit it in the detail drawer.
- The `scrapedMetadata` JSON has a `parser` field so future debugging is cheap.

**Commit message:** `P2.5: wishlist URL paste scraper (6 vendors + OG fallback)`

---

## P2.6 — Project ↔ Wishlist linkage + "Shopping for this" panel

- [x] Build this milestone

**Context.** A wishlist item can be tagged to a project. Inside the project workspace, a "Shopping for this" panel summarises linked items + their total. On the dashboard, a "Top wishes" panel shows the top 3-5 priority wanted items globally.

**Files to create.**
- `src/db/queries/wishlist.ts` additions: `listWishlistByProject(userId, projectId)`; `listTopWishes(userId, limit = 5)` — sorted by priority Urgent→Low then date_added desc, filtered to status=Wanted.
- `src/components/wishlist/ShoppingForThisPanel.tsx` — server component embedded in the project workspace. Renders 0-N wishlist rows tagged to the project + total. Empty state: `[ Nothing on the wishlist for this project ]`.
- `src/components/wishlist/TopWishesPanel.tsx` — server component embedded in `/projects` dashboard. Top 5 wanted items by priority, each clickable to the wishlist detail drawer (which deep-links via `?item=<id>` query param on `/wishlist`).
- `src/components/wishlist/TagToProjectMenu.tsx` — `'use client'`. Combobox popup over a wishlist row's project-tag column. Lists user's projects with a search filter; on select, calls `updateWishlistItem(id, { projectId })`.

**Files to modify.**
- `src/app/projects/[id]/page.tsx` — render `<ShoppingForThisPanel projectId={...} />` below the named-models panel.
- `src/app/projects/page.tsx` — render `<TopWishesPanel />` above the All Projects section (or in a sidebar slot if width allows).
- `src/components/wishlist/WishlistTable.tsx` — make the project-tag column a click target that opens `<TagToProjectMenu />`.

**Patterns to follow.**
- Drag-to-tag is a P2.7 stretch — skip it here. Click-to-pick is the v1 affordance.
- Top Wishes panel uses the same `ProjectRow`-style frame for visual consistency.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Tagging a wishlist row to a project from the table picker persists, and the row appears in that project's "Shopping for this" panel.
- The `/projects` dashboard renders the Top Wishes panel with up to 5 items.
- Untagging (selecting "(none)" in the picker) removes it from the project's panel.

**Commit message:** `P2.6: project ↔ wishlist link + shopping-for-this + top-wishes`

---

## P2.7 — Mark-bought flow: bump owned_count or create new project

- [ ] Build this milestone

**Context.** Painter buys a kit on their wishlist; the app needs to turn that purchase into either (a) `owned_count` bumped on an existing unit, or (b) a new project pre-filled from the kit. The wishlist item moves to `status="Bought"` and stays for spending review.

**Files to create.**
- `src/components/wishlist/MarkBoughtModal.tsx` — `'use client'`. Triggered by the row action `[ Mark Bought ]`. Two-tab modal:
  - **New project** — auto-fills `name = wishlistItem.title`, lets user pick a type (default Unit), count (default 1 — see kit-count inference below), parent (if any). Submit → `createProject` (existing P1.6 action), then `setWishlistStatus(id, "Bought")`, then redirect to the new project workspace.
  - **Existing unit** — lists user's projects (combobox filtered to types Unit + Single Model). On select, ask for a delta count (default = kit model count guess; clamp ≥ 1). Submit → `bumpCounter(projectId, "owned", delta)` (existing P1.7 action), then `setWishlistStatus(id, "Bought")`. Stay on /wishlist with a confirmation flash.
- `src/lib/wishlist/kitInference.ts` — pure helper. `inferKitContents(title): { modelCount: number; suggestedType: ProjectType }`. Heuristics: regex for `\bx?\s*(\d+)\b` (e.g. "Intercessors x10", "10 Intercessors", "10-pack"); known kit names dictionary (e.g. "Combat Patrol" → 30 models; "Start Collecting" → 20; "Intercessors" → 10). Default → 1. Suggested type: "Single Model" if count==1 else "Unit".

**Files to modify.**
- `src/components/wishlist/WishlistTable.tsx` — `[ Mark Bought ]` action triggers the modal.
- `src/components/wishlist/WishlistDetailDrawer.tsx` — also exposes the `[ Mark Bought ]` button.
- `src/lib/actions/wishlist.ts` — `setWishlistStatus` stamps `dateResolved` (already specced in P2.4); confirm it works here.

**Patterns to follow.**
- Modal: use the existing dialog primitive (or a thin wrapper around `<dialog>`). No new dialog lib unless P1 already added one (check `package.json`).
- Server actions chain: `createProject` then `setWishlistStatus` in a single server-action wrapper to keep the round-trip count down.
- For the existing-unit flow, the modal shows the unit's current counters before applying the delta so the painter can sanity-check.

**Implementation notes.**
- Kit inference dictionary stays small — 20-30 entries max for the common GW kits. Anything else falls back to regex or default-1. Painters will edit the count anyway.
- After mark-bought, the row moves out of the default `[Wanted]` view but reappears under `[Bought]`. Don't delete.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Flow 9: a wishlist item "Necron Warriors box" → mark bought → pick "Existing unit: My Necrons / Necron Warriors" → delta=10 → unit's `owned_count` goes from 0 → 10 in one round-trip. Item moves to Bought.
- New project branch: mark bought → "New project" tab → name pre-filled, count=10 inferred → submit → /projects/[id] opens with the right initial counters.

**Commit message:** `P2.7: mark-bought flow — bump owned or create project`

---

## P2.8 — Search anywhere (`/` shortcut) + dashboard polish

- [ ] Build this milestone

**Context.** Painters live by speed. The `/` shortcut focuses a global search box that filters Library + Wishlist results in a popover. Plus a small dashboard polish: confirm the Top Wishes panel reads well and add a "recently bought" footer line for spending awareness.

**Files to create.**
- `src/components/search/GlobalSearch.tsx` — `'use client'`. Mounted in the root layout (next to NavRail or as a floating affordance). Listens for `/` keypress globally (skip when an input is focused). Opens a centred popover with a single input. Results split into two sections: Paints (top 10 by relevance, via the Library's filter helpers) + Wishlist (top 10 by title match). Arrow keys navigate; Enter opens the result.
- `src/lib/search/index.ts` — `runGlobalSearch(query, paints, wishlist): { paints, wishlist }`. Pure function; tiny ranker (substring match → fuzzy fallback).
- `src/components/dashboard/RecentlyBoughtLine.tsx` — server component embedded in `/projects`. Shows `[ last 7 days: 4 items · $87.42 spent ]` if any. Hidden when empty.

**Files to modify.**
- `src/app/layout.tsx` — mount `<GlobalSearch />` once. Pass the paint catalog + wishlist as a server-side prop? No — let the GlobalSearch lazy-fetch on first open (avoids hydrating the catalog into every page). Use the Dexie loader from P2.1 for paints; fetch wishlist via a small route handler `/api/wishlist/list`.
- `src/app/api/wishlist/list/route.ts` — GET handler returning the user's wishlist for the search popover. Owner-scoped.

**Patterns to follow.**
- `/` keybinding only when `event.target` is `<body>` / not an editable element. Cmd/Ctrl+K is reserved for later (action palette, post-Phase 2).
- The popover is keyboard-first. Tab cycles between Paints / Wishlist sections; Enter activates the highlighted result.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Pressing `/` anywhere in the app opens the search popover. Typing "meph" shows Mephiston Red in Paints + any matching wishlist entries.
- Enter on a paint result navigates to `/library?paint=<id>` with the detail panel open.
- Enter on a wishlist result navigates to `/wishlist?item=<id>`.
- Recently-bought footer renders on `/projects` when bought items exist.

**Commit message:** `P2.8: global search + dashboard polish`

---

## Phase 2 ship checklist

After P2.8 lands, before declaring Phase 2 done:

- All three primary flows from V2-BUILD-PLAN §6 work end-to-end on desktop **and** a phone:
  - **Flow 7** — "Do I own Mephiston Red?" in 3 taps from cold start.
  - **Flow 8** — Paste a vendor URL → wishlist row populated in < 5s.
  - **Flow 9** — Mark bought → existing unit's `owned_count` increments cleanly.
- `npm run typecheck` exits 0 across the project.
- `paints.json` is current as of the latest Webscraper run.
- A throwaway end-to-end Playwright test asserts Flow 8 (the highest-risk flow because of the scrape).
- Ross uses it for 1 week on his actual armies; if it doesn't beat his current notes app, fix the gap before Phase 3.

---

## Conventions for milestone-builder

Same as PHASE1_PLAN.md:

- **Commit only locally; do not push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **New dependencies** must be flagged in the commit body.
- **No `any`. No `@ts-ignore`.** Strict mode is mandatory.
- **Match existing patterns.** Read neighbouring files in `src/components/`, `src/db/`, `src/lib/actions/` before introducing new ones.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use the existing tokens — don't introduce arbitrary hex.
- **Server-side first.** Default to server components. Only mark `'use client'` when interactivity is actually needed.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
