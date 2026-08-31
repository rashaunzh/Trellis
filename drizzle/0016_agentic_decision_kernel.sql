CREATE TABLE `learning_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text,
  `decision_type` text NOT NULL CHECK (`decision_type` IN ('course_analysis','curriculum_synthesis','learning_adaptation','source_evolution','route_migration')),
  `aggregate_type` text NOT NULL,
  `aggregate_id` text NOT NULL,
  `workflow_run_id` text,
  `risk_level` text NOT NULL CHECK (`risk_level` IN ('low','high')),
  `status` text NOT NULL CHECK (`status` IN ('generated','proposed','needs_review','accepted','rejected','applied','superseded','failed')),
  `input_hash` text NOT NULL,
  `proposal_json` text DEFAULT '{}' NOT NULL,
  `rationale_json` text DEFAULT '{}' NOT NULL,
  `citations_json` text DEFAULT '[]' NOT NULL,
  `confidence` integer DEFAULT 0 NOT NULL,
  `eval_json` text DEFAULT '{}' NOT NULL,
  `model_route_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `applied_at` text
);
--> statement-breakpoint
CREATE INDEX `learning_decisions_owner_idx` ON `learning_decisions` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `learning_decisions_aggregate_idx` ON `learning_decisions` (`aggregate_type`,`aggregate_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `learning_decision_events` (
  `id` text PRIMARY KEY NOT NULL,
  `decision_id` text NOT NULL REFERENCES `learning_decisions`(`id`),
  `from_status` text,
  `to_status` text NOT NULL,
  `actor_type` text NOT NULL CHECK (`actor_type` IN ('system','user','admin','workflow')),
  `actor_owner_id` text,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_decision_events_idx` ON `learning_decision_events` (`decision_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `learning_ci_curricula` ADD `parent_curriculum_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_curricula` ADD `graph_version_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_curricula` ADD `revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_course_candidates` ADD `candidate_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_course_candidates` ADD `eval_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_course_candidates` ADD `impact_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_ci_course_candidates` ADD `workflow_run_id` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_sources` ADD `last_checked_at` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_sources` ADD `next_check_at` text;
--> statement-breakpoint
ALTER TABLE `learning_ci_sources` ADD `last_check_error` text DEFAULT '' NOT NULL;
