import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/* ============================================================
   ID helpers
   ============================================================ */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16));

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

/* ============================================================
   NextAuth tables
   Follows the v5 adapter contract exactly. Do not rename columns.
   ============================================================ */

export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => nanoid(16)),
  name: text("name"),
  // Email is nullable as of P9.1 — free tier sign-up is username + password
  // only. The NextAuth adapter writes here when an OAuth provider returns
  // an address; the recoveryEmail column is the user-facing reset address.
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  plan: text("plan").notNull().default("free"),
  /**
   * P10.1 — Stripe billing columns. All four are nullable on the free
   * tier; populated by the Stripe webhook after a successful Checkout.
   * `plan_expires_at` is a ms-timestamp; null means lifetime (one-time
   * Pro Lifetime / Founder purchase) OR an active monthly sub whose
   * next billing cycle hasn't been written yet.
   * `founder_claimed_at` stamps the moment a user took a Founder slot
   * (so the About page can render the list in order).
   */
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planExpiresAt: integer("plan_expires_at", { mode: "timestamp_ms" }),
  founderClaimedAt: integer("founder_claimed_at", { mode: "timestamp_ms" }),
  // Testing-period entitlement — set when a verified-email tester submits
  // feedback; getPlanForUser treats it as permanent Pro (free forever), so it
  // overrides the paywall once BILLING_ENFORCED flips on.
  freeForeverGrantedAt: integer("free_forever_granted_at", { mode: "timestamp_ms" }),
  recoveryEmail: text("recovery_email"),
  recoveryEmailVerified: integer("recovery_email_verified", {
    mode: "timestamp_ms",
  }),
  /**
   * P12.19 — Persistent library brand filter. JSON-encoded array of
   * brand strings the painter wants the /library page to show by
   * default. Null = "all brands visible". The library page's
   * existing FilterRail reads this as the initial state on load; the
   * painter can adjust it inline + persist via the /user page.
   */
  libraryBrandFilter: text("library_brand_filter"),
  /**
   * P13.11 — Pinned "what am I painting right now" project. The
   * /projects dashboard renders the focused project's full recipe at
   * the top in a FOCUS section so the painter can sit at the desk
   * and read the recipe + scribble per-step notes without navigating
   * away. Nullable; null means no focus is set (empty FOCUS section).
   *
   * ON DELETE SET NULL so deleting the focused project doesn't
   * cascade-delete the user row.
   */
  focusProjectId: text("focus_project_id").references(
    (): AnySQLiteColumn => projects.id,
    { onDelete: "set null" },
  ),
  /**
   * Browser-extension token version. The "Mini Manager Collection"
   * Chrome extension authenticates with a signed HMAC token of the form
   * `<userId>.<hmac(userId + "." + version, AUTH_SECRET)>`. Bumping this
   * integer (the "Regenerate" action) invalidates every previously
   * issued token for the user without storing the token itself —
   * verification recomputes the HMAC from this version and rejects a
   * mismatch. Defaults to 0; the first issued token signs version 0.
   */
  extensionTokenVersion: integer("extension_token_version")
    .notNull()
    .default(0),
  /**
   * First-run interactive tutorial. Null = the painter has never finished
   * (or skipped) the coachmark walkthrough, so the app auto-starts it on
   * their next signed-in load. Stamped with the completion/skip moment the
   * first time they reach the end or dismiss the tour; once set, the tour
   * never auto-shows again (it can still be restarted on demand from the
   * side-panel "Tutorial" entry). Nullable; existing rows backfill to NULL
   * so every current user is treated as "not yet seen".
   */
  tutorialCompletedAt: integer("tutorial_completed_at", {
    mode: "timestamp_ms",
  }),
  /**
   * First-touch acquisition attribution. Captured by the proxy
   * (`src/proxy.ts`) from `?ref=` / `utm_*` query params on landing into
   * the `mm_ref` cookie, then stamped onto the user row at signup
   * (`signUpWithCredentials`). JSON-encoded object of whichever of
   * `ref` / `utm_source` / `utm_medium` / `utm_campaign` were present
   * (see `src/lib/acquisition.ts`) — a single column rather than four so
   * this stays additive if more UTM-style params show up later. Null =
   * no tracked link on first visit (organic/direct). First-touch only:
   * never overwritten by a later visit or a later signup attempt.
   * Capture + persist only — no reporting UI reads this yet.
   */
  acquisitionRef: text("acquisition_ref"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdIdx: index("account_userId_idx").on(t.userId),
  }),
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

/* ============================================================
   Domain — Project
   ============================================================ */

