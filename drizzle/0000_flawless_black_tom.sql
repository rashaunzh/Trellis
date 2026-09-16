CREATE TABLE `record_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_relations_unique_idx` ON `record_relations` (`source_id`,`target_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `record_relations_source_idx` ON `record_relations` (`source_id`);--> statement-breakpoint
CREATE INDEX `record_relations_target_idx` ON `record_relations` (`target_id`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`record_type` text NOT NULL,
	`line` text,
	`module` text,
	`project_id` text,
	`schedule_role` text DEFAULT 'candidate' NOT NULL,
	`status` text DEFAULT 'backlog' NOT NULL,
	`planned_week` text,
	`estimated_minutes` integer DEFAULT 0 NOT NULL,
	`actual_minutes` integer DEFAULT 0 NOT NULL,
	`completion_criteria` text DEFAULT '' NOT NULL,
	`acceptance` text DEFAULT 'unreviewed' NOT NULL,
	`source_url` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_type_idx` ON `records` (`record_type`);--> statement-breakpoint
CREATE INDEX `records_line_idx` ON `records` (`line`);--> statement-breakpoint
CREATE INDEX `records_project_idx` ON `records` (`project_id`);--> statement-breakpoint
CREATE INDEX `records_status_idx` ON `records` (`status`);--> statement-breakpoint
CREATE INDEX `records_week_idx` ON `records` (`planned_week`);--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`week_key` text NOT NULL,
	`constraints` text DEFAULT '' NOT NULL,
	`progress` text DEFAULT '' NOT NULL,
	`deviation` text DEFAULT '' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`adjustments` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_week_key_unique` ON `weekly_reviews` (`week_key`);