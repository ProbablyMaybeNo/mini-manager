-- P13.4 — Fold "Single Model" into "Unit" + drop NamedModel entity.
--
-- Ross locked the answer (PHASE13_PLAN.md): named models go entirely.
-- Each existing `named_model` row is promoted to a child Unit project
-- under the unit it lived inside; its five stage booleans map onto
-- stage counters on the new project (built→buildCount=1, etc.).
-- Recipes attached to a named model re-attach to the new project row.
-- Finally the named_model table + the recipe.attached_named_model_id
-- column are dropped.

-- Step 1 — Backfill: rename existing "Single Model" projects to "Unit".
-- Single Model was already a 1-of, so the only change is the type label.
UPDATE `project` SET `type` = 'Unit' WHERE `type` = 'Single Model';
--> statement-breakpoint

-- Step 2 — Promote each `named_model` row to a child Unit project.
-- The new project id derives deterministically from the named_model id
-- ('nm_' || nm.id) so Step 3 can resolve recipe re-attachments without
-- a sub-query. parentId points at the project the named_model lived on,
-- count=1, owned_count=1 (the painter already had the mini), and the
-- five stage booleans translate to 1/0 stage counters honouring the
-- cascade CHECK constraint (count ≥ owned ≥ build ≥ prime ≥ paint ≥
-- base ≥ complete ≥ 0).
INSERT INTO `project` (
  `id`,
  `owner_id`,
  `parent_id`,
  `type`,
  `name`,
  `count`,
  `owned_count`,
  `build_count`,
  `prime_count`,
  `paint_count`,
  `base_count`,
  `complete_count`,
  `is_shelved`,
  `notes_md`,
  `reference_image_url`,
  `created_at`,
  `updated_at`
)
SELECT
  'nm_' || nm.`id`,
  p.`owner_id`,
  nm.`project_id`,
  'Unit',
  nm.`name`,
  1,
  1,
  CASE WHEN nm.`is_built` = 1 THEN 1 ELSE 0 END,
  CASE WHEN nm.`is_primed` = 1 THEN 1 ELSE 0 END,
  CASE WHEN nm.`is_painted` = 1 THEN 1 ELSE 0 END,
  CASE WHEN nm.`is_based` = 1 THEN 1 ELSE 0 END,
  CASE WHEN nm.`is_complete` = 1 THEN 1 ELSE 0 END,
  0,
  nm.`notes_md`,
  nm.`reference_image_url`,
  nm.`created_at`,
  nm.`updated_at`
FROM `named_model` nm
INNER JOIN `project` p ON p.`id` = nm.`project_id`;
--> statement-breakpoint

-- Step 3 — Re-attach recipes that were pinned to a named_model. Each
-- now points at the promoted project row.
UPDATE `recipe`
SET
  `attached_project_id` = 'nm_' || `attached_named_model_id`,
  `attached_named_model_id` = NULL,
  `is_standalone` = 0
WHERE `attached_named_model_id` IS NOT NULL;
--> statement-breakpoint

-- Step 4 — Drop the FK index before recreating the table (libsql can't
-- drop an index that no longer has a target column).
DROP INDEX `recipe_attached_named_model_idx`;
--> statement-breakpoint

-- Step 5 — Recreate `recipe` without the attached_named_model_id column
-- and its FK. SQLite can't ALTER ... DROP COLUMN when a foreign-key
-- definition still references the to-be-dropped table, so we do the
-- canonical "create __new, copy, drop, rename" dance.
CREATE TABLE `__new_recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`body_type` text DEFAULT 'infantry' NOT NULL,
	`attached_project_id` text,
	`is_standalone` integer DEFAULT false NOT NULL,
	`public_slug` text,
	`notes_md` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attached_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_recipe` (
  `id`, `owner_id`, `name`, `body_type`, `attached_project_id`,
  `is_standalone`, `public_slug`, `notes_md`, `created_at`, `updated_at`
)
SELECT
  `id`, `owner_id`, `name`, `body_type`, `attached_project_id`,
  `is_standalone`, `public_slug`, `notes_md`, `created_at`, `updated_at`
FROM `recipe`;
--> statement-breakpoint
DROP TABLE `recipe`;
--> statement-breakpoint
ALTER TABLE `__new_recipe` RENAME TO `recipe`;
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_public_slug_unique` ON `recipe` (`public_slug`);
--> statement-breakpoint
CREATE INDEX `recipe_owner_standalone_idx` ON `recipe` (`owner_id`,`is_standalone`);
--> statement-breakpoint
CREATE INDEX `recipe_attached_project_idx` ON `recipe` (`attached_project_id`);
--> statement-breakpoint

-- Step 6 — Drop the now-orphaned named_model table.
DROP TABLE `named_model`;
