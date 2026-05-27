import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
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
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  username: text("username").unique(),
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
   Relations
   ============================================================ */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  projects: many(projects),
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
}));

export const namedModelsRelations = relations(namedModels, ({ one }) => ({
  project: one(projects, {
    fields: [namedModels.projectId],
    references: [projects.id],
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
