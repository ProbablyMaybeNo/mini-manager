CREATE TABLE `recipe_step` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`position` integer NOT NULL,
	`technique` text NOT NULL,
	`paint_id` text,
	`custom_color_hex` text,
	`notes_md` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `recipe_zone`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_step_zone_idx` ON `recipe_step` (`zone_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_step_zone_position` ON `recipe_step` (`zone_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe_zone` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`silhouette_zone_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_zone_recipe_idx` ON `recipe_zone` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_zone_recipe_position` ON `recipe_zone` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`body_type` text DEFAULT 'infantry' NOT NULL,
	`attached_project_id` text,
	`attached_named_model_id` text,
	`is_standalone` integer DEFAULT false NOT NULL,
	`public_slug` text,
	`notes_md` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attached_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`attached_named_model_id`) REFERENCES `named_model`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_public_slug_unique` ON `recipe` (`public_slug`);--> statement-breakpoint
CREATE INDEX `recipe_owner_standalone_idx` ON `recipe` (`owner_id`,`is_standalone`);--> statement-breakpoint
CREATE INDEX `recipe_attached_project_idx` ON `recipe` (`attached_project_id`);--> statement-breakpoint
CREATE INDEX `recipe_attached_named_model_idx` ON `recipe` (`attached_named_model_id`);