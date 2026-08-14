CREATE TABLE `learning_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`weekly_plan_id` text NOT NULL,
	`node_id` text NOT NULL,
	`title` text NOT NULL,
	`activity_type` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`estimated_minutes` integer DEFAULT 30 NOT NULL,
	`is_core` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`is_skip_validation` integer DEFAULT false NOT NULL,
	`input_refs` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`expected_evidence` text DEFAULT '' NOT NULL,
	`evaluation_criteria` text DEFAULT '' NOT NULL,
	`next_advice` text DEFAULT '' NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`weekly_plan_id`) REFERENCES `learning_weekly_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_activities_owner_idx` ON `learning_activities` (`owner_id`);--> statement-breakpoint
CREATE INDEX `learning_activities_plan_idx` ON `learning_activities` (`weekly_plan_id`);--> statement-breakpoint
CREATE INDEX `learning_activities_node_idx` ON `learning_activities` (`node_id`);--> statement-breakpoint
CREATE TABLE `learning_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`route_id` text NOT NULL,
	`weekly_plan_id` text,
	`adjustment_type` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `learning_routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weekly_plan_id`) REFERENCES `learning_weekly_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_adjustments_owner_idx` ON `learning_adjustments` (`owner_id`);--> statement-breakpoint
CREATE INDEX `learning_adjustments_route_idx` ON `learning_adjustments` (`route_id`);--> statement-breakpoint
CREATE TABLE `learning_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`main_node_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `learning_routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`main_node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_branches_route_idx` ON `learning_branches` (`route_id`);--> statement-breakpoint
CREATE TABLE `learning_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`relation_type` text NOT NULL,
	FOREIGN KEY (`source_node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_edges_unique_idx` ON `learning_edges` (`source_node_id`,`target_node_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `learning_edges_source_idx` ON `learning_edges` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `learning_edges_target_idx` ON `learning_edges` (`target_node_id`);--> statement-breakpoint
CREATE TABLE `learning_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`node_id` text NOT NULL,
	`evidence_type` text DEFAULT 'explanation' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`external_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `learning_activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_evidence_owner_idx` ON `learning_evidence` (`owner_id`);--> statement-breakpoint
CREATE INDEX `learning_evidence_activity_idx` ON `learning_evidence` (`activity_id`);--> statement-breakpoint
CREATE INDEX `learning_evidence_node_idx` ON `learning_evidence` (`node_id`);--> statement-breakpoint
CREATE TABLE `learning_node_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`node_id` text NOT NULL,
	`status` text DEFAULT 'unstarted' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`last_validated_at` text,
	`supporting_evidence_ids` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_node_progress_owner_node_idx` ON `learning_node_progress` (`owner_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `learning_node_progress_owner_idx` ON `learning_node_progress` (`owner_id`);--> statement-breakpoint
CREATE TABLE `learning_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_level` integer DEFAULT 2 NOT NULL,
	`is_key_milestone` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `learning_routes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_nodes_route_idx` ON `learning_nodes` (`route_id`);--> statement-breakpoint
CREATE TABLE `learning_resource_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` text NOT NULL,
	`node_id` text NOT NULL,
	`usage` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `learning_resources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_resource_mappings_unique_idx` ON `learning_resource_mappings` (`resource_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `learning_resource_mappings_node_idx` ON `learning_resource_mappings` (`node_id`);--> statement-breakpoint
CREATE TABLE `learning_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'practice' NOT NULL,
	`credibility_level` integer DEFAULT 3 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text DEFAULT '0.1.0' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_tool_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tool_id` text NOT NULL,
	`node_id` text NOT NULL,
	`usage` text DEFAULT '' NOT NULL,
	`activity_context` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`tool_id`) REFERENCES `learning_tools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `learning_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_tool_mappings_unique_idx` ON `learning_tool_mappings` (`tool_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `learning_tool_mappings_node_idx` ON `learning_tool_mappings` (`node_id`);--> statement-breakpoint
CREATE TABLE `learning_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_weekly_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`route_id` text NOT NULL,
	`week_key` text NOT NULL,
	`capacity_minutes` integer DEFAULT 180 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `learning_routes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_weekly_plans_owner_week_idx` ON `learning_weekly_plans` (`owner_id`,`route_id`,`week_key`);--> statement-breakpoint
CREATE INDEX `learning_weekly_plans_owner_idx` ON `learning_weekly_plans` (`owner_id`);