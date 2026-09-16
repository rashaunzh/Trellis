CREATE TABLE `learning_api_config` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`model` text DEFAULT 'deepseek-chat' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_api_config_owner_idx` ON `learning_api_config` (`owner_id`);