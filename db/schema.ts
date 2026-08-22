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

export const learningMvpStates = sqliteTable("learning_mvp_states", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  proposalId: text("proposal_id").notNull(),
  activeCapabilityId: text("active_capability_id").notNull().default("mechanism"),
  completedActivitiesJson: text("completed_activities_json").notNull().default("[]"),
  evidenceJson: text("evidence_json").notNull().default("{}"),
  reviewAnswersJson: text("review_answers_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_mvp_states_owner_idx").on(table.ownerId),
  index("learning_mvp_states_proposal_idx").on(table.proposalId),
]);

// ─────────────────────────────────────────────────────────────
// V0.2 学习编排内核（learning domain）
// 设计约束：
//  - 内容层（route/node/edge/branch/resource/tool）与状态层
//    （weeklyPlan/activity/evidence/nodeProgress/adjustment）分离
//  - 状态用独立列，不用大 JSON 字段
//  - 所有用户运行对象带 ownerId
// ─────────────────────────────────────────────────────────────

// ── 内容层：学习地图（版本化、只读）────────────────────────────

export const learningRoutes = sqliteTable("learning_routes", {
  id: text("id").primaryKey(),
  version: text("version").notNull().default("0.1.0"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const learningNodes = sqliteTable("learning_nodes", {
  id: text("id").primaryKey(), // 稳定节点 ID，如 "ai-literacy.mechanism"
  routeId: text("route_id")
    .notNull()
    .references(() => learningRoutes.id),
  title: text("title").notNull(), // 中文标题
  moduleId: text("module_id").notNull().default(""), // 模块标识（内容包内分组）
  titleEn: text("title_en").notNull().default(""), // 英文标题
  description: text("description").notNull().default(""),
  outcomes: text("outcomes").notNull().default("[]"), // JSON 数组：学习成果
  sourceRefs: text("source_refs").notNull().default("[]"), // JSON 数组：[{label,url}]
  activityTemplates: text("activity_templates").notNull().default("[]"), // JSON 数组：活动模板 id
  assessmentRubric: text("assessment_rubric").notNull().default(""), // 评估量规
  targetLevel: integer("target_level").notNull().default(2), // 0-3 熟练等级
  isKeyMilestone: integer("is_key_milestone", { mode: "boolean" })
    .notNull()
    .default(false),
}, (table) => [
  index("learning_nodes_route_idx").on(table.routeId),
]);

export const learningEdges = sqliteTable("learning_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceNodeId: text("source_node_id").notNull().references(() => learningNodes.id),
  targetNodeId: text("target_node_id").notNull().references(() => learningNodes.id),
  relationType: text("relation_type", {
    enum: ["prerequisite", "supports", "related"],
  }).notNull(),
}, (table) => [
  uniqueIndex("learning_edges_unique_idx").on(
    table.sourceNodeId,
    table.targetNodeId,
    table.relationType,
  ),
  index("learning_edges_source_idx").on(table.sourceNodeId),
  index("learning_edges_target_idx").on(table.targetNodeId),
]);

export const learningBranches = sqliteTable("learning_branches", {
  id: text("id").primaryKey(),
  routeId: text("route_id").notNull().references(() => learningRoutes.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // 分支主干节点；相邻分支通过 edges(related) 与主路线相连
  mainNodeId: text("main_node_id").references(() => learningNodes.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_branches_route_idx").on(table.routeId),
]);

export const learningResources = sqliteTable("learning_resources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull().default(""),
  sourceType: text("source_type", {
    enum: ["standard", "official_docs", "paper", "course", "open_source", "practice", "community"],
  }).notNull().default("practice"),
  credibilityLevel: integer("credibility_level").notNull().default(3), // 1-5
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const learningResourceMappings = sqliteTable("learning_resource_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resourceId: text("resource_id").notNull().references(() => learningResources.id),
  nodeId: text("node_id").notNull().references(() => learningNodes.id),
  usage: text("usage").notNull().default(""), // 学习用途说明
}, (table) => [
  uniqueIndex("learning_resource_mappings_unique_idx").on(table.resourceId, table.nodeId),
  index("learning_resource_mappings_node_idx").on(table.nodeId),
]);

export const learningTools = sqliteTable("learning_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const learningToolMappings = sqliteTable("learning_tool_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  toolId: text("tool_id").notNull().references(() => learningTools.id),
  nodeId: text("node_id").notNull().references(() => learningNodes.id),
  usage: text("usage").notNull().default(""),
  activityContext: text("activity_context").notNull().default(""), // 适合在哪个活动使用
}, (table) => [
  uniqueIndex("learning_tool_mappings_unique_idx").on(table.toolId, table.nodeId),
  index("learning_tool_mappings_node_idx").on(table.nodeId),
]);

// ── 状态层：用户运行状态（可写）────────────────────────────────

// LLM API 配置（用户自配，用于 AI 接入；key 仅存服务端表，不经过前端存储）
export const learningApiConfig = sqliteTable("learning_api_config", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiKey: text("api_key").notNull().default(""),
  model: text("model").notNull().default("deepseek-chat"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_api_config_owner_idx").on(table.ownerId),
]);

export const learningProfiles = sqliteTable("learning_profiles", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  goal: text("goal").notNull().default(""),
  activeRouteId: text("active_route_id").notNull().references(() => learningRoutes.id),
  weeklyMinutes: integer("weekly_minutes").notNull().default(180),
  status: text("status", { enum: ["diagnosed", "proposed", "confirmed"] })
    .notNull()
    .default("diagnosed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_profiles_owner_idx").on(table.ownerId),
]);

export const learningWeeklyPlans = sqliteTable("learning_weekly_plans", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  routeId: text("route_id").notNull().references(() => learningRoutes.id),
  weekKey: text("week_key").notNull(), // ISO 周键，如 "2026-W33"
  capacityMinutes: integer("capacity_minutes").notNull().default(180),
  status: text("status", { enum: ["draft", "confirmed", "archived"] })
    .notNull()
    .default("draft"),
  rationale: text("rationale").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_weekly_plans_owner_week_idx").on(table.ownerId, table.routeId, table.weekKey),
  index("learning_weekly_plans_owner_idx").on(table.ownerId),
]);

export const learningActivities = sqliteTable("learning_activities", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  weeklyPlanId: text("weekly_plan_id").notNull().references(() => learningWeeklyPlans.id),
  nodeId: text("node_id").notNull().references(() => learningNodes.id),
  title: text("title").notNull(),
  // 活动类型：build_model 建立模型 / follow_demo 跟随示范 / independent_practice 独立练习
  activityType: text("activity_type", {
    enum: ["build_model", "follow_demo", "independent_practice"],
  }).notNull(),
  goal: text("goal").notNull().default(""),
  estimatedMinutes: integer("estimated_minutes").notNull().default(30),
  isCore: integer("is_core", { mode: "boolean" }).notNull().default(true),
  status: text("status", {
    enum: ["planned", "in_progress", "evidence_submitted", "reviewed", "completed"],
  }).notNull().default("planned"),
  // 跳学验证活动标记：跳过后生成的验证活动，必须提交证据
  isSkipValidation: integer("is_skip_validation", { mode: "boolean" })
    .notNull()
    .default(false),
  inputRefs: text("input_refs").notNull().default(""), // 逗号分隔的 resourceId 列表
  steps: text("steps").notNull().default(""), // 换行分隔的操作步骤
  expectedEvidence: text("expected_evidence").notNull().default(""),
  evaluationCriteria: text("evaluation_criteria").notNull().default(""),
  nextAdvice: text("next_advice").notNull().default(""),
  sequence: integer("sequence").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_activities_owner_idx").on(table.ownerId),
  index("learning_activities_plan_idx").on(table.weeklyPlanId),
  index("learning_activities_node_idx").on(table.nodeId),
]);