export const projectTypes = [
  "Army",
  "Warband",
  "Unit",
  // 2026-06-05 — single-model sub-project. A "Model" is a 1-mini project
  // nested under an Army / Warband / Unit (e.g. a hero, a champion). Kept
  // deliberately simple — no "unique character" data model, it's just a
  // contained member of the existing project-type enum. `type` is a
  // Drizzle application-level enum with NO DB CHECK constraint, so adding
  // this value needs no migration; existing rows are unaffected.
  "Model",
  "Terrain Piece",
  "Diorama",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const priorities = ["Urgent", "High", "Medium", "Low"] as const;
export type Priority = (typeof priorities)[number];

/**
 * Projects are the spine of the app. A Project can contain other
 * Projects (hard 3-level cap enforced at the application layer:
 * Army → Unit → Unit). Stage counters cascade in strict order
 * — enforced by check constraints below. P13.4 folded the prior
 * NamedModel entity into Unit-typed project rows; legacy stage
 * booleans on each named_model row migrated to stage counters on
 * the new Unit rows (built→buildCount=1, etc.).
 */
export const projects = sqliteTable(
  "project",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => projects.id, {
      onDelete: "cascade",
    }),
    type: text("type", { enum: projectTypes }).notNull(),
    name: text("name").notNull(),

    // Stage counters cascade: count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ complete ≥ 0
    count: integer("count").notNull().default(0),
    ownedCount: integer("owned_count").notNull().default(0),
    buildCount: integer("build_count").notNull().default(0),
    primeCount: integer("prime_count").notNull().default(0),
    paintCount: integer("paint_count").notNull().default(0),
    baseCount: integer("base_count").notNull().default(0),
    completeCount: integer("complete_count").notNull().default(0),

    isShelved: integer("is_shelved", { mode: "boolean" }).notNull().default(false),

    faction: text("faction"),
    // Item 2 (batch/army-project-page) — free-text game/system the army
    // is built for (e.g. "Warhammer 40,000", "Age of Sigmar", "Bolt
    // Action"). Nullable free text — no curated enum, painters track all
    // sorts of systems.
    game: text("game"),
    // batch/model-warband — per-model "Class" cell. Free-text label the
    // painter types on a Warband's model rows (e.g. "Leader", "Bestigor",
    // "Champion"). Nullable; surfaced ONLY on Warband model (Unit
    // sub-project) rows. Empty input collapses to null at the action
    // layer. Length-capped ~40 at the action layer to keep the table cell
    // tidy. Additive migration 0019 — existing rows backfill to NULL.
    modelClass: text("model_class"),
    priority: text("priority", { enum: priorities }).default("Medium"),
    targetDate: integer("target_date", { mode: "timestamp_ms" }),
    pointsValue: integer("points_value"),

    notesMd: text("notes_md"),
    referenceImageUrl: text("reference_image_url"),

    ...timestamps,
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    ownerIdx: index("project_owner_idx").on(t.ownerId),
    parentIdx: index("project_parent_idx").on(t.parentId),
    archivedIdx: index("project_archived_idx").on(t.archivedAt),
    stageCascade: check(
      "project_stage_cascade",
      sql`
        ${t.count} >= 0
        AND ${t.ownedCount} >= 0 AND ${t.ownedCount} <= ${t.count}
        AND ${t.buildCount} >= 0 AND ${t.buildCount} <= ${t.ownedCount}
        AND ${t.primeCount} >= 0 AND ${t.primeCount} <= ${t.buildCount}
        AND ${t.paintCount} >= 0 AND ${t.paintCount} <= ${t.primeCount}
        AND ${t.baseCount} >= 0 AND ${t.baseCount} <= ${t.paintCount}
        AND ${t.completeCount} >= 0 AND ${t.completeCount} <= ${t.baseCount}
      `,
    ),
  }),
);

/* ============================================================
   Domain — Inventory (P2.3)
   Lightweight per-user "do I own this paint?" marks. Wishlist
   here is a single boolean star — a heavier WishlistItem entity
   for vendor / price / project context lives in its own table
   (added in P2.4).
   ============================================================ */

export const inventoryEntries = sqliteTable(
  "inventory_entry",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** References paints.json by id — no SQL foreign key since the
     *  catalog is a static asset, not a table. */
    paintId: text("paint_id").notNull(),
    ownedCount: integer("owned_count").notNull().default(0),
    isWishlisted: integer("is_wishlisted", { mode: "boolean" })
      .notNull()
      .default(false),
    lastPurchasedAt: integer("last_purchased_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => ({
    ownerIdx: index("inventory_owner_idx").on(t.ownerId),
    ownerPaintUq: uniqueIndex("inventory_owner_paint_unique").on(
      t.ownerId,
      t.paintId,
    ),
    nonNegativeOwned: check(
      "inventory_owned_nonnegative",
      sql`${t.ownedCount} >= 0`,
    ),
  }),
);

/* ============================================================
   Domain — Wishlist (P2.4)
   Vendor URL paste → row populated. Lives separately from the
   lightweight paint-star (`inventoryEntries.isWishlisted`) since
   a WishlistItem carries vendor / price / project context that
   doesn't apply to a generic "I want this paint".
   ============================================================ */

export const wishlistCategories = [
  "Box",
  "Bits",
  "Paint",
  "Tool",
  "Terrain",
  "Other",
] as const;
export type WishlistCategory = (typeof wishlistCategories)[number];

