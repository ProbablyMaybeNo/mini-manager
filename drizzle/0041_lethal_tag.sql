PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
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
	`game` text,
	`model_class` text,
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
	CONSTRAINT "project_stage_bounds" CHECK(
        "__new_project"."count" >= 0
        AND "__new_project"."owned_count" >= 0 AND "__new_project"."owned_count" <= "__new_project"."count"
        AND "__new_project"."build_count" >= 0 AND "__new_project"."build_count" <= "__new_project"."count"
        AND "__new_project"."prime_count" >= 0 AND "__new_project"."prime_count" <= "__new_project"."count"
        AND "__new_project"."paint_count" >= 0 AND "__new_project"."paint_count" <= "__new_project"."count"
        AND "__new_project"."base_count" >= 0 AND "__new_project"."base_count" <= "__new_project"."count"
        AND "__new_project"."complete_count" >= 0 AND "__new_project"."complete_count" <= "__new_project"."count"
      )
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "owner_id", "parent_id", "type", "name", "count", "owned_count", "build_count", "prime_count", "paint_count", "base_count", "complete_count", "is_shelved", "faction", "game", "model_class", "priority", "target_date", "points_value", "notes_md", "reference_image_url", "created_at", "updated_at", "archived_at") SELECT "id", "owner_id", "parent_id", "type", "name", "count", "owned_count", "build_count", "prime_count", "paint_count", "base_count", "complete_count", "is_shelved", "faction", "game", "model_class", "priority", "target_date", "points_value", "notes_md", "reference_image_url", "created_at", "updated_at", "archived_at" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `project_owner_idx` ON `project` (`owner_id`);--> statement-breakpoint
CREATE INDEX `project_parent_idx` ON `project` (`parent_id`);--> statement-breakpoint
CREATE INDEX `project_archived_idx` ON `project` (`archived_at`);