CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `named_model` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`is_built` integer DEFAULT false NOT NULL,
	`is_primed` integer DEFAULT false NOT NULL,
	`is_painted` integer DEFAULT false NOT NULL,
	`is_based` integer DEFAULT false NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`recipe_override_id` text,
	`notes_md` text,
	`reference_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "named_model_stage_cascade" CHECK(
        ("named_model"."is_built" = 1 OR "named_model"."is_primed" = 0)
        AND ("named_model"."is_primed" = 1 OR "named_model"."is_painted" = 0)
        AND ("named_model"."is_painted" = 1 OR "named_model"."is_based" = 0)
        AND ("named_model"."is_based" = 1 OR "named_model"."is_complete" = 0)
      )
);
--> statement-breakpoint
CREATE INDEX `named_model_project_idx` ON `named_model` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `named_model_project_position` ON `named_model` (`project_id`,`position`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`owned_count` integer DEFAULT 0 NOT NULL,
	`build_count` integer DEFAULT 0 NOT NULL,
	`prime_count` integer DEFAULT 0 NOT NULL,
	`paint_count` integer DEFAULT 0 NOT NULL,
	`base_count` integer DEFAULT 0 NOT NULL,
	`complete_count` integer DEFAULT 0 NOT NULL,
	`is_shelved` integer DEFAULT false NOT NULL,
	`faction` text,
	`priority` text DEFAULT 'Medium',
	`target_date` integer,
	`points_value` integer,
	`notes_md` text,
	`reference_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_stage_cascade" CHECK(
        "project"."count" >= 0
        AND "project"."owned_count" >= 0 AND "project"."owned_count" <= "project"."count"
        AND "project"."build_count" >= 0 AND "project"."build_count" <= "project"."owned_count"
        AND "project"."prime_count" >= 0 AND "project"."prime_count" <= "project"."build_count"
        AND "project"."paint_count" >= 0 AND "project"."paint_count" <= "project"."prime_count"
        AND "project"."base_count" >= 0 AND "project"."base_count" <= "project"."paint_count"
        AND "project"."complete_count" >= 0 AND "project"."complete_count" <= "project"."base_count"
      )
);
--> statement-breakpoint
CREATE INDEX `project_owner_idx` ON `project` (`owner_id`);--> statement-breakpoint
CREATE INDEX `project_parent_idx` ON `project` (`parent_id`);--> statement-breakpoint
CREATE INDEX `project_archived_idx` ON `project` (`archived_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`username` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
