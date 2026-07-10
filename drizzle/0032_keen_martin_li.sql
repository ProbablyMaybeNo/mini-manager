ALTER TABLE `recipe` ADD `gallery_image_url` text;--> statement-breakpoint
ALTER TABLE `recipe` ADD `gallery_image_pathname` text;--> statement-breakpoint
ALTER TABLE `recipe` ADD `gallery_image_ratio` text;--> statement-breakpoint
ALTER TABLE `recipe` ADD `gallery_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe` ADD `gallery_submitted_at` integer;--> statement-breakpoint
ALTER TABLE `recipe` ADD `gallery_reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `recipe_gallery_status_idx` ON `recipe` (`gallery_status`);