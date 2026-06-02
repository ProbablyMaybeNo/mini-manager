CREATE TABLE `paint_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paint_id` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paint_notes_user_idx` ON `paint_notes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `paint_notes_user_paint_unique` ON `paint_notes` (`user_id`,`paint_id`);