-- P10.1 — Stripe billing scaffold.
-- Four new nullable columns on `user` (no default; safe on populated DB),
-- a singleton-style `meta_counters` table for billing-adjacent counters,
-- and a seed row tracking the Founder-Edition slot count (capped at 100).
CREATE TABLE `meta_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `plan_expires_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `founder_claimed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `user_stripe_customer_id_unique` ON `user` (`stripe_customer_id`);--> statement-breakpoint
-- Seed the Founder counter at zero. The Stripe webhook atomically
-- increments it on `checkout.session.completed` for the Founder price
-- and the /pricing page hides the Founder card once value >= 100.
INSERT INTO `meta_counters` (`key`, `value`, `updated_at`) VALUES ('founder_sold', 0, (CAST(strftime('%s', 'now') AS INTEGER) * 1000));