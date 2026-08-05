import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  recordType: text("record_type", { enum: ["goal", "project", "task", "resource", "artifact", "evidence", "review", "idea"] }).notNull(),
  line: text("line", { enum: ["G", "J", "B", "I"] }),
  module: text("module"),
  projectId: text("project_id"),
  scheduleRole: text("schedule_role", { enum: ["focus", "support", "maintain", "candidate", "paused"] }).notNull().default("candidate"),
  status: text("status", { enum: ["inbox", "backlog", "this_week", "in_progress", "pending_review", "done", "cancelled"] }).notNull().default("backlog"),
  plannedWeek: text("planned_week"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(0),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  coreAction: text("core_action").notNull().default(""),
  learningScope: text("learning_scope").notNull().default(""),
  executionMethod: text("execution_method").notNull().default(""),
  completionCriteria: text("completion_criteria").notNull().default(""),
  evidence: text("evidence").notNull().default(""),
  blockers: text("blockers").notNull().default(""),
  nextStep: text("next_step").notNull().default(""),
  aiReview: text("ai_review").notNull().default(""),
  acceptance: text("acceptance", { enum: ["unreviewed", "passed", "rework", "waived"] }).notNull().default("unreviewed"),
  sourceUrl: text("source_url"),
  visibility: text("visibility", { enum: ["private", "sanitized", "public"] }).notNull().default("private"),
  notes: text("notes").notNull().default(""),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("records_type_idx").on(table.recordType),
  index("records_line_idx").on(table.line),
  index("records_project_idx").on(table.projectId),
  index("records_status_idx").on(table.status),
  index("records_week_idx").on(table.plannedWeek),
]);

export const recordRelations = sqliteTable("record_relations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  relationType: text("relation_type", { enum: ["depends_on", "input", "evidence", "supports"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("record_relations_unique_idx").on(table.sourceId, table.targetId, table.relationType),
  index("record_relations_source_idx").on(table.sourceId),
  index("record_relations_target_idx").on(table.targetId),
]);

export const weeklyReviews = sqliteTable("weekly_reviews", {
  id: text("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  constraints: text("constraints").notNull().default(""),
  progress: text("progress").notNull().default(""),
  deviation: text("deviation").notNull().default(""),
  feedback: text("feedback").notNull().default(""),
  adjustments: text("adjustments").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