/**
 * Phase-12 (P12.11) wishlist status rename. Ross's Q6 locked answer:
 *   Wanted    -> WISHLIST
 *   Bought    -> PURCHASED
 *   Cancelled -> HOLD
 *
 * Lock-stepped with the project status rename (P12.6). The old
 * string values are no longer in the application's enum — the
 * Drizzle migration in this milestone rewrites every existing row
 * to the new vocabulary in-place.
 *
 * COLLECTIONS rebuild (batch/collections-rebuild): the wishlist surface
 * became the **COLLECTIONS** page — two tables driven off `wishlist_item`.
 * PAINTS and MODELS need DIFFERENT status vocabularies, so the column's
 * application-level enum is the UNION of both sets. There is no DB CHECK
 * constraint on `status` (it's a plain text column), so widening the union
 * needs NO destructive migration — existing rows keep their value and the
 * new lifecycle stages become assignable.
 *
 *   Paint statuses : WISHLIST · OWNED · HOLD
 *   Model statuses : WISHLIST · OWNED · BUILT · PRIMED · PAINTED · BASED · COMPLETE
 *
 * `PURCHASED` is retained as a deprecated-but-valid value so pre-rebuild
 * rows (and the legacy MarkBought flow / dashboard "recently bought"
 * readouts) keep parsing. New paint rows use OWNED instead. The two
 * per-kind subsets below are what the COLLECTIONS pickers actually surface.
 */
export const wishlistStatuses = [
  "WISHLIST",
  "OWNED",
  "HOLD",
  "BUILT",
  "PRIMED",
  "PAINTED",
  "BASED",
  "COMPLETE",
  // Deprecated — pre-COLLECTIONS rows + legacy MarkBought / dashboard
  // "recently bought" readouts. Not offered in the new pickers.
  "PURCHASED",
] as const;
export type WishlistStatus = (typeof wishlistStatuses)[number];

/** The status set a PAINT row can hold — the COLLECTIONS paint table's
 *  status picker iterates this (not the full union). */
export const paintCollectionStatuses = ["WISHLIST", "OWNED", "HOLD"] as const;
export type PaintCollectionStatus = (typeof paintCollectionStatuses)[number];

/** The status set a MODEL row can hold — the COLLECTIONS model table's
 *  status picker iterates this. Mirrors the project stage lifecycle
 *  (built → primed → painted → based → complete) plus the pre-acquisition
 *  WISHLIST / OWNED states. */
export const modelCollectionStatuses = [
  "WISHLIST",
  "OWNED",
  "BUILT",
  "PRIMED",
  "PAINTED",
  "BASED",
  "COMPLETE",
] as const;
export type ModelCollectionStatus = (typeof modelCollectionStatuses)[number];

/**
 * P12.11 — wishlist_item.kind column. Splits the wishlist into
 * paint shopping vs model shopping. The /wishlist page renders
 * two separate tables driven off this column (P12.12), and the
 * scrape pipeline writes 'paint' by default for paint-detail
 * scrapes + 'model' for everything else.
 */
export const wishlistKinds = ["paint", "model"] as const;
export type WishlistKind = (typeof wishlistKinds)[number];

/**
 * COLLECTIONS paint `type` vocabulary. Distinct from `category`
 * (Box / Bits / Paint / Tool…), this is the PAINT-specific medium type
 * the COLLECTIONS paint table surfaces in its `type` column: Contrast /
 * Wash / Acrylic / Varnish / Glaze / etc. Mirrors the static catalog's
 * `paintTypes` (src/lib/paints/types.ts) with the brief's extras folded
 * in (Acrylic, Glaze, Enamel, Oil). Nullable on the row — null renders
 * as "—". No DB CHECK (plain text column), validated app-side.
 */
export const collectionPaintTypes = [
  "Acrylic",
  "Contrast",
  "Wash",
  "Glaze",
  "Metallic",
  "Varnish",
  "Primer",
  "Air",
  "Ink",
  "Enamel",
  "Oil",
  "Pigment",
  "Effect",
  "Other",
] as const;
export type CollectionPaintType = (typeof collectionPaintTypes)[number];

