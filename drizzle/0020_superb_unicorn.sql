CREATE TABLE `recipe_inspo` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_inspo_recipe_idx` ON `recipe_inspo` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_inspo_recipe_position` ON `recipe_inspo` (`recipe_id`,`position`);