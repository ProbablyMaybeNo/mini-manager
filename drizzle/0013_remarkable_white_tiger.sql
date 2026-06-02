-- Phase-14 spillover — paint_sessions table for the FOCUS panel
-- stopwatch. One row per painter sit-down per project: opens with
-- ended_at = null (in-progress), closes with ended_at + duration_seconds
-- on stop. paused_ms accumulates pause time so duration math can
-- subtract idle minutes. Cascade-deletes on user + project removal.
CREATE TABLE `paint_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_seconds` integer,
	`paused_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paint_sessions_user_started_idx` ON `paint_sessions` (`user_id`,`started_at`);