export const wishlistItems = sqliteTable(
  "wishlist_item",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    /** COLLECTIONS — optional recipe attached to a paint row (the scheme it
     *  belongs to). Cleared if the recipe is deleted. */
    recipeId: text("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    sourceUrl: text("source_url"),
    vendor: text("vendor"),
    price: integer("price_cents"), // store integer cents to avoid float drift
    currency: text("currency").default("USD"),
    category: text("category", { enum: wishlistCategories })
      .notNull()
      .default("Other"),
    /**
     * COLLECTIONS rebuild — additive columns (migration 0021).
     *
     * `company`  — PAINT rows: the manufacturer / paint line owner
     *              (Citadel, Vallejo, Army Painter…), distinct from
     *              `vendor` which is the STORE the painter buys from.
     * `paintType`— PAINT rows: the medium type (Contrast / Wash / …),
     *              shown in the paint table's `type` column.
     * `game`     — MODEL rows: the game system (Warhammer 40k, AoS…).
     * `army`     — MODEL rows: the faction / army the model belongs to.
     *
     * All four nullable; existing rows backfill to NULL. They're free
     * text at the DB layer (no CHECK); `paintType` is validated against
     * `collectionPaintTypes` at the action layer.
     */
    company: text("company"),
    paintType: text("paint_type"),
    game: text("game"),
    army: text("army"),
    priority: text("priority", { enum: priorities }).notNull().default("Medium"),
    status: text("status", { enum: wishlistStatuses })
      .notNull()
      .default("WISHLIST"),
    kind: text("kind", { enum: wishlistKinds }).notNull().default("paint"),
    /**
     * Library ↔ Collection sync (batch/library-collection-sync). References
     * paints.json by id — same no-SQL-FK convention as
     * `inventory_entry.paint_id` (the catalog is a static asset, not a
     * table). Nullable: only PAINT-kind rows that are linked to a specific
     * catalog paint carry a value; manually-typed paint rows with no
     * catalog match stay null. At most one wishlist_item row should be
     * linked per (owner, paint_id) — enforced at the application layer by
     * `reconcilePaintOwnership` (src/lib/paints/reconcileOwnership.ts),
     * not by a DB unique constraint, since a null paintId is the common
     * case and SQLite unique indexes already treat NULLs as distinct.
     */
    paintId: text("paint_id"),
    notesMd: text("notes_md"),
    scrapedMetadata: text("scraped_metadata"), // JSON blob from the scraper (P2.5)
    dateAdded: integer("date_added", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    dateResolved: integer("date_resolved", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => ({
    ownerStatusIdx: index("wishlist_owner_status_idx").on(t.ownerId, t.status),
    ownerProjectIdx: index("wishlist_owner_project_idx").on(
      t.ownerId,
      t.projectId,
    ),
    ownerVendorIdx: index("wishlist_owner_vendor_idx").on(t.ownerId, t.vendor),
    ownerPaintIdx: index("wishlist_owner_paintid_idx").on(t.ownerId, t.paintId),
  }),
);

/* ============================================================
   Domain — Recipes (P3.1)
   A recipe is an ordered list of zones; each zone is an ordered
   list of technique steps; each step pins a paint from the catalog
   OR holds a custom hex (for mixes). Recipes can attach to a
   project, attach to a named model, or stand alone. The
   "at most one attachment" rule is enforced application-side
   (see src/lib/actions/recipes.ts) — SQLite's CHECK semantics
   around nullable FKs are awkward.
   ============================================================ */

export const bodyTypes = ["infantry", "vehicle", "monster", "terrain"] as const;
export type BodyType = (typeof bodyTypes)[number];

/**
 * `recipe_slot.technique` enum.
 *
 * Phase 12 (P12.3) repurposes this column from "painting technique"
 * (basecoat / wash / drybrush / etc.) to "layer assignment in Ross's
 * locked 8-layer set" (undercoat / basecoat / midcoat / highlight /
 * edge_highlight / wash / detail / metallic).
 *
 * The Phase-12 layer set is added at the FRONT of the union (so new
 * code defaults to it via picker UIs) but the old technique keys
 * stay as deprecated-but-still-valid values so:
 *   - existing recipes in the database keep parsing without a
 *     destructive enum-string migration
 *   - shared / imported recipes from before P12 still validate
 *   - the markdown share format keeps emitting the same strings
 *
 * The locked Phase-12 set:
 *   undercoat / basecoat / midcoat / highlight / edge_highlight
 *   / wash / detail / metallic
 *
 * Legacy values retained: layer / drybrush / glaze / stipple /
 * wet_blend / two_thin_coats / zenithal_prime. UI surfaces post-P12
 * should not offer them in pickers — but the schema still parses
 * them for back-compat.
 */
export const techniqueKeys = [
  // Phase-12 locked set
  "undercoat",
  "basecoat",
  "midcoat",
  "highlight",
  "edge_highlight",
  "wash",
  "detail",
  "metallic",
  // Legacy keys — retained for back-compat (P12.3)
  "layer",
  "drybrush",
  "glaze",
  "stipple",
  "wet_blend",
  "two_thin_coats",
  "zenithal_prime",
] as const;
export type TechniqueKey = (typeof techniqueKeys)[number];

/**
 * The locked Phase-12 layer subset — the keys a P12+ picker should
 * actually surface. UI consumers should iterate this, not the full
 * union, so legacy keys stay out of new pickers.
 */
export const phase12LayerKeys = [
  "undercoat",
  "basecoat",
  "midcoat",
  "highlight",
  "edge_highlight",
  "wash",
  "detail",
  "metallic",
] as const;
export type Phase12LayerKey = (typeof phase12LayerKeys)[number];

/** Human label for each Phase-12 layer. UI strings, not enum values. */
export const phase12LayerLabel: Record<Phase12LayerKey, string> = {
  undercoat: "Undercoat",
  basecoat: "Basecoat",
  midcoat: "Midcoat",
  highlight: "Highlight",
  edge_highlight: "Edge highlight",
  wash: "Wash",
  detail: "Detail",
  metallic: "Metallic",
};

export const recipes = sqliteTable(
  "recipe",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bodyType: text("body_type", { enum: bodyTypes }).notNull().default("infantry"),
    attachedProjectId: text("attached_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    isStandalone: integer("is_standalone", { mode: "boolean" })
      .notNull()
      .default(false),
    publicSlug: text("public_slug").unique(),
    /** Whether this recipe surfaces on the public `/gallery` browse grid.
     *  Deliberately decoupled from `publicSlug`: minting a share link (the
     *  editor's "⬡ SHARE LINK") only sets `publicSlug` so `/r/<slug>`
     *  resolves — it does NOT set this flag, so a painter's shared recipe
     *  never auto-lists on the public gallery. Only the curated seed set
     *  (`npm run db:seed-gallery`) sets this true today. */
    isListed: integer("is_listed", { mode: "boolean" }).notNull().default(false),
    notesMd: text("notes_md"),
    ...timestamps,
  },
  (t) => ({
    ownerStandaloneIdx: index("recipe_owner_standalone_idx").on(
      t.ownerId,
      t.isStandalone,
    ),
    attachedProjectIdx: index("recipe_attached_project_idx").on(t.attachedProjectId),
  }),
);

/**
 * Recipe slot — the unified, FLAT recipe model (2026-06-04 decision).
 *
 * A recipe is a flat ordered list of slots; each slot = ONE paint
 * (paintId OR customColorHex, exactly one) + its assigned layer
 * (`technique`). This is the single recipe-content table — it replaced
 * the old two-level recipe_zone → recipe_step structure and retired the
 * separate "Steps box" + the project-side "color scheme" as distinct
 * concepts. There is one concept (a Recipe) rendered identically in the
 * recipe editor and the project box.
 *
 * Migration 0016 created + backfilled this table from recipe_zone ⋈
 * recipe_step (flattening per recipe; step.id preserved as slot.id);
 * migration 0017 dropped recipe_zone / recipe_step and re-pointed the
 * completion FK to recipe_slot.
 */
export const recipeSlots = sqliteTable(
  "recipe_slot",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    technique: text("technique", { enum: techniqueKeys }).notNull(),
    /** References paints.json by id — no SQL FK (static catalog asset),
     *  mirroring recipe_step.paint_id. Exactly one of paintId /
     *  customColorHex is set (validated in the action layer). */
    paintId: text("paint_id"),
    customColorHex: text("custom_color_hex"),
    /** Recipe-author description (legacy `notesMd`), carried from steps. */
    notesMd: text("notes_md"),
    /** Painter's working notes for this paint (P13.11), carried from steps. */
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    recipeIdx: index("recipe_slot_recipe_idx").on(t.recipeId),
    recipePositionUq: uniqueIndex("recipe_slot_recipe_position").on(
      t.recipeId,
      t.position,
    ),
  }),
);

/* ============================================================
   Domain — Recipe inspo (item 4)
   ============================================================
   A flat, contained child of recipe: the painter saves reference
   links / image URLs they found online for a recipe (e.g. a
   technique tutorial, a 'eavy-metal photo). One row per saved
   link, ordered by `position` like recipe_slot. `label` is an
   optional human caption; `url` is the link/image address. Mirrors
   the recipe_slot shape (cascade on recipe delete, position uq)
   rather than introducing a new persistence pattern.
   ============================================================ */

export const recipeInspo = sqliteTable(
  "recipe_inspo",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** The link or image URL the painter saved. */
    url: text("url").notNull(),
    /** Resolved og:image / direct-image URL for `url`, cached so page links
     *  (Pinterest / IG / ArtStation) render as thumbnails instead of raw text.
     *  Null = not resolved yet or no image found → fall back to <img src={url}>. */
    imageUrl: text("image_url"),
    /** Optional human caption (e.g. "Duncan's edge highlight tutorial"). */
    label: text("label"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    recipeIdx: index("recipe_inspo_recipe_idx").on(t.recipeId),
    recipePositionUq: uniqueIndex("recipe_inspo_recipe_position").on(
      t.recipeId,
      t.position,
    ),
  }),
);

