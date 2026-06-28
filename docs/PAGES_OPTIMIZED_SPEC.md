# The Mini Mainframe — Optimized Page & Panel Spec

Usability-first descriptions of every surface, written as the *ideal* version (not strictly the current build). Guiding principles throughout: one clear primary action per surface, glanceability over density, progressive disclosure (hide complexity until asked), full desktop/mobile parity, and never make the user retype what the app can infer.

---

## CORE APP SURFACES

### 1. Dashboard — the command center
**Function:** the home screen you land on after sign-in. It exists to answer one question instantly — *"what's the state of my backlog, and what should I paint next?"* — without making you dig.

**Optimized experience:**
- **Vitals row** — four readouts: Active projects · Completion % · Streak · Time logged. Big, white numerals, quiet labels. They reflow 2-up the moment the column narrows so they never collide. Their job is a 2-second pulse-check, nothing more.
- **The roster** (projects table) sits front and center — the full hierarchical list of everything you're tracking, because that's what you came to look at.
- **Resume strip** — surfaces the one or two projects you were mid-painting with a one-tap "back to the bench." Invisible when nothing's in progress, so a fresh account stays clean and a busy one gets a shortcut.
- **Planner glance** — a compact month calendar with your next deadline highlighted; tap it for the full planner. Keeps "don't get caught priming the night before a tournament" always in the corner of your eye.
- **Primary action:** a single, unmissable **+ New Project**. "Upload Army List" sits quietly beside it as the power path.
- **Empty / first-run:** instead of a blank slate, a teaching state — "Track your first army" with the three starter paths (create one · import a list · browse the library) and a dismissible welcome card that never nags twice.
- **States:** skeleton shimmer while loading; a calm, recoverable error panel with Retry if data drops.

### 2. Projects roster (the table)
**Function:** the working list — manage every army → unit → model → terrain as one collapsible tree, each item moving through its own pipeline. This is the spreadsheet you used to keep, made live.

**Optimized experience:**
- **Columns:** Title (tree, indented per depth) · Type chip · Recipe swatches · Status · Priority (editable inline) · Completion bar · Logged time (rolled up from children). Every column earns its place by being something you sort or act on.
- **Row click → the project's own page** — never a cramped popup. The row is the index; the page is the workspace.
- **Per-row verbs, always one tap away:** add a sub-project (type-aware — Army/Warband spawn Units, Units spawn Models; leaves offer nothing), open in Focus, delete (confirmed, cascades to children).
- **Filter/sort bar:** by status, type, priority, plus the two queries that actually matter to a painter — *"what's nearly done"* (finish-line momentum) and *"what's overdue"* (deadline triage).
- **Tree behaviour:** carets expand/collapse; alternating group banding keeps a dense list of armies visually separable; the selected row stays highlighted so you don't lose your spot.
- **Mobile:** each row becomes a stacked card carrying the same fields and the same actions, tree indent preserved. The table **never** forces horizontal scroll on a phone, and status/priority stay editable without opening the row.

### 3. Project page (nested / recursive) — `/projects/[id]`
**Function:** the dedicated, full-width workspace for a single project and its sub-projects. It recurses without limit — an Army contains Units, a Unit contains Models — and each level is its own page.

**Optimized experience:**
- **Header that orients you:** a ‹ back arrow + a clickable breadcrumb (`Dashboard ▸ Crimson Fists ▸ Intercessors`) + the project name + a **bold TYPE badge** so you always know how deep you are and what you're looking at.
- **Overall progress up top:** a headline completion bar plus the compact trio — # total · ✓ complete · 🕒 time — so the page leads with status.
- **Sub-projects list is the centerpiece:** each child renders as a clean, prominent row — name · recipe swatches · its own progress · edit/focus/delete. Click a child's name and you *drill into its page*; the breadcrumb deepens, back climbs out.
- **Secondary, tucked below (collapsed):** the editable details (rename, change type/status/priority), attached recipes, and free-form notes — there when you want them, out of the way when you don't.
- **One primary action:** "Start painting" → jumps to the Focus bench with this project and its recipe loaded.
- Roomy and full-bleed — it owns the whole screen rather than cramming into a sidebar.

