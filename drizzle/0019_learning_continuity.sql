ALTER TABLE `learning_activities` ADD COLUMN `started_at` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD COLUMN `last_opened_at` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD COLUMN `paused_at` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD COLUMN `completed_at` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD COLUMN `pause_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD COLUMN `actual_minutes` integer;
