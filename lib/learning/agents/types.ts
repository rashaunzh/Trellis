// V0.2 learning agents — 接口契约（可替换层）
// 管线：capabilityMapper（目标+材料 → 能力结构）→ planner → activityComposer
//       → evidenceEvaluator → adjustmentAdvisor。
// 五类接口均为结构化 schema 输入输出，不建设内嵌自研 agent runtime。
// 未来替换成内嵌自研 agent 时，只替换实现，不改产品主流程。

import type {
  ActivityType,
  AdjustmentType,
  EdgeType,
  EvidenceType,
  LearningContentPack,
  NodeStatus,
  SourceRef,
} from "../domain/types.ts";
// AdaptivePlannerPort / AdaptivePlan 定义于 adaptive-types.ts（自适应专属契约），
// 此处仅类型引用。该文件对 types.ts 只有类型级 import，运行期无循环依赖。
import type { AdaptivePlan, AdaptivePlannerPort } from "./adaptive-types.ts";

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
  // Evidence Review 缺口回流：建议文案据此指出具体缺失的能力信号
  missingSignals?: string[]; // 证据未覆盖的能力信号（signalReviews.status === "missing"）
  partialSignals?: string[]; // 部分覆盖需补强的能力信号（status === "partial"）
  reviewRationale?: string; // 评估结论摘要（assessment.rationale）
  evidenceNextAction?: string; // 评估给出的下一步（assessment.nextAction）
  // 服务层运行时推导的 transient context，不落库
  failureCount?: number; // 该节点累计证据未通过次数（needs_revision 次数）
  isRetestFailure?: boolean; // 本次是否为复测活动证据未通过
  lastMissingSignals?: string[]; // 上一次未通过时的缺失信号（用于反复缺失判定）
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

// ── 前半段契约：goalAnalyzer / courseAnalyzer / capabilityMapper ──
// Full Chain Phase 1：GoalAnalysis / CourseMaterialAnalysis / CapabilityMap 的
// 单一契约统一在本文件（adaptive-types.ts 不再维护同名冲突类型，直接复用）。
// 约定：goalAnalyzer / courseAnalyzer / capabilityMapper 的输出填全字段；
// 作为输入消费时，缺失字段由消费方确定性兜底（如 capabilityMapper 对
// topicKeywords 缺失时从原文派生，adaptiveRoutePlanner 对 targetCapabilityIds
// 缺失时覆盖整图）。

/** 目标深度意图：1 理解 / 2 应用 / 3 迁移（对齐熟练等级 0-3） */
export type GoalTargetDepth = 1 | 2 | 3;

/** 学习目标分析：Goal Analyzer 输出，Capability Mapper / Adaptive Route Planner 的输入 */
export interface GoalAnalysis {
  goal: string; // 学习目标原文（自然语言）
  domain?: string; // 推断领域，如 "AI" / "AIPM"（可选）
  topicKeywords?: string[]; // 主题关键词（匹配现有内容包的主要依据）
  depth?: GoalTargetDepth; // 目标深度意图（可选，用于后续编排倾向）
  context?: string; // 应用场景或约束（可选，进入 rationale 与活动措辞）
  targetCapabilityIds?: string[]; // 目标能力 id（服务层在映射后回填；空/缺省 = 覆盖整图）
}

/** 课程/材料分析：每个学习材料一条，判断是否命中现有内容包 */
export interface CourseMaterialAnalysis {
  materialId: string;
  title: string;
  description?: string;
  topicKeywords?: string[]; // 材料主题关键词
  coveredCapabilityIds?: string[]; // 覆盖的能力 id（courseAnalyzer 产出，planner 用于 inputRefs）
  sourceType?: string;
  credibilityLevel?: number;
  url?: string;
}

/** 能力层级 */
export type CapabilityLevel = "foundation" | "core" | "advanced" | "optional";
/** 能力来源 */
export type CapabilitySource = "existing_content" | "inferred";

/** 能力信号规格：可被 Evidence Review 消费的信号定义 */
export interface CapabilitySignalSpec {
  id: string;
  label: string; // 短语级信号（Evidence Review 按 label 匹配证据文本，不能太抽象）
  description: string;
  evidenceRequirement: string; // 证据要求（以 label 开头 + 操作性说明）
  weight: number; // 0-1 信号权重（保留字段，Evidence Review 当前未加权）
}

/** 能力边：能力图的关系（前置/支持/相关） */
export interface CapabilityEdge {
  from: string;
  to: string;
  relationType: EdgeType;
}

