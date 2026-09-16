ALTER TABLE `learning_activities` ADD COLUMN `scope_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_learning_signals` ADD COLUMN `question_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_learning_signals` ADD COLUMN `context_json` text DEFAULT '{}' NOT NULL;
