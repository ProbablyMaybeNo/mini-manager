CREATE TABLE `import` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_format` text NOT NULL,
	`source_text_preview` text,
	`source_file_size` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`parsed_tree` text,
	`parser_confidence` real,
	`parser_used` text,
	`error_message` text,
	`applied_project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`applied_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_owner_status_idx` ON `import` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `import_owner_created_idx` ON `import` (`owner_id`,`created_at`);