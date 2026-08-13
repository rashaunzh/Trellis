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
  status: text("status", { enum: ["active", "near", "later", "paused", "done", "proposal"] }).notNull().default("later"),
  plannedWeek: text("planned_week"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(15),
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

export const learningDiagnostics = sqliteTable("learning_diagnostics", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  contentPackId: text("content_pack_id").notNull(),
  contentPackVersion: text("content_pack_version").notNull(),
  goal: text("goal").notNull().default(""),
  weeklyMinutes: integer("weekly_minutes").notNull().default(180),
  selfReportJson: text("self_report_json").notNull().default("{}"),
  materialsJson: text("materials_json").notNull().default("[]"),
  answersJson: text("answers_json").notNull().default("{}"),
  scoresJson: text("scores_json").notNull().default("{}"),
  status: text("status", { enum:["draft","submitted"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_diagnostics_owner_idx").on(table.ownerId),
  uniqueIndex("learning_diagnostics_owner_pack_idx").on(table.ownerId, table.contentPackId, table.contentPackVersion),
]);

export const learningPathProposals = sqliteTable("learning_path_proposals", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  diagnosticId: text("diagnostic_id").notNull(),
  contentPackVersion: text("content_pack_version").notNull(),
  status: text("status", { enum:["pending","confirmed","rejected"] }).notNull().default("pending"),
  explanation: text("explanation").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_path_proposals_diagnostic_idx").on(table.diagnosticId, table.contentPackVersion),
  index("learning_path_proposals_owner_idx").on(table.ownerId),
]);

export const learningPathItems = sqliteTable("learning_path_items", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  capabilityId: text("capability_id").notNull(),
  title: text("title").notNull(),
  sequence: integer("sequence").notNull(),
  targetLevel: integer("target_level").notNull(),
  itemRole: text("item_role", { enum:["core","optional"] }).notNull().default("core"),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  rationale: text("rationale").notNull(),
}, (table) => [
  uniqueIndex("learning_path_items_proposal_capability_idx").on(table.proposalId, table.capabilityId),
  index("learning_path_items_proposal_idx").on(table.proposalId),
]);
