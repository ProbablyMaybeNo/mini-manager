-- P14.1 — PLANNER tables. Three new tables that feed the dashboard
-- PLANNER section: events (calendar), activity_log (stream of painter
-- actions), and inspo_image (external URL reference board). All three
-- cascade-delete with the owning user.

CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_log_user_created_idx` ON `activity_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`event_date` integer NOT NULL,
	`kind` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_user_date_idx` ON `event` (`user_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `inspo_image` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`alt_text` text,
	`position_index` integer DEFAULT 0 NOT NULL,
	`is_displayed` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inspo_image_user_position_idx` ON `inspo_image` (`user_id`,`position_index`);