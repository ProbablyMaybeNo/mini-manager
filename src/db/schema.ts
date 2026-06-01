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
   Domain — Project + NamedModel
   ============================================================ */

export const projectTypes = [
  "Army",
  "Warband",
  "Unit",
  "Single Model",
  "Terrain Piece",
  "Diorama",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const priorities = ["Urgent", "High", "Medium", "Low"] as const;
export type Priority = (typeof priorities)[number];

/**
 * Projects are the spine of the app. A Project can contain other
 * Projects (hard 3-level cap enforced at the application layer:
 * Army → Unit → NamedModel). Stage counters cascade in strict order
 * — enforced by check constraints below.
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

/**
 * NamedModel — created only when a unit has an individual that
 * needs a different scheme. Tracks five booleans (one per stage)
 * since each is a single mini.
 *
 * recipeOverrideId is nullable text for now; the Recipe table
 * arrives in Phase 3. Once added we'll wire up the foreign key.
 */
export const namedModels = sqliteTable(
  "named_model",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),

    isBuilt: integer("is_built", { mode: "boolean" }).notNull().default(false),
    isPrimed: integer("is_primed", { mode: "boolean" }).notNull().default(false),
    isPainted: integer("is_painted", { mode: "boolean" }).notNull().default(false),
    isBased: integer("is_based", { mode: "boolean" }).notNull().default(false),
    isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),

    recipeOverrideId: text("recipe_override_id"),
    notesMd: text("notes_md"),
    referenceImageUrl: text("reference_image_url"),

    ...timestamps,
  },
  (t) => ({
    projectIdx: index("named_model_project_idx").on(t.projectId),
    projectPositionUq: uniqueIndex("named_model_project_position").on(
      t.projectId,
      t.position,
    ),
    stageCascade: check(
      "named_model_stage_cascade",
      sql`
        (${t.isBuilt} = 1 OR ${t.isPrimed} = 0)
        AND (${t.isPrimed} = 1 OR ${t.isPainted} = 0)
        AND (${t.isPainted} = 1 OR ${t.isBased} = 0)
        AND (${t.isBased} = 1 OR ${t.isComplete} = 0)
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
 */
export const wishlistStatuses = ["WISHLIST", "PURCHASED", "HOLD"] as const;
export type WishlistStatus = (typeof wishlistStatuses)[number];

/**
 * P12.11 — wishlist_item.kind column. Splits the wishlist into
 * paint shopping vs model shopping. The /wishlist page renders
 * two separate tables driven off this column (P12.12), and the
 * scrape pipeline writes 'paint' by default for paint-detail
 * scrapes + 'model' for everything else.
 */
export const wishlistKinds = ["paint", "model"] as const;
export type WishlistKind = (typeof wishlistKinds)[number];

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
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    sourceUrl: text("source_url"),
    vendor: text("vendor"),
    price: integer("price_cents"), // store integer cents to avoid float drift
    currency: text("currency").default("USD"),
    category: text("category", { enum: wishlistCategories })
      .notNull()
      .default("Other"),
    priority: text("priority", { enum: priorities }).notNull().default("Medium"),
    status: text("status", { enum: wishlistStatuses })
      .notNull()
      .default("WISHLIST"),
    kind: text("kind", { enum: wishlistKinds }).notNull().default("paint"),
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
 * `recipe_step.technique` enum.
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
    attachedNamedModelId: text("attached_named_model_id").references(
      () => namedModels.id,
      { onDelete: "set null" },
    ),
    isStandalone: integer("is_standalone", { mode: "boolean" })
      .notNull()
      .default(false),
    publicSlug: text("public_slug").unique(),
    notesMd: text("notes_md"),
    ...timestamps,
  },
  (t) => ({
    ownerStandaloneIdx: index("recipe_owner_standalone_idx").on(
      t.ownerId,
      t.isStandalone,
    ),
    attachedProjectIdx: index("recipe_attached_project_idx").on(t.attachedProjectId),
    attachedNamedModelIdx: index("recipe_attached_named_model_idx").on(
      t.attachedNamedModelId,
    ),
  }),
);

export const recipeZones = sqliteTable(
  "recipe_zone",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    /** Maps to a silhouette JSON id (e.g. "armor-primary"). Nullable
     *  because the painter can name a custom zone outside the
     *  silhouette's preset list. */
    silhouetteZoneId: text("silhouette_zone_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    recipeIdx: index("recipe_zone_recipe_idx").on(t.recipeId),
    recipePositionUq: uniqueIndex("recipe_zone_recipe_position").on(
      t.recipeId,
      t.position,
    ),
  }),
);

export const recipeSteps = sqliteTable(
  "recipe_step",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => recipeZones.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    technique: text("technique", { enum: techniqueKeys }).notNull(),
    /** References paints.json by id — no SQL FK since the catalog
     *  is a static asset. Same pattern as `inventory_entry.paint_id`. */
    paintId: text("paint_id"),
    /** For "this is a mix": stores the rendered hex of the result. */
    customColorHex: text("custom_color_hex"),
    notesMd: text("notes_md"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    zoneIdx: index("recipe_step_zone_idx").on(t.zoneId),
    zonePositionUq: uniqueIndex("recipe_step_zone_position").on(
      t.zoneId,
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
] as const;
export type ImportSourceFormat = (typeof importSourceFormats)[number];

export const importStatuses = ["pending", "parsed", "applied", "failed"] as const;
export type ImportStatus = (typeof importStatuses)[number];

export const importParsers = ["text", "pdf", "battlescribe", "llm-fallback"] as const;
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
  namedModels: many(namedModels),
  wishlistItems: many(wishlistItems),
  attachedRecipes: many(recipes, { relationName: "recipe_attached_project" }),
}));

export const namedModelsRelations = relations(namedModels, ({ one, many }) => ({
  project: one(projects, {
    fields: [namedModels.projectId],
    references: [projects.id],
  }),
  attachedRecipes: many(recipes, { relationName: "recipe_attached_named_model" }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  attachedProject: one(projects, {
    fields: [recipes.attachedProjectId],
    references: [projects.id],
    relationName: "recipe_attached_project",
  }),
  attachedNamedModel: one(namedModels, {
    fields: [recipes.attachedNamedModelId],
    references: [namedModels.id],
    relationName: "recipe_attached_named_model",
  }),
  zones: many(recipeZones),
}));

export const recipeZonesRelations = relations(recipeZones, ({ one, many }) => ({
  recipe: one(recipes, {
    fields: [recipeZones.recipeId],
    references: [recipes.id],
  }),
  steps: many(recipeSteps),
}));

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  zone: one(recipeZones, {
    fields: [recipeSteps.zoneId],
    references: [recipeZones.id],
  }),
}));

/* ============================================================
   Type exports for the app
   ============================================================ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type NamedModel = typeof namedModels.$inferSelect;
export type NewNamedModel = typeof namedModels.$inferInsert;

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

export type RecipeZone = typeof recipeZones.$inferSelect;
export type NewRecipeZone = typeof recipeZones.$inferInsert;

export type RecipeStep = typeof recipeSteps.$inferSelect;
export type NewRecipeStep = typeof recipeSteps.$inferInsert;

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
