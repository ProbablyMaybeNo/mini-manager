PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe_step_completion` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`step_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `recipe_slot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recipe_step_completion`("id", "user_id", "step_id", "completed_at") SELECT "id", "user_id", "step_id", "completed_at" FROM `recipe_step_completion`;--> statement-breakpoint
DROP TABLE `recipe_step_completion`;--> statement-breakpoint
ALTER TABLE `__new_recipe_step_completion` RENAME TO `recipe_step_completion`;--> statement-breakpoint
DROP TABLE `recipe_step`;--> statement-breakpoint
DROP TABLE `recipe_zone`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `recipe_step_completion_user_step_idx` ON `recipe_step_completion` (`user_id`,`step_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_step_completion_user_step_unique` ON `recipe_step_completion` (`user_id`,`step_id`);
