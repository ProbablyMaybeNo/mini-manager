ALTER TABLE `wishlist_item` ADD `paint_id` text;--> statement-breakpoint
CREATE INDEX `wishlist_owner_paintid_idx` ON `wishlist_item` (`owner_id`,`paint_id`);