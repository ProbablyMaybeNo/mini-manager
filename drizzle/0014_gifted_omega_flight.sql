CREATE TABLE `recipe_step_completion` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`step_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `recipe_step`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_step_completion_user_step_idx` ON `recipe_step_completion` (`user_id`,`step_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_step_completion_user_step_unique` ON `recipe_step_completion` (`user_id`,`step_id`);