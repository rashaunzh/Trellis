CREATE TABLE `learning_diagnostics` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`content_pack_id` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`weekly_minutes` integer DEFAULT 180 NOT NULL,
	`self_report_json` text DEFAULT '{}' NOT NULL,
	`materials_json` text DEFAULT '[]' NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`scores_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_diagnostics_owner_idx` ON `learning_diagnostics` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `learning_diagnostics_owner_pack_idx` ON `learning_diagnostics` (`owner_id`,`content_pack_id`,`content_pack_version`);--> statement-breakpoint
CREATE TABLE `learning_path_items` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`title` text NOT NULL,
	`sequence` integer NOT NULL,
	`target_level` integer NOT NULL,
	`item_role` text DEFAULT 'core' NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`rationale` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_path_items_proposal_capability_idx` ON `learning_path_items` (`proposal_id`,`capability_id`);--> statement-breakpoint
CREATE INDEX `learning_path_items_proposal_idx` ON `learning_path_items` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `learning_path_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`diagnostic_id` text NOT NULL,
	`content_pack_version` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`explanation` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_path_proposals_diagnostic_idx` ON `learning_path_proposals` (`diagnostic_id`,`content_pack_version`);--> statement-breakpoint
CREATE INDEX `learning_path_proposals_owner_idx` ON `learning_path_proposals` (`owner_id`);
