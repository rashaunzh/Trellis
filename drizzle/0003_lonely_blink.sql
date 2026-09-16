CREATE TABLE `learning_mvp_states` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`active_capability_id` text DEFAULT 'mechanism' NOT NULL,
	`completed_activities_json` text DEFAULT '[]' NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`review_answers_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_mvp_states_owner_idx` ON `learning_mvp_states` (`owner_id`);--> statement-breakpoint
CREATE INDEX `learning_mvp_states_proposal_idx` ON `learning_mvp_states` (`proposal_id`);