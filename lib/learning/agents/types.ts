// V0.2 learning agents — 接口契约（可替换层）
// MVP 只保留四类接口，不建设内嵌自研 agent runtime。
// 所有输入输出必须为结构化 schema，不能只是一段自然语言。
// 未来替换成内嵌自研 agent 时，只替换实现，不改产品主流程。

import type {
  ActivityType,
  AdjustmentType,
  EdgeType,
  EvidenceType,
  LearningContentPack,
  NodeStatus,
} from "../domain/types.ts";

// ── planner：路线规划与周计划编排 ──────────────────────

export interface DiagnosticInput {
  goal: string; // 学习目标
  weeklyMinutes: number; // 每周可投入时间
  materialIds: string[]; // 用户已有材料（可选）
  selfReport: Record<string, number>; // 自评：nodeId → 0-3 熟练等级
  preference: "breadth_first" | "build_first"; // 先全局认知还是尽快产出
}

export interface RouteProposal {
  routeId: string; // 推荐主路线
  nodeSequence: string[]; // 推荐节点顺序（含理由由 rationale 解释）
  adjacentBranchIds: string[]; // 相邻分支
  rationale: string; // 为什么推荐这条路线
  initialProfile: {
    // 初始画像
    strengths: string[]; // 已有较强证据的节点
    gaps: string[]; // 缺口节点
    recommendedFirstNodeId: string;
  };
}

export interface WeeklyPlanInput {
  ownerId: string;
  routeId: string;
  weekKey: string;
  capacityMinutes: number;
  nodeStatusById: Record<string, NodeStatus>;
  prerequisiteSatisfied: (nodeId: string) => boolean;
  skipNodeIds?: string[]; // 跳过的节点
  seed?: number; // 确定性种子（同 seed 同输出）
}

export interface WeeklyPlanDraft {
  weekKey: string;
  coreActivityCount: number;
  optionalActivityCount: number;
  totalMinutes: number;
  activities: Array<{
    nodeId: string;
    activityType: ActivityType;
    title: string;
    estimatedMinutes: number;
    isCore: boolean;
    whyNow: string; // 为什么现在学
  }>;
  rationale: string;
}

export interface PlannerPort {
  planLearningRoute(input: DiagnosticInput): RouteProposal;
  composeWeeklyPlan(input: WeeklyPlanInput): WeeklyPlanDraft;
}

// ── activityComposer：把节点拆成学习活动 ───────────────

export interface ComposeActivityInput {
  nodeId: string;
  nodeTitle: string;
  nodeDescription: string;
  activityType: ActivityType;
  isSkipValidation: boolean; // 跳学验证活动
  resourceIds: string[];
  estimatedMinutes: number; // 默认 30 + n×15
  toolIds?: string[];
}

export interface ActivityDraft {
  nodeId: string;
  activityType: ActivityType;
  title: string;
  goal: string; // 学习目标：学完后应该能做什么
  estimatedMinutes: number;
  inputRefs: string[]; // 输入材料
  steps: string[]; // 操作步骤
  expectedEvidence: string; // 产出证据
  evaluationCriteria: string; // 评估标准
  nextAdvice: string; // 下一步建议
}

export interface ActivityComposerPort {
  composeActivity(input: ComposeActivityInput): ActivityDraft;
}

// ── evidenceEvaluator：判断证据是否支持节点成长 ────────

export interface EvaluateEvidenceInput {
  evidenceId: string;
  nodeId: string;
  nodeTitle: string;
  targetLevel: number; // 节点目标熟练等级
  evidenceType: EvidenceType;
  externalUrl?: string;
  content: string; // 证据本体或摘要
  criteria: string; // 活动评估标准
  capabilitySignals?: string[]; // 来自内容模型的能力信号
  isSkipValidation: boolean; // 跳学验证活动的证据
}

export type EvidenceVerdict = "accepted" | "needs_revision";

export type EvidenceArtifactType = "text" | "webpage" | "doc" | "code" | "table" | "unknown";
export type EvidenceReadability = "readable" | "partial" | "unknown";
export type SignalReviewStatus = "covered" | "partial" | "missing";

export interface EvidenceCard {
  title: string;
  artifactUrl: string;
  artifactType: EvidenceArtifactType;
  summary: string;
  extractedItems: string[];
  sourceReadability: EvidenceReadability;
}

export interface SignalReview {
  signalId: string;
  label: string;
  status: SignalReviewStatus;
  reason: string;
  evidenceRefs: string[];
}

export interface ReviewDimensionScore {
  id:
    | "parseability"
    | "criteriaCompleteness"
    | "signalCoverage"
    | "contentQuality"
    | "credibility"
    | "capabilityProof"
    | "nextStepClarity";
  label: string;
  score: number;
  rationale: string;
}

export interface EvidenceAssessment {
  evidenceId: string;
  verdict: EvidenceVerdict;
  confidence: number; // 0-1
  score: number;
  evidenceCard: EvidenceCard;
  signalReviews: SignalReview[];
  dimensionScores: ReviewDimensionScore[];
  reasons: string[]; // 逐条依据
  missing: string[]; // 尚未满足的方面
  suggestedLevel: number; // 建议的熟练等级 0-3
  rationale: string;
  credibilityNote: string;
  nextAction: "proceed" | "revise_and_resubmit" | "insert_prerequisite";
}

export interface EvidenceEvaluatorPort {
  evaluateEvidence(
    input: EvaluateEvidenceInput,
    llm?: { baseUrl: string; apiKey: string; model: string },
  ): Promise<EvidenceAssessment>;
}

// ── adjustmentAdvisor：提出路径调整建议 ────────────────

export interface AdjustmentInput {
  nodeId: string;
  nodeTitle: string;
  evidenceVerdict: EvidenceVerdict;
  activityStatus: string;
  completionRate: number; // 0-1 周计划完成率
  skippedNodeIds: string[];
  prerequisiteGaps: string[];
  routeId: string;
}

export interface AdjustmentSuggestion {
  adjustmentType: AdjustmentType;
  reason: string;
  summary: string;
  // 结构化建议动作
  actions: Array<{
    action: "continue" | "revise" | "review" | "insert_activity" | "propose_route_change";
    targetNodeId?: string;
    description: string;
  }>;
  severity: "low" | "medium" | "high"; // 是否值得提出正式调整
}

export interface AdjustmentAdvisorPort {
  suggestAdjustment(input: AdjustmentInput): AdjustmentSuggestion;
}

// ── 组合：agent 注册表 ────────────────────────────────

export interface AgentRegistry {
  planner: PlannerPort;
  activityComposer: ActivityComposerPort;
  evidenceEvaluator: EvidenceEvaluatorPort;
  adjustmentAdvisor: AdjustmentAdvisorPort;
}

// ── 辅助类型：agent 使用内容包 ─────────────────────────

export interface AgentContext {
  contentPack: LearningContentPack;
  edgeType?: EdgeType;
}
