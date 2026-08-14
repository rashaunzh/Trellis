// V0.2 learning domain — 核心领域类型
// 设计约束：状态用独立枚举，不用大 JSON；agent 输出结构化

// ── 节点状态（成长页三色）──────────────────────────────
export const NODE_STATUS = ["unstarted", "growing", "validated"] as const;
export type NodeStatus = (typeof NODE_STATUS)[number];

// ── 活动状态 ──────────────────────────────────────────
export const ACTIVITY_STATUS = [
  "planned",
  "in_progress",
  "evidence_submitted",
  "reviewed",
  "completed",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

// ── 证据状态 ──────────────────────────────────────────
export const EVIDENCE_STATUS = [
  "draft",
  "submitted",
  "accepted",
  "needs_revision",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[number];

// ── 活动类型（MVP 三类，架构支持五类）──────────────────
export const ACTIVITY_TYPES = [
  "build_model", // 建立模型：解释概念、画出关系、总结判断标准
  "follow_demo", // 跟随示范：看例子并解释为什么有效
  "independent_practice", // 独立练习：完成小产出
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ── 证据类型 ──────────────────────────────────────────
export const EVIDENCE_TYPES = [
  "explanation", // 解释
  "artifact", // 作品/产出
  "code", // 代码片段
  "judgment", // 产品判断
  "notes", // 学习笔记
  "external", // 外部链接
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// ── 关系类型（edge）───────────────────────────────────
export const EDGE_TYPES = ["prerequisite", "supports", "related"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

// ── 调整类型与状态 ────────────────────────────────────
export const ADJUSTMENT_TYPES = [
  "activity_replan", // 活动重新编排
  "weekly_light", // 周计划轻量调整
  "route_revision", // 路线版本变化
] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_STATUS = ["proposed", "accepted", "rejected", "superseded"] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUS)[number];

// ── 周计划状态 ────────────────────────────────────────
export const WEEKLY_PLAN_STATUS = ["draft", "confirmed", "archived"] as const;
export type WeeklyPlanStatus = (typeof WEEKLY_PLAN_STATUS)[number];

// ── 内容层对象 ────────────────────────────────────────
export interface LearningRoute {
  id: string;
  version: string;
  title: string;
  description: string;
}

export interface LearningNode {
  id: string; // 稳定 ID，如 "ai-literacy.mechanism"
  routeId: string;
  title: string;
  description: string;
  targetLevel: number; // 0-3
  isKeyMilestone: boolean;
}

export interface LearningEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: EdgeType;
}

export interface LearningBranch {
  id: string;
  routeId: string;
  name: string;
  description: string;
  mainNodeId: string;
}

export interface LearningResource {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  credibilityLevel: number;
  summary: string;
}

export interface ResourceMapping {
  resourceId: string;
  nodeId: string;
  usage: string;
}

export interface LearningTool {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface ToolMapping {
  toolId: string;
  nodeId: string;
  usage: string;
  activityContext: string;
}

// ── 状态层对象（用户运行状态）──────────────────────────
export interface WeeklyPlan {
  id: string;
  ownerId: string;
  routeId: string;
  weekKey: string; // ISO 周键 "2026-W33"
  capacityMinutes: number;
  status: WeeklyPlanStatus;
  rationale: string;
}

export interface LearningActivity {
  id: string;
  ownerId: string;
  weeklyPlanId: string;
  nodeId: string;
  title: string;
  activityType: ActivityType;
  goal: string;
  estimatedMinutes: number;
  isCore: boolean;
  status: ActivityStatus;
  isSkipValidation: boolean; // 跳学验证活动
  inputRefs: string[]; // resourceId 列表
  steps: string;
  expectedEvidence: string;
  evaluationCriteria: string;
  nextAdvice: string;
  sequence: number;
}

export interface Evidence {
  id: string;
  ownerId: string;
  activityId: string;
  nodeId: string;
  evidenceType: EvidenceType;
  content: string;
  externalUrl: string;
  status: EvidenceStatus;
  feedback: string;
}

export interface NodeProgress {
  id: string;
  ownerId: string;
  nodeId: string;
  status: NodeStatus;
  confidence: number; // 0-3 熟练等级
  lastValidatedAt: string | null;
  supportingEvidenceIds: string[]; // 逗号分隔存库，内存中为数组
}

export interface AdjustmentRecord {
  id: string;
  ownerId: string;
  routeId: string;
  weeklyPlanId: string | null;
  adjustmentType: AdjustmentType;
  reason: string;
  status: AdjustmentStatus;
  summary: string;
}

// ── 内容包（版本化，只读）─────────────────────────────
export interface LearningContentPack {
  version: string;
  routes: LearningRoute[];
  nodes: LearningNode[];
  edges: LearningEdge[];
  branches: LearningBranch[];
  resources: LearningResource[];
  resourceMappings: ResourceMapping[];
  tools: LearningTool[];
  toolMappings: ToolMapping[];
}
