CREATE TABLE `learning_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`active_route_id` text NOT NULL,
	`weekly_minutes` integer DEFAULT 180 NOT NULL,
	`status` text DEFAULT 'diagnosed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`active_route_id`) REFERENCES `learning_routes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_profiles_owner_idx` ON `learning_profiles` (`owner_id`);