/* ============================================================
   Domain — Palettes (P4.4)
   Free-floating saved colour sets. Tools (Wheel / Match /
   Eyedropper / Gradient) emit them; the Recipe layer consumes
   them via the send-to-recipe modal. Not project-scoped — a
   palette lives by ownerId only.

   `colorHexes` + `paintIds` are JSON-encoded text columns rather
   than separate rows because palettes are always read and written
   whole; there's no per-row query workload to amortise.
   ============================================================ */

export const paletteSources = [
  "manual",
  "wheel",
  "eyedropper",
  "match",
  "gradient",
] as const;
export type PaletteSource = (typeof paletteSources)[number];

export const palettes = sqliteTable(
  "palette",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source", { enum: paletteSources }).notNull(),
    /** JSON-encoded `string[]` of `#RRGGBB` hexes, in display order. */
    colorHexes: text("color_hexes").notNull(),
    /** JSON-encoded `(string | null)[]` of paint ids, same length as
     *  colorHexes. null entries mean "no paint match" (e.g. a custom
     *  hex with no sub-2-ΔE pin). */
    paintIds: text("paint_ids").notNull(),
    ...timestamps,
  },
  (t) => ({
    ownerIdx: index("palette_owner_idx").on(t.ownerId),
  }),
);

/* ============================================================
   Domain — Imports (P7.1)
   First-class import records. Every upload (paste / PDF / .ros /
   .rosz) gets persisted with input preview + parsed tree + status,
   so a painter can re-open a half-failed import and so we have
   telemetry on parser quality. `parsedTree` is a JSON-encoded
   ImportedTree (small payloads, never queried by inner shape).
   ============================================================ */

