CREATE TABLE `wishlist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text,
	`title` text NOT NULL,
	`image_url` text,
	`source_url` text,
	`vendor` text,
	`price_cents` integer,
	`currency` text DEFAULT 'USD',
	`category` text DEFAULT 'Other' NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Wanted' NOT NULL,
	`notes_md` text,
	`scraped_metadata` text,
	`date_added` integer NOT NULL,
	`date_resolved` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `wishlist_owner_status_idx` ON `wishlist_item` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `wishlist_owner_project_idx` ON `wishlist_item` (`owner_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `wishlist_owner_vendor_idx` ON `wishlist_item` (`owner_id`,`vendor`);