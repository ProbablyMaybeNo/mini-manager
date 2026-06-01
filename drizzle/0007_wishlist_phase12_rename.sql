DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "import_owner_status_idx";--> statement-breakpoint
DROP INDEX "import_owner_created_idx";--> statement-breakpoint
DROP INDEX "inventory_owner_idx";--> statement-breakpoint
DROP INDEX "inventory_owner_paint_unique";--> statement-breakpoint
DROP INDEX "named_model_project_idx";--> statement-breakpoint
DROP INDEX "named_model_project_position";--> statement-breakpoint
DROP INDEX "palette_owner_idx";--> statement-breakpoint
DROP INDEX "project_owner_idx";--> statement-breakpoint
DROP INDEX "project_parent_idx";--> statement-breakpoint
DROP INDEX "project_archived_idx";--> statement-breakpoint
DROP INDEX "recipe_step_zone_idx";--> statement-breakpoint
DROP INDEX "recipe_step_zone_position";--> statement-breakpoint
DROP INDEX "recipe_zone_recipe_idx";--> statement-breakpoint
DROP INDEX "recipe_zone_recipe_position";--> statement-breakpoint
DROP INDEX "recipe_public_slug_unique";--> statement-breakpoint
DROP INDEX "recipe_owner_standalone_idx";--> statement-breakpoint
DROP INDEX "recipe_attached_project_idx";--> statement-breakpoint
DROP INDEX "recipe_attached_named_model_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "user_username_unique";--> statement-breakpoint
DROP INDEX "wishlist_owner_status_idx";--> statement-breakpoint
DROP INDEX "wishlist_owner_project_idx";--> statement-breakpoint
DROP INDEX "wishlist_owner_vendor_idx";--> statement-breakpoint
ALTER TABLE `wishlist_item` ALTER COLUMN "status" TO "status" text NOT NULL DEFAULT 'WISHLIST';--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `import_owner_status_idx` ON `import` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `import_owner_created_idx` ON `import` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `inventory_owner_idx` ON `inventory_entry` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_owner_paint_unique` ON `inventory_entry` (`owner_id`,`paint_id`);--> statement-breakpoint
CREATE INDEX `named_model_project_idx` ON `named_model` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `named_model_project_position` ON `named_model` (`project_id`,`position`);--> statement-breakpoint
CREATE INDEX `palette_owner_idx` ON `palette` (`owner_id`);--> statement-breakpoint
CREATE INDEX `project_owner_idx` ON `project` (`owner_id`);--> statement-breakpoint
CREATE INDEX `project_parent_idx` ON `project` (`parent_id`);--> statement-breakpoint
CREATE INDEX `project_archived_idx` ON `project` (`archived_at`);--> statement-breakpoint
CREATE INDEX `recipe_step_zone_idx` ON `recipe_step` (`zone_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_step_zone_position` ON `recipe_step` (`zone_id`,`position`);--> statement-breakpoint
CREATE INDEX `recipe_zone_recipe_idx` ON `recipe_zone` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_zone_recipe_position` ON `recipe_zone` (`recipe_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_public_slug_unique` ON `recipe` (`public_slug`);--> statement-breakpoint
CREATE INDEX `recipe_owner_standalone_idx` ON `recipe` (`owner_id`,`is_standalone`);--> statement-breakpoint
CREATE INDEX `recipe_attached_project_idx` ON `recipe` (`attached_project_id`);--> statement-breakpoint
CREATE INDEX `recipe_attached_named_model_idx` ON `recipe` (`attached_named_model_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `wishlist_owner_status_idx` ON `wishlist_item` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `wishlist_owner_project_idx` ON `wishlist_item` (`owner_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `wishlist_owner_vendor_idx` ON `wishlist_item` (`owner_id`,`vendor`);--> statement-breakpoint

-- P12.11 — Ross's Q6 locked status rename. The schema enum union flipped
-- from {Wanted, Bought, Cancelled} to {WISHLIST, PURCHASED, HOLD}; this
-- migration rewrites every existing row in-place so the application
-- doesn't fail Zod validation on a read of legacy data.
UPDATE `wishlist_item` SET `status` = 'WISHLIST' WHERE `status` = 'Wanted';--> statement-breakpoint
UPDATE `wishlist_item` SET `status` = 'PURCHASED' WHERE `status` = 'Bought';--> statement-breakpoint
UPDATE `wishlist_item` SET `status` = 'HOLD' WHERE `status` = 'Cancelled';--> statement-breakpoint

-- P12.11 — Add the kind column. Default 'paint' so freshly-added rows
-- predating the heuristic backfill below still get a sensible value.
ALTER TABLE `wishlist_item` ADD `kind` text DEFAULT 'paint' NOT NULL;--> statement-breakpoint

-- P12.11 — Heuristic backfill for kind. Anything whose title looks like
-- a kit / box / army / squad / warband / unit / terrain / tank /
-- character -> 'model'. Box / Terrain category OR model-retailer vendor
-- ALSO nudges towards 'model'. Anything still on the default 'paint'
-- is the safer choice (pre-P12 wishlist rows are mostly paints from
-- the Match tool's "add to wishlist" path).
UPDATE `wishlist_item`
SET `kind` = 'model'
WHERE
  `title` LIKE '%squad%' COLLATE NOCASE OR
  `title` LIKE '%warband%' COLLATE NOCASE OR
  `title` LIKE '%army%' COLLATE NOCASE OR
  `title` LIKE '%unit%' COLLATE NOCASE OR
  `title` LIKE '%kit%' COLLATE NOCASE OR
  `title` LIKE '%box%' COLLATE NOCASE OR
  `title` LIKE '%terrain%' COLLATE NOCASE OR
  `title` LIKE '%tank%' COLLATE NOCASE OR
  `title` LIKE '%character%' COLLATE NOCASE OR
  `category` IN ('Box','Terrain') OR
  `vendor` IN ('Element Games','Wayland Games','Goblin Gaming');