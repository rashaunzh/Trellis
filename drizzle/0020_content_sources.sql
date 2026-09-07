CREATE TABLE IF NOT EXISTS `learning_content_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text,
  `source_type` text NOT NULL,
  `title` text NOT NULL,
  `canonical_url` text,
  `raw_content` text,
  `status` text NOT NULL,
  `source_trust` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learning_content_sources_owner_idx` ON `learning_content_sources` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `learning_content_analysis_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `source_id` text NOT NULL REFERENCES `learning_content_sources`(`id`),
  `version` integer NOT NULL,
  `mode` text NOT NULL,
  `status` text NOT NULL,
  `analysis_json` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `learning_content_analysis_source_version_idx` ON `learning_content_analysis_runs` (`source_id`,`version`);