export const importSourceFormats = [
  "plain-text",
  "pdf",
  "battlescribe-ros",
  "battlescribe-rosz",
  "json",
] as const;
export type ImportSourceFormat = (typeof importSourceFormats)[number];

export const importStatuses = ["pending", "parsed", "applied", "failed"] as const;
export type ImportStatus = (typeof importStatuses)[number];

export const importParsers = ["text", "pdf", "battlescribe", "llm-fallback", "json"] as const;
export type ImportParser = (typeof importParsers)[number];

export const imports = sqliteTable(
  "import",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceFormat: text("source_format", { enum: importSourceFormats }).notNull(),
    /** First 500 chars of the input — drives the "what did I upload?" sidebar
     *  without forcing us to retain the full original blob. */
    sourceTextPreview: text("source_text_preview"),
    sourceFileSize: integer("source_file_size"),
    status: text("status", { enum: importStatuses }).notNull().default("pending"),
    /** JSON-encoded ImportedTree (see src/lib/imports/types.ts). Nullable
     *  until the parse step completes. */
    parsedTree: text("parsed_tree"),
    parserConfidence: real("parser_confidence"),
    parserUsed: text("parser_used", { enum: importParsers }),
    errorMessage: text("error_message"),
    appliedProjectId: text("applied_project_id").references(
      (): AnySQLiteColumn => projects.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => ({
    ownerStatusIdx: index("import_owner_status_idx").on(t.ownerId, t.status),
    ownerCreatedIdx: index("import_owner_created_idx").on(t.ownerId, t.createdAt),
  }),
);

/* ============================================================
   Relations
   ============================================================ */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  projects: many(projects),
  inventoryEntries: many(inventoryEntries),
  wishlistItems: many(wishlistItems),
  recipes: many(recipes),
  palettes: many(palettes),
  imports: many(imports),
  recipeStepCompletions: many(recipeStepCompletion),
  paintNotes: many(paintNotes),
}));



export const palettesRelations = relations(palettes, ({ one }) => ({
  owner: one(users, { fields: [palettes.ownerId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  parent: one(projects, {
    fields: [projects.parentId],
    references: [projects.id],
    relationName: "project_tree",
  }),
  children: many(projects, { relationName: "project_tree" }),
  wishlistItems: many(wishlistItems),
  attachedRecipes: many(recipes, { relationName: "recipe_attached_project" }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  attachedProject: one(projects, {
    fields: [recipes.attachedProjectId],
    references: [projects.id],
    relationName: "recipe_attached_project",
  }),
  slots: many(recipeSlots),
  inspo: many(recipeInspo),
}));

export const recipeSlotsRelations = relations(recipeSlots, ({ one, many }) => ({
  recipe: one(recipes, {
    fields: [recipeSlots.recipeId],
    references: [recipes.id],
  }),
  completions: many(recipeStepCompletion),
}));

export const recipeInspoRelations = relations(recipeInspo, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeInspo.recipeId],
    references: [recipes.id],
  }),
}));

/* ============================================================
   Domain — Recipe slot completion (P15.0 / 2026-06-04 flatten)
   ============================================================
   Per-painter "I've finished this slot" marks. Keyed by
   (user_id, step_id) so done-state is local to the painter who owns
   the recipe — never global. A row's existence IS the done flag;
   un-ticking deletes the row rather than carrying a boolean, so the
   table stays sparse (only done slots occupy space).

   The column is still named `step_id` for stability — its value is a
   recipe_slot.id (== the old recipe_step.id, preserved by migration
   0016's backfill). Migration 0017 re-points the FK from recipe_step
   to recipe_slot; the stored values are unchanged.

   The FOCUS panel renders a checkbox per slot; ticking inserts a row,
   un-ticking removes it. "Advance slot" completes the slot + jumps to
   the next undone one. Recipe completion % is
   `count(done rows for this recipe's slots) / total slots`.

   Cascade-deletes on BOTH the owning user (account deletion) and the
   slot (recipe edit removes a slot → its completion marks vanish).
   ============================================================ */

export const recipeStepCompletion = sqliteTable(
  "recipe_step_completion",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stepId: text("step_id")
      .notNull()
      .references(() => recipeSlots.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    /** Hot path: "which slots has this user completed?" — the FOCUS
     *  panel reads all completion rows for the active recipe's slots
     *  scoped to the painter. */
    userStepIdx: index("recipe_step_completion_user_step_idx").on(
      t.userId,
      t.stepId,
    ),
    /** A painter can only mark a given slot done once. Re-ticking is a
     *  no-op insert guarded by this unique index. */
    userStepUq: uniqueIndex("recipe_step_completion_user_step_unique").on(
      t.userId,
      t.stepId,
    ),
  }),
);