/** 能力节点：CapabilityMap 的基本单元（统一契约；mapper 输出填全，planner 消费子集） */
export interface Capability {
  id: string;
  title: string;
  description: string;
  // 短语信号（运行时契约：Evidence Review 的 capabilitySignals 与 planner 文案均消费 label）
  signals: string[];
  // 建议熟练等级 0-3 与里程碑标记（planner 消费）
  targetLevel: number;
  isMilestone: boolean;
  activityTemplates?: ActivityType[]; // 允许的活动类型（缺省用自适应默认活动链）
  sourceRefs?: SourceRef[]; // 来源引用
  // mapper 审计字段
  level?: CapabilityLevel;
  source?: CapabilitySource;
  prerequisites?: string[]; // 前置能力 id（引用本图内 capability id）
  // 完整信号规格（Evidence Requirement；mapper 输出，Evidence Review 文案消费）
  signalSpecs?: CapabilitySignalSpec[];
}

/** Capability Mapper 输出：Domain / Capability / Signal / Evidence Requirement */
export interface CapabilityMap {
  version: string; // 能力图版本（内容包版本或 fallback 版本）
  source?: "content_pack" | "generic"; // 能力图来源（planner 消费）
  domain?: string;
  capabilities: Capability[];
  edges: CapabilityEdge[];
  strategy?: "existing_content" | "generic_fallback"; // 本次映射采用哪条规则路径
  matchedContent?: Array<{ nodeId: string; score: number }>; // 命中审计（fallback 为空）
  rationale?: string;
}

// ── goalAnalyzer：目标解析 → GoalAnalysis ──────────────
export interface GoalAnalyzerInput {
  goal: string; // 学习目标原文
  preference?: "breadth_first" | "build_first";
  selfReport?: Record<string, number>; // 自评：nodeId → 0-3 熟练等级
}

export interface GoalAnalyzerPort {
  analyzeGoal(input: GoalAnalyzerInput): GoalAnalysis;
}

// ── courseAnalyzer：材料解析 → CourseMaterialAnalysis[] ──
export interface CourseMaterialAnalyzerInput {
  goalAnalysis: GoalAnalysis;
  materialIds: string[]; // 用户已有材料 id（内容包资源或自由 id）
  contentPack?: LearningContentPack; // 默认 learningContentPack
}

export interface CourseMaterialAnalyzerPort {
  analyzeMaterials(input: CourseMaterialAnalyzerInput): CourseMaterialAnalysis[];
}

// ── materialReviewer：资料质量 + 个人适配判断 ───────────
// 判断材料是否适合作为"当前用户/目标/阶段"的学习主线。课程本身的影响力不等于
// 个人适配；高影响但缺练习/项目的材料只能作为 reference 或 supplement。

export type MaterialReviewVerdict = "core" | "reference" | "supplement" | "not_recommended";

export interface MaterialReviewScore {
  sourceCredibility: number;
  structureClarity: number;
  practiceDensity: number;
  assessmentClarity: number;
  projectRelevance: number;
  freshness: number;
  marketingRisk: number;
  beginnerFit: number;
  goalFit: number;
  timeFit: number;
}

export interface MaterialReview {
  materialId: string;
  title: string;
  verdict: MaterialReviewVerdict;
  qualityScore: number;
  personalFitScore: number;
  scores: MaterialReviewScore;
  strengths: string[];
  risks: string[];
  missingAreas: string[];
  rationale: string;
}

export interface MaterialReviewerInput {
  goalAnalysis: GoalAnalysis;
  materials: CourseMaterialAnalysis[];
  situation?: Pick<LearningSituation, "learnerLevel" | "timePressure" | "currentStage">;
  weeksRemaining?: number;
}

export interface MaterialReviewerPort {
  reviewMaterials(input: MaterialReviewerInput): MaterialReview[];
}

// ── capabilityMapper：目标+材料分析 → 能力结构（管线前半段）────────
// 把学习目标与课程/材料分析转换成 Domain / Capability / Signal /
// Evidence Requirement 能力结构，供 planner 编排与 Evidence Review 消费。
// 规则版实现见 capability-mapper.ts：命中现有内容包时复用 content.ts /
// signals.ts 的节点与信号；未命中时生成 generic fallback，保证不崩。

export interface CapabilityMapperInput {
  goalAnalysis: GoalAnalysis;
  materials: CourseMaterialAnalysis[];
  contentPack?: LearningContentPack; // 默认 learningContentPack
  minMatchScore?: number; // 命中阈值（默认 0.5）
}

export interface CapabilityMapperPort {
  mapCapabilities(input: CapabilityMapperInput): CapabilityMap;
}

// ── 规划模式：受控 adaptive 激活（Full Chain Phase 3）──
// runDiagnostic 可选指定；默认 "legacy"。plannerMode 随诊断输入快照持久化
// （learning_diagnostics.answers_json），confirmProposal 据此决定计划来源。
export type PlannerMode = "legacy" | "adaptive_preview" | "adaptive_existing_content";

