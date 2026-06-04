CREATE TABLE `recipe_slot` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`technique` text NOT NULL,
	`paint_id` text,
	`custom_color_hex` text,
	`notes_md` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_slot_recipe_idx` ON `recipe_slot` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_slot_recipe_position` ON `recipe_slot` (`recipe_id`,`position`);--> statement-breakpoint
-- Backfill (2026-06-04 unify+flatten): collapse recipe_zone ⋈ recipe_step into
-- the flat recipe_slot list. Each step becomes one slot; position is recomputed
-- 0-based per RECIPE in (zone.position, step.position) order so the slot order
-- reads exactly as the old zones-then-steps did. Zone NAMES are dropped
-- (pure-flat: a slot is identified by its paint). step.id is preserved as
-- slot.id so recipe_step_completion rows stay valid through the later cutover.
-- The old recipe_zone / recipe_step tables are intentionally LEFT IN PLACE here
-- and removed in a later migration once all code reads from recipe_slot.
INSERT INTO `recipe_slot` (`id`, `recipe_id`, `position`, `technique`, `paint_id`, `custom_color_hex`, `notes_md`, `notes`, `created_at`)
SELECT
	s.`id`,
	z.`recipe_id`,
	(ROW_NUMBER() OVER (PARTITION BY z.`recipe_id` ORDER BY z.`position`, s.`position`, s.`id`)) - 1,
	s.`technique`,
	s.`paint_id`,
	s.`custom_color_hex`,
	s.`notes_md`,
	s.`notes`,
	s.`created_at`
FROM `recipe_step` s
JOIN `recipe_zone` z ON s.`zone_id` = z.`id`;