export const recipeStepCompletionRelations = relations(
  recipeStepCompletion,
  ({ one }) => ({
    user: one(users, {
      fields: [recipeStepCompletion.userId],
      references: [users.id],
    }),
    slot: one(recipeSlots, {
      fields: [recipeStepCompletion.stepId],
      references: [recipeSlots.id],
    }),
  }),
);

export type RecipeStepCompletion = typeof recipeStepCompletion.$inferSelect;
export type NewRecipeStepCompletion = typeof recipeStepCompletion.$inferInsert;

/* ============================================================
   Domain — Per-paint notes (P15.x)
   ============================================================
   A painter's free-form note attached to a *paint* (not a step).
   The note follows that paint everywhere it's pinned — editing it on
   one FOCUS step updates every occurrence of the same paint. Distinct
   from `recipe_step.notes`, which is a per-occurrence working note.

   Keyed by (user_id, paint_id) with a unique index so each painter
   has at most one note per paint. `paint_id` references paints.json by
   id with NO SQL foreign key — the catalog is a static asset, not a
   table (same pattern/comment as `inventory_entry.paint_id`). An empty
   note is cleared by deleting the row, keeping the table sparse.

   Cascade-deletes with the owning user (account deletion).
   ============================================================ */

export const paintNotes = sqliteTable(
  "paint_notes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** References paints.json by id — no SQL foreign key since the
     *  catalog is a static asset, not a table. */
    paintId: text("paint_id").notNull(),
    note: text("note"),
    ...timestamps,
  },
  (t) => ({
    userIdx: index("paint_notes_user_idx").on(t.userId),
    userPaintUq: uniqueIndex("paint_notes_user_paint_unique").on(
      t.userId,
      t.paintId,
    ),
  }),
);

export const paintNotesRelations = relations(paintNotes, ({ one }) => ({
  user: one(users, { fields: [paintNotes.userId], references: [users.id] }),
}));

export type PaintNote = typeof paintNotes.$inferSelect;
export type NewPaintNote = typeof paintNotes.$inferInsert;

/* ============================================================
   Type exports for the app
   ============================================================ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const inventoryEntriesRelations = relations(inventoryEntries, ({ one }) => ({
  owner: one(users, {
    fields: [inventoryEntries.ownerId],
    references: [users.id],
  }),
}));

export type InventoryEntry = typeof inventoryEntries.$inferSelect;
export type NewInventoryEntry = typeof inventoryEntries.$inferInsert;

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  owner: one(users, {
    fields: [wishlistItems.ownerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [wishlistItems.projectId],
    references: [projects.id],
  }),
}));

export type WishlistItem = typeof wishlistItems.$inferSelect;
export type NewWishlistItem = typeof wishlistItems.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type RecipeSlot = typeof recipeSlots.$inferSelect;
export type NewRecipeSlot = typeof recipeSlots.$inferInsert;

export type RecipeInspo = typeof recipeInspo.$inferSelect;
export type NewRecipeInspo = typeof recipeInspo.$inferInsert;

export type Palette = typeof palettes.$inferSelect;
export type NewPalette = typeof palettes.$inferInsert;

export const importsRelations = relations(imports, ({ one }) => ({
  owner: one(users, { fields: [imports.ownerId], references: [users.id] }),
  appliedProject: one(projects, {
    fields: [imports.appliedProjectId],
    references: [projects.id],
  }),
}));

export type Import = typeof imports.$inferSelect;
export type NewImport = typeof imports.$inferInsert;

/* ============================================================
   Domain — Phase 14 PLANNER tables
   ============================================================
   Three sibling tables feeding the dashboard PLANNER section:

     events       — painter's calendar (tournaments, deadlines,
                    battles, other). Rendered as a month grid on
                    the dashboard.

     activity_log — append-only stream of "the painter did a
                    thing" rows. Drives the activity widget +
                    streak counter + heatmap.

     inspo_images — external URL pastes (Pinterest / IG /
                    ArtStation). NO storage, NO fetch — display
                    via <img src={url}>. position_index controls
                    drag-order; is_displayed lets the painter
                    park images without deleting them.

   All three cascade-delete with the owning user.
   ============================================================ */

export const eventKinds = ["tournament", "deadline", "battle", "other"] as const;
export type EventKind = (typeof eventKinds)[number];

export const events = sqliteTable(
  "event",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Stored as unix-ms timestamp like the rest of the schema. The
     *  calendar widget interprets this as a day-local date — time of
     *  day is ignored. */
    eventDate: integer("event_date", { mode: "timestamp_ms" }).notNull(),
    kind: text("kind", { enum: eventKinds }).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userDateIdx: index("event_user_date_idx").on(t.userId, t.eventDate),
  }),
);

/**
 * `activity_log.kind` enum. Extensible — adding a new entry here
 * means downstream readers (activity stream + streak + heatmap)
 * gain it for free; the only constraint is that the value is a
 * string the painter can read in the stream microcopy.
 */