// ── 学习分析：runDiagnostic 前半段流水线的瞬态产物（Full Chain Phase 2+）──
// 由 goalAnalyzer → courseAnalyzer → materialReviewer → capabilityMapper → learningDecisionPolicy → adaptiveRoutePlanner
// 组合而成，仅作为 workspace.analysis 返回（不落库、不进入证据评审闭环）。
export interface LearningAnalysis {
  goalAnalysis: GoalAnalysis;
  courseMaterials: CourseMaterialAnalysis[];
  materialReviews: MaterialReview[];
  capabilityMap: CapabilityMap;
  learningDecision: LearningDecision;
  adaptivePlan: AdaptivePlan;
  /** 本次诊断请求的规划模式（默认 "legacy"；adaptive 是否可驱动正式计划） */
  plannerMode: PlannerMode;
  /** 实现模式：Phase 3 仍为 "rule"（全部规则实现） */
  mode: "rule";
}

// ── learningDecisionPolicy：学习处境 → 下一步学习决策 ─────────
// 这层不是路线生成器，而是动态学习伙伴的"判断入口"：根据目标清晰度、材料状态、
// 完成模式、证据反馈、复测窗口和阶段目标，判断当前最该澄清、理解、练习、产出、
// 修复、复习还是包装成果。先用规则版，未来可替换为 LLM 增强但不能直接写状态。

export type LearningStage =
  | "orientation"
  | "foundation"
  | "guided_practice"
  | "independent_practice"
  | "artifact_building"
  | "review_and_repair"
  | "consolidation"
  | "portfolio_packaging";

export type LearningNeed =
  | "clarify_goal"
  | "review_material"
  | "build_understanding"
  | "practice_skill"
  | "produce_artifact"
  | "repair_gap"
  | "spaced_review"
  | "motivation_support"
  | "route_correction"
  | "package_portfolio";

export type LearningMode =
  | "explain"
  | "feynman"
  | "case_compare"
  | "guided_practice"
  | "independent_practice"
  | "project_build"
  | "spaced_review"
  | "rubric_review"
  | "portfolio_packaging";

export type LearningSignalType = "hard_evidence" | "soft_signal" | "behavior_signal";
export type EvidencePolicy = "none" | "soft_signal" | "hard_evidence" | "behavior_signal";

export interface LearningSituationInput {
  goalText: string;
  goalAnalysis?: GoalAnalysis;
  courseMaterials?: CourseMaterialAnalysis[];
  materialReviews?: MaterialReview[];
  capabilityMap?: CapabilityMap;
  hasRoute?: boolean;
  hasActiveActivities?: boolean;
  latestReviewVerdict?: EvidenceVerdict;
  missingSignals?: string[];
  repeatedGaps?: string[];
  dueReviewCount?: number;
  completionRate?: number; // 0-1
  skippedActivities?: number;
  weeksRemaining?: number;
  recentHardEvidenceCount?: number;
  recentSoftSignalCount?: number;
  capabilityLevelById?: Record<string, number>; // 细粒度能力水平；总体 learnerLevel 只作粗粒度推断
}

export interface LearningSituation {
  goalClarity: "vague" | "usable" | "clear";
  materialStatus: "none" | "unreviewed" | "usable" | "risky";
  learnerLevel: "newcomer" | "beginner" | "intermediate" | "advanced";
  currentStage: LearningStage;
  motivationState: "steady" | "fragile" | "blocked";
  timePressure: "low" | "medium" | "high";
  recentPattern: {
    completionRate: number;
    repeatedGaps: string[];
    skippedActivities: number;
  };
  activeRisks: string[];
}

export interface LearningDecision {
  situation: LearningSituation;
  primaryNeed: LearningNeed;
  recommendedMode: LearningMode;
  nextAction: string;
  reason: string;
  expectedOutcome: string;
  evidencePolicy: EvidencePolicy;
  signalTypes: LearningSignalType[];
  tolerance: {
    canReorder: boolean;
    reason: string;
  };
  toolCalls: string[];
  confidence: number; // 0-1
}

export interface LearningDecisionPolicyPort {
  decideNextMove(input: LearningSituationInput): LearningDecision;
}

// ── 组合：agent 注册表 ────────────────────────────────

export interface AgentRegistry {
  goalAnalyzer: GoalAnalyzerPort;
  courseAnalyzer: CourseMaterialAnalyzerPort;
  materialReviewer: MaterialReviewerPort;
  capabilityMapper: CapabilityMapperPort;
  planner: PlannerPort;
  activityComposer: ActivityComposerPort;
  evidenceEvaluator: EvidenceEvaluatorPort;
  adjustmentAdvisor: AdjustmentAdvisorPort;
  adaptiveRoutePlanner: AdaptivePlannerPort;
  learningDecisionPolicy: LearningDecisionPolicyPort;
}

// ── 辅助类型：agent 使用内容包 ─────────────────────────

export interface AgentContext {
  contentPack: LearningContentPack;
  edgeType?: EdgeType;
}
