CREATE TABLE `learning_workflow_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `workflow_id` text NOT NULL,
  `aggregate_type` text NOT NULL,
  `aggregate_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('running','suspended','completed','failed','cancelled')),
  `current_step` text DEFAULT '' NOT NULL,
  `last_error` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_workflow_aggregate_idx` ON `learning_workflow_runs` (`workflow_id`,`aggregate_type`,`aggregate_id`);
--> statement-breakpoint
CREATE INDEX `learning_workflow_owner_idx` ON `learning_workflow_runs` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_ci_candidate_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `candidate_id` text NOT NULL,
  `reviewer_owner_id` text NOT NULL,
  `decision` text NOT NULL CHECK (`decision` IN ('validated','rejected','published','rolled_back')),
  `reason` text DEFAULT '' NOT NULL,
  `review_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_candidate_review_idx` ON `learning_ci_candidate_reviews` (`candidate_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `learning_ci_source_update_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `source_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('queued','running','candidate','unchanged','failed')),
  `previous_snapshot_id` text,
  `candidate_snapshot_id` text,
  `impact_json` text DEFAULT '{}' NOT NULL,
  `error` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_ci_source_job_idx` ON `learning_ci_source_update_jobs` (`source_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_owner_aliases` (
  `legacy_owner_id` text PRIMARY KEY NOT NULL,
  `canonical_owner_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_owner_alias_canonical_idx` ON `learning_owner_aliases` (`canonical_owner_id`);