### 4. Collection — what you own & what you want
**Function:** the inventory ledger for your paints and models (owned + wishlist), and the place you control spend. The dashboard tracks *progress*; the collection tracks *stuff and money*.

**Optimized experience:**
- **Two clean stat lines, zero clutter:** `PAINT: 24 owned · 6 wishlist · $312 spent · $48 remaining` / `MODELS: …`. No progress bars here — that responsibility lives on the dashboard, and duplicating it just confused the page.
- **Add in seconds:** one **+ Add** opens a modal with two routes side by side — **AUTO-ADD** (paste a store URL from GW / Element Games / Amazon / eBay and it scrapes name + price for you) and a **manual form** (name, game, faction, price, project, status). Picking the URL path means you never type eight fields again.
- **Editable rows:** a pencil on every entry reopens the modal pre-filled to fix a typo or update a status — no delete-and-re-add.
- **Budgeting layer (the standout):** set a budget per project (e.g. "$200 for the Crimson Fists"); as you add WISHLIST/OWNED items with costs, they subtract from it; the page shows remaining-per-project and an overall total. The collection becomes a spending *plan*, not just a list — directly useful for a hobby that quietly drains wallets.
- Filter by owned vs wishlist, game, or project.

### 5. Library — the paint catalog
**Function:** browse 7,000+ paints across every major brand. It's both a reference and the source of truth that recipes and the colour tools draw from.

**Optimized experience:**
- **Spatial colour map as the hero:** paints arranged by hue and value so you locate a colour by *looking*, the way you'd scan a paint rack — not by guessing a name into a search box.
- **Search + filter side panel:** brand, range, paint type, finish, "owned only," all in one scannable column with a live result count and one-tap "clear all." It slides over the map rather than reloading it, so you never lose your place.
- **Tap a paint → paint-info side panel:** the swatch big, brand/range/finish, and — the killer feature — **cross-brand equivalents** ("the Citadel match for this Vallejo"). From there: "I own this," "add to wishlist," or "use in a recipe."
- **Usability rule:** browsing is continuous; panels overlay, the grid stays put, scroll position survives.

### 6. Recipes — repeatable paint schemes
**Function:** capture *how* you painted something as ordered, reusable steps, each pinned to a real paint. The thing that turns "I think I used some blue" into a process you can repeat across a whole army and share.

**Optimized experience (the list):** a gallery of your recipes as colour-swatch cards — name, the scheme's colours, and where it's attached. Search and filter by colour or brand; a single **+ New recipe**.

#### Recipe creator / editor — `/recipes/[id]`
- **Each layer is a step:** a technique (basecoat / wash / layer / drybrush / glaze / highlight) + a **paint pulled straight from the library** (so the recipe doubles as a shopping list) + an optional note ("two thin coats").
- **Live preview swatch** stacks the layers so you see the predicted result as you build.
- **Drag to reorder**, duplicate a layer, and attach the finished recipe to any project in one click.
- **Share** produces a public permalink. **Pro:** describe a look in plain language and have it **AI-generated**, grounded in the real catalog so every suggested paint actually exists.

#### Shared recipe page — `/r/[slug]` & Gallery — `/gallery`
**Function:** a public, no-login view of a single recipe (steps + paints + preview) for sharing, plus a browsable gallery of community recipes.
**Optimized:** a clean read-only card; "copy to my recipes" for logged-in users; a soft "try the app" for visitors. Fast and link-friendly so recipes spread.

### 7. Focus bench — `/focus`
**Function:** the distraction-free paint-along view for the single model in front of you right now. Everything else in the app is planning; this is the doing.

**Optimized experience:**
- **One project, one screen:** its recipe as a tickable checklist, your notes, technique reminders, and inspiration images all in view at once.
- **Session timer / stopwatch:** start it, paint, check off layers as you go, and the logged hours roll up into the project — and its army — automatically.
- **Switch focus** from a dropdown and *everything* — header, recipe, progress, timer — re-seeds to the new project instantly, with no stale leftovers.
- **Usability rule:** ruthless about chrome. If it isn't about painting *this* model, it isn't on the screen.

