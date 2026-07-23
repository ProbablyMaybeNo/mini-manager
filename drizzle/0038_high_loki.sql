CREATE TABLE `sponsorship` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`stripe_session_id` text,
	`stripe_customer_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sponsorship_user_amount_idx` ON `sponsorship` (`user_id`,`amount_cents`);