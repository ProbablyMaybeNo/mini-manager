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
ALTER TABLE `user` ALTER COLUMN "email" TO "email" text;--> statement-breakpoint
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
ALTER TABLE `user` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `recovery_email` text;--> statement-breakpoint
ALTER TABLE `user` ADD `recovery_email_verified` integer;