CREATE TABLE `rate_limit_counter` (
	`bucket` text NOT NULL,
	`subject` text NOT NULL,
	`window` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`bucket`, `subject`, `window`)
);