### 8. Tools hub — `/tools` + sub-tools
**Function:** the colour-planning toolkit, so you nail the exact look before committing a brush (and a purchase).

- **Color Wheel** (`/tools/wheel`) — pick a colour, get harmony schemes (complementary / analogous / triadic / split); each result maps to real paints you can buy.
- **Paint Match** (`/tools/match`) — type a hex, eyedrop, or pick a colour → the closest real pots ranked by perceptual distance (ΔE / CIEDE2000), with brand equivalents. "I want *this* colour — what do I actually buy?"
- **Eyedropper** (`/tools/dropper`) — pull a colour straight off an uploaded reference photo (a 'Eavy Metal model, a real-world object) and match it to paints.
- **Stacking / Glaze previewer** (`/tools/stacking`) — stack an undercoat plus glazes/layers and **see the predicted blended result** before you mix anything, so you don't waste paint discovering it goes muddy.
- **Shared payoff:** every tool ends in the same place — "here are the real paints," with a one-tap "save as a recipe" so planning flows straight into doing.

#### Color-picker panel (shared tool surface)
A single consistent colour-input panel (hex field / sliders / eyedrop / swatch grid) reused across every tool, so the interaction is identical no matter which one you're in — learn it once, use it everywhere.

---

## OVERLAYS & SIDE PANELS

### Project create / edit
**Optimized:** "+ New Project" opens a focused create surface (name, type, status, priority) and, on save, **drops you straight onto the new project's page** ready to add units — no orphaned half-saved rows, no guessing where it went. Editing afterward happens on the page itself, not in a cramped slide-out.

### Army-import panel
**Function:** paste or upload an army list and it **builds the whole project tree for you** — army → units → models — parsed and ready. It turns a 20-minute manual setup into about ten seconds, and it's the single biggest "wow" moment for a new user with an existing army.

### Planner (calendar)
**Function:** your hobby calendar — tournaments, painting deadlines, club nights.
**Optimized:** a month grid with coloured event dots that sit *below* the date (never overlapping the number); click any day to add an event; an always-visible "upcoming" ticker so the next deadline is in your peripheral vision. On mobile it's a full-screen takeover launched from the dashboard's events bar.

---

## SETTINGS & SYSTEM

### Account / Settings — `/user`, `/user/account`
**Function:** profile, plan (Free / Pro), billing, data export, and the browser-extension token.
**Optimized:** one calm, scannable settings column; plan status and the upgrade path up top where they convert; destructive actions (delete account, wipe data) guarded and placed last so they're never a slip away.

### Theme Studio (power / dev) — `/dev/theme`
**Function:** live-tune the entire app's look — every type role (face + size) and the full colour palette — with a real-time whole-app preview and an export-to-code button, so design changes are self-serve.
**Optimized / roadmap:** add spacing-scale, density, and glow/scanline controls so the whole *feel*, not just type and colour, can be dialed without a code round-trip.

---

## PUBLIC / MARKETING

- **Landing** (`/`) — black, logo-matched, no visual seams. One-line pitch ("one command center for your whole painting hobby"), the feature highlights, and a single "Start free" CTA. No "free forever" clutter competing for the click.
- **Pricing** (`/pricing`) — Free vs Pro side by side, a clear gating matrix (what each tier unlocks), and one obvious upgrade button.
- **Auth** (`/sign-in`, `/sign-up`, `/reset`) — minimal, single-column, autofill-friendly, with recovery built in and no friction between "I want in" and "I'm in."
- **Legal** (`/privacy`, `/terms`) — plain, readable documents; no dark patterns.

---

**The through-line:** every surface funnels toward one core loop — *plan a colour → save it as a recipe → attach it to a project → paint it at the bench → watch the army fill in green* — and none of them ever make you retype what a URL, an army list, or the catalog already knows.
