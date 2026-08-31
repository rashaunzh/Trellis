CREATE TABLE `learning_week_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `route_id` text NOT NULL,
  `week_key` text NOT NULL,
  `summary` text NOT NULL,
  `completed_count` integer DEFAULT 0 NOT NULL,
  `accepted_evidence_count` integer DEFAULT 0 NOT NULL,
  `revision_count` integer DEFAULT 0 NOT NULL,
  `open_activity_count` integer DEFAULT 0 NOT NULL,
  `next_best_move` text NOT NULL,
  `review_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_week_reviews_owner_week_idx` ON `learning_week_reviews` (`owner_id`,`route_id`,`week_key`);
--> statement-breakpoint
CREATE INDEX `learning_week_reviews_owner_idx` ON `learning_week_reviews` (`owner_id`);