export const learningEvidence = sqliteTable("learning_evidence", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  activityId: text("activity_id").notNull().references(() => learningActivities.id),
  nodeId: text("node_id").notNull().references(() => learningNodes.id),
  evidenceType: text("evidence_type", {
    enum: ["explanation", "artifact", "code", "judgment", "notes", "external"],
  }).notNull().default("explanation"),
  content: text("content").notNull().default(""), // 证据本体或摘要
  externalUrl: text("external_url").notNull().default(""),
  status: text("status", {
    enum: ["draft", "submitted", "accepted", "needs_revision"],
  }).notNull().default("draft"),
  feedback: text("feedback").notNull().default(""),
  extractedJson: text("extracted_json").notNull().default("{}"),
  reviewJson: text("review_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_evidence_owner_idx").on(table.ownerId),
  index("learning_evidence_activity_idx").on(table.activityId),
  index("learning_evidence_node_idx").on(table.nodeId),
]);

export const learningNodeProgress = sqliteTable("learning_node_progress", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  nodeId: text("node_id").notNull().references(() => learningNodes.id),
  status: text("status", { enum: ["unstarted", "growing", "validated"] })
    .notNull()
    .default("unstarted"),
  confidence: integer("confidence").notNull().default(0), // 0-3 熟练等级
  lastValidatedAt: text("last_validated_at"),
  // 掌握确认（pending_confirmation → validated 时写入）
  confirmedAt: text("confirmed_at"),
  // 延迟复测元数据
  reviewIntervalDays: integer("review_interval_days").notNull().default(14),
  nextReviewAt: text("next_review_at"),
  reviewCount: integer("review_count").notNull().default(0),
  // 支持验证的证据 ID 列表，逗号分隔
  supportingEvidenceIds: text("supporting_evidence_ids").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("learning_node_progress_owner_node_idx").on(table.ownerId, table.nodeId),
  index("learning_node_progress_owner_idx").on(table.ownerId),
]);

export const learningAdjustments = sqliteTable("learning_adjustments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  routeId: text("route_id").notNull().references(() => learningRoutes.id),
  weeklyPlanId: text("weekly_plan_id").references(() => learningWeeklyPlans.id),
  adjustmentType: text("adjustment_type", {
    enum: ["activity_replan", "weekly_light", "route_revision"],
  }).notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status", { enum: ["proposed", "accepted", "rejected", "superseded"] })
    .notNull()
    .default("proposed"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_adjustments_owner_idx").on(table.ownerId),
  index("learning_adjustments_route_idx").on(table.routeId),
]);

// 工作台收集箱：用户主动收集的资源/想法/工具（ownerId 边界，可持久化）
export const learningUserResources = sqliteTable("learning_user_resources", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  type: text("type", {
    enum: ["link", "note", "tool", "resource"],
  }).notNull().default("link"),
  content: text("content").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  relatedNodeIds: text("related_node_ids").notNull().default(""), // 逗号分隔
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learning_user_resources_owner_idx").on(table.ownerId),
]);
