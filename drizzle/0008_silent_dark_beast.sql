CREATE TABLE `learning_user_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'link' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`related_node_ids` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_user_resources_owner_idx` ON `learning_user_resources` (`owner_id`);