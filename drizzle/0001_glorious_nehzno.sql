CREATE TABLE `inventory_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`paint_id` text NOT NULL,
	`owned_count` integer DEFAULT 0 NOT NULL,
	`is_wishlisted` integer DEFAULT false NOT NULL,
	`last_purchased_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_owned_nonnegative" CHECK("inventory_entry"."owned_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `inventory_owner_idx` ON `inventory_entry` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_owner_paint_unique` ON `inventory_entry` (`owner_id`,`paint_id`);