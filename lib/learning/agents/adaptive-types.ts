// 自适应路线规划（AdaptiveRoutePlanner）— 契约类型（纯结构，可替换层）
//
// 背景：现有 RulePlanner（planner.ts）只消费 DiagnosticInput（自评 + 偏好 + 硬编码
// ROUTE_SEQUENCE）。本契约定义"前半段补齐"后的输入输出：GoalAnalysis +
// CourseMaterialAnalysis + CapabilityMap → 路线 / 有序能力 / 周计划 / 活动草稿 /
// 理由 / 模式。
//
// 设计约束：
//   1. 不依赖具体领域内容包；CapabilityMap 是通用能力图（AI 通识只是其中一个实例）。
//   2. 不引入 agent runtime / LangGraph；仍是可替换接口 + 规则实现（确定性）。
//   3. 不改 UI、不改 DB schema、不动 Evidence Review；本模块只新增文件。
//   4. 现有 RulePlanner 保留为 fallback：无 CapabilityMap 时服务层继续走旧路径。
//
// 类型统一（Full Chain Phase 1）：GoalAnalysis / CourseMaterialAnalysis /
// Capability / CapabilityMap / CapabilityEdge 的单一契约位于 agents/types.ts，
// 本文件只 re-export、不再维护第二套同名冲突类型；此处仅保留自适应专属类型
// （AdaptiveRoute / AdaptiveWeeklyPlan / AdaptivePlan / AdaptivePlannerPort 等）。

import type { ActivityType, NodeStatus, SourceRef } from "../domain/types.ts";
import type {
  Capability,
  CapabilityEdge,
  CapabilityMap,
  CourseMaterialAnalysis,
  GoalAnalysis,
} from "./types.ts";

export type {
  Capability,
  CapabilityEdge,
  CapabilityLevel,
  CapabilityMap,
  CapabilitySignalSpec,
  CapabilitySource,
  CourseMaterialAnalysis,
  GoalAnalysis,
  GoalTargetDepth,
} from "./types.ts";

// ── 输出：路线 / 周计划 / 活动 / 理由 / 模式 ──────────

/** 路线上的能力节点（含前置闭包；satisfied = 自评/状态已达标，仍保留供上下文）。 */
export interface AdaptiveRouteNode {
  capabilityId: string;
  title: string;
  description: string;
  targetLevel: number;
  isMilestone: boolean;
  /** 前置能力（prerequisite 入边） */
  prerequisiteIds: string[];
  /** 支持能力（supports 入边，可选深化方向） */
  supportingIds: string[];
  signals: string[];
  activityTemplates: ActivityType[];
  sourceRefs: SourceRef[];
  /** 自评/节点状态已达目标等级 → 本周不排基础活动（后置/跳过） */
  satisfied: boolean;
}

export interface AdaptiveRoute {
  routeId: string;
  title: string;
  description: string;
  version: string;
  /** 学习顺序（前置优先的拓扑序） */
  nodeIds: string[];
  nodes: AdaptiveRouteNode[];
  /** 本路线用到的边（prerequisite/supports/related 子集） */
  edges: CapabilityEdge[];
}

/** 周计划条目（与 WeeklyPlanDraft.activities 同语义，能力化命名）。 */
export interface AdaptiveWeekItem {
  capabilityId: string;
  activityType: ActivityType;
  title: string;
  estimatedMinutes: number;
  isCore: boolean;
  whyNow: string;
}

export interface AdaptiveWeeklyPlan {
  weekKey: string;
  capacityMinutes: number;
  coreActivityCount: number;
  optionalActivityCount: number;
  /** 核心活动承诺时长（≤ capacityMinutes） */
  totalMinutes: number;
  activities: AdaptiveWeekItem[];
  rationale: string;
}

/** 活动草稿：能力信号参数化后的完整学习活动。 */
export interface AdaptiveActivityDraft {
  capabilityId: string;
  activityType: ActivityType;
  title: string;
  goal: string;
  estimatedMinutes: number;
  inputRefs: string[];
  steps: string[];
  /** 产出证据（能力信号驱动） */
  expectedEvidence: string;
  /** 活动完成标准（与 evaluationCriteria 同内容，供编排层直接消费） */
  completionCriteria: string;
  evaluationCriteria: string;
  nextAdvice: string;
}

/** 完整自适应计划（一次 plan 调用的全部产物）。 */
export interface AdaptivePlan {
  route: AdaptiveRoute;
  /** 按学习顺序排列的路线能力（含 satisfied 标记） */
  orderedCapabilities: AdaptiveRouteNode[];
  weeklyPlan: AdaptiveWeeklyPlan;
  /** weeklyPlan.activities 对应的完整活动草稿（含可选活动） */
  activities: AdaptiveActivityDraft[];
  rationale: string;
  /** content_pack = 消费现有内容包投影；generic = 通用能力图 */
  mode: "content_pack" | "generic";
}

/** AdaptiveRoutePlanner 输入（本任务要求的最小契约）。 */
export interface AdaptivePlannerInput {
  goalAnalysis: GoalAnalysis;
  capabilityMap: CapabilityMap;
  /** 每周可投入时间（分钟） */
  weeklyMinutes: number;
  preference: "breadth_first" | "build_first";
  /** 自评：capabilityId → 0-3 熟练等级 */
  selfReport?: Record<string, number>;
  /** 可选：节点运行状态（接入服务层后由 NodeProgress 推导；缺省只用 selfReport） */
  nodeStatusById?: Record<string, NodeStatus>;
  /** 可选：课程材料分析（影响输入引用与偏科检查文案） */
  materials?: CourseMaterialAnalysis[];
  weekKey?: string;
  /** 确定性种子（当前规则实现为纯函数，seed 仅预留） */
  seed?: number;
}

export interface AdaptivePlannerPort {
  plan(input: AdaptivePlannerInput): AdaptivePlan;
}

// ── 能力信号驱动的活动组合器输入 ───────────────────────
// 与既有 ComposeActivityInput 同构，额外携带能力信号（signals）与补强上下文，
// 使 expectedEvidence / completionCriteria / evaluationCriteria 能由信号参数化。
export interface ComposeAdaptiveActivityInput {
  /** 能力本体（至少需要 id / title / signals；description 用于后续扩展） */
  capability: Pick<Capability, "id" | "title" | "description" | "signals">;
  activityType: ActivityType;
  estimatedMinutes: number;
  /** 跳学验证活动标记（独立练习） */
  isSkipValidation?: boolean;
  /** 补强：只针对缺失信号（独立练习变体，复测失败/证据退回后使用） */
  focusSignals?: string[];
  /** 情境应用：本次整合的能力 ID 列表（缺省 = 单能力） */
  integrateCapabilityIds?: string[];
  inputRefs?: string[];
}
