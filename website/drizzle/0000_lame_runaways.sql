CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`email` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`use_case` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`consent_version` text NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text NOT NULL,
	`removal_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_removal_hash_unique` ON `waitlist` (`removal_hash`);