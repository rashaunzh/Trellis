ALTER TABLE `learning_nodes` ADD `module_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD `title_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD `outcomes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD `source_refs` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD `activity_templates` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_nodes` ADD `assessment_rubric` text DEFAULT '' NOT NULL;