export const activityLogKinds = [
  "stage_bump",
  "recipe_created",
  "project_created",
  "paint_added",
  "slot_added",
  // Phase-14 stopwatch: emitted on session STOP only (start would
  // spam the activity stream — every painter sitdown is a no-op).
  "paint_session",
] as const;
export type ActivityLogKind = (typeof activityLogKinds)[number];

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: activityLogKinds }).notNull(),
    /** Optional foreign-key-ish pointer to the entity that triggered
     *  the row — project id for stage_bump / project_created,
     *  recipe id for recipe_created, wishlist item id for paint_added,
     *  zone id for slot_added. Not enforced as a SQL FK because the
     *  target table varies by kind. */
    refId: text("ref_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    /** Descending lookup by user — the activity stream reads "last 20
     *  for this user ordered by created_at desc", so this index is
     *  the hot path. Drizzle emits a plain BTree; we order desc at
     *  query time. */
    userCreatedIdx: index("activity_log_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export const inspoImages = sqliteTable(
  "inspo_image",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** External URL — Pinterest / IG / ArtStation. No fetch, no
     *  storage. Display via <img src={url}>. URL shape is validated
     *  at the action layer, not at the schema level. */
    url: text("url").notNull(),
    altText: text("alt_text"),
    /** Drag order on the gallery grid. 0 = first cell. */
    positionIndex: integer("position_index").notNull().default(0),
    /** False = parked / hidden, True = visible on the dashboard
     *  gallery. Lets the painter curate the on-display set without
     *  destroying the row. */
    isDisplayed: integer("is_displayed", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userPositionIdx: index("inspo_image_user_position_idx").on(
      t.userId,
      t.positionIndex,
    ),
  }),
);

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, { fields: [events.userId], references: [users.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}));

export const inspoImagesRelations = relations(inspoImages, ({ one }) => ({
  user: one(users, { fields: [inspoImages.userId], references: [users.id] }),
}));

/**
 * Phase-14 spillover — stopwatch sessions.
 *
 * Records a painter's at-the-desk time per project. A session opens
 * with `ended_at = null` (in-progress) and closes with `ended_at` +
 * `duration_seconds` stamped. `paused_ms` accumulates pause time so
 * the duration calculation can subtract idle minutes — `duration_seconds
 *  = (ended_at - started_at - paused_ms) / 1000` rounded down.
 *
 * One open session per user is the convention (the start action
 * refuses to open a new one if any session has `ended_at = null`).
 * Cascade-deletes follow user/project so orphaned sessions don't pile
 * up after a project removal.
 */
export const paintSessions = sqliteTable(
  "paint_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    /** Null while in-progress; stamped on stop. */
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    /** Computed on stop = floor((endedAt - startedAt - pausedMs) / 1000). */
    durationSeconds: integer("duration_seconds"),
    /** Cumulative pause time in ms. 0 until first pause. */
    pausedMs: integer("paused_ms").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    /** Hot path: "today's sessions for this user" + "in-progress
     *  lookup". Descending startedAt is the natural rollup order. */
    userStartedIdx: index("paint_sessions_user_started_idx").on(
      t.userId,
      t.startedAt,
    ),
  }),
);

export const paintSessionsRelations = relations(paintSessions, ({ one }) => ({
  user: one(users, { fields: [paintSessions.userId], references: [users.id] }),
  project: one(projects, {
    fields: [paintSessions.projectId],
    references: [projects.id],
  }),
}));

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type ActivityLogRow = typeof activityLog.$inferSelect;
export type NewActivityLogRow = typeof activityLog.$inferInsert;

export type InspoImage = typeof inspoImages.$inferSelect;
export type NewInspoImage = typeof inspoImages.$inferInsert;

export type PaintSession = typeof paintSessions.$inferSelect;
export type NewPaintSession = typeof paintSessions.$inferInsert;

/* ============================================================
   Domain — Phase 10 BILLING tables
   ============================================================
   Singleton-style key/value store for billing-adjacent counters.
   The seeded `founder_sold` row tracks how many Founder Edition
   slots have been claimed; the /pricing page reads it to render
   "X of 100 remaining", and the Stripe webhook atomically bumps
   it when a `checkout.session.completed` for the Founder price
   fires. Other future counters (sign-ups, daily metrics) can
   ride the same table without further schema churn.
   ============================================================ */

export const metaCounters = sqliteTable("meta_counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type MetaCounter = typeof metaCounters.$inferSelect;
export type NewMetaCounter = typeof metaCounters.$inferInsert;

/* ============================================================
   Tester feedback — in-app "Report an issue" widget
   ============================================================
   Lets signed-in testers flag bugs / ideas straight from the app
   shell (no Vercel comments). One row per submission; `page_url`
   captures where they were when they hit Report, `category` buckets
   the note. Cascade-deletes with the user so removing an account
   tidies their reports too.
   ============================================================ */

export const feedbackCategories = ["bug", "idea", "other"] as const;
export type FeedbackCategory = (typeof feedbackCategories)[number];

export const feedback = sqliteTable(
  "feedback",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    category: text("category", { enum: feedbackCategories })
      .notNull()
      .default("other"),
    /** Path (+ optional query) the tester was on when reporting. */
    pageUrl: text("page_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    /** Triage read: "newest reports for this user / overall". */
    userCreatedIdx: index("feedback_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.id] }),
}));

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
