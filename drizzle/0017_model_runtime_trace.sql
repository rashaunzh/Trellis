ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `request_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `workflow_run_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `decision_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `slot` text DEFAULT 'primary' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `attempt` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `contract_version` text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `failure_class` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `fallback_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `cache_hit` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_analysis_runs` ADD COLUMN `eval_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE `learning_ci_analysis_runs` SET `request_id`=`id` WHERE `request_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `learning_ci_analysis_request_idx` ON `learning_ci_analysis_runs` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `learning_ci_analysis_workflow_idx` ON `learning_ci_analysis_runs` (`workflow_run_id`,`created_at`);
