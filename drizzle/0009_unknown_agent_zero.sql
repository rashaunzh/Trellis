ALTER TABLE `learning_node_progress` ADD `confirmed_at` text;--> statement-breakpoint
ALTER TABLE `learning_node_progress` ADD `review_interval_days` integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_node_progress` ADD `next_review_at` text;--> statement-breakpoint
ALTER TABLE `learning_node_progress` ADD `review_count` integer DEFAULT 0 NOT NULL;