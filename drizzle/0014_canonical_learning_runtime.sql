ALTER TABLE `learning_ci_curricula` ADD `activation_status` text DEFAULT 'inactive' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_curricula` ADD `activation_error` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD `curriculum_id` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD `course_version_id` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD `course_id` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD `unit_key` text;
--> statement-breakpoint
ALTER TABLE `learning_activities` ADD `canonical_node_id` text;
--> statement-breakpoint
CREATE TABLE `learning_ci_knowledge_states` (
  `owner_id` text NOT NULL,
  `node_id` text NOT NULL,
  `status` text DEFAULT 'not_started' NOT NULL,
  `confidence` integer DEFAULT 0 NOT NULL,
  `latest_signal_id` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_ci_knowledge_state_owner_node_idx` ON `learning_ci_knowledge_states` (`owner_id`,`node_id`);
--> statement-breakpoint
CREATE TABLE `learning_ci_learning_signals` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `activity_id` text NOT NULL,
  `curriculum_id` text NOT NULL,
  `canonical_node_id` text NOT NULL,
  `signal_type` text NOT NULL,
  `value_json` text NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_signals_owner_idx` ON `learning_ci_learning_signals` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `learning_ci_signals_activity_idx` ON `learning_ci_learning_signals` (`activity_id`);
--> statement-breakpoint
CREATE TABLE `learning_ci_course_candidates` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `title` text NOT NULL,
  `source_url` text DEFAULT '' NOT NULL,
  `outline_json` text DEFAULT '[]' NOT NULL,
  `analysis_json` text NOT NULL,
  `status` text DEFAULT 'candidate' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_candidates_status_idx` ON `learning_ci_course_candidates` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_content_seed_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_ci_catalog_releases` (
  `id` text PRIMARY KEY NOT NULL,
  `applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
