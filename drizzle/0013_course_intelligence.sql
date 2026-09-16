CREATE TABLE `learning_ci_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `source_class` text NOT NULL,
  `purposes_json` text DEFAULT '[]' NOT NULL,
  `provider` text NOT NULL,
  `status` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_ci_source_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `source_id` text NOT NULL REFERENCES `learning_ci_sources`(`id`),
  `content_hash` text NOT NULL,
  `retrieved_at` text NOT NULL,
  `content_json` text DEFAULT '{}' NOT NULL,
  `status` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_ci_snapshot_source_hash_idx` ON `learning_ci_source_snapshots` (`source_id`,`content_hash`);
--> statement-breakpoint
CREATE TABLE `learning_ci_graph_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `version` text NOT NULL,
  `title` text NOT NULL,
  `status` text NOT NULL,
  `graph_json` text NOT NULL,
  `published_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_ci_courses` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `tags_json` text DEFAULT '[]' NOT NULL,
  `published_version_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_ci_course_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `course_id` text NOT NULL REFERENCES `learning_ci_courses`(`id`),
  `version` text NOT NULL,
  `status` text NOT NULL,
  `genome_json` text NOT NULL,
  `source_snapshot_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_ci_course_version_idx` ON `learning_ci_course_versions` (`course_id`,`version`);
--> statement-breakpoint
CREATE TABLE `learning_ci_course_units` (
  `id` text PRIMARY KEY NOT NULL,
  `course_version_id` text NOT NULL REFERENCES `learning_ci_course_versions`(`id`),
  `unit_key` text NOT NULL,
  `title` text NOT NULL,
  `sequence` integer NOT NULL,
  `estimated_minutes` integer,
  `unit_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_ci_course_unit_idx` ON `learning_ci_course_units` (`course_version_id`,`unit_key`);
--> statement-breakpoint
CREATE TABLE `learning_ci_unit_node_mappings` (
  `id` text PRIMARY KEY NOT NULL,
  `course_version_id` text NOT NULL REFERENCES `learning_ci_course_versions`(`id`),
  `unit_key` text NOT NULL,
  `node_id` text NOT NULL,
  `depth` integer NOT NULL,
  `relation` text NOT NULL,
  `confidence` integer NOT NULL,
  `mapping_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_mapping_node_idx` ON `learning_ci_unit_node_mappings` (`node_id`);
--> statement-breakpoint
CREATE TABLE `learning_ci_curricula` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `status` text NOT NULL,
  `intake_json` text NOT NULL,
  `assembly_json` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_curricula_owner_idx` ON `learning_ci_curricula` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_ci_analysis_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text,
  `kind` text NOT NULL,
  `input_hash` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `status` text NOT NULL,
  `output_json` text DEFAULT '' NOT NULL,
  `error` text DEFAULT '' NOT NULL,
  `prompt_tokens` integer DEFAULT 0 NOT NULL,
  `completion_tokens` integer DEFAULT 0 NOT NULL,
  `latency_ms` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_analysis_cache_idx` ON `learning_ci_analysis_runs` (`kind`,`input_hash`,`model`,`status`);
