// 作品级阶段路径与动态演示（规则版，确定性）。
// ponytail: 不新增 DB/schema；先把可讲、可测的 stage path/simulation 做成纯函数。

import type {
  AdaptivePlan,
  AdaptiveWeekItem,
} from "./adaptive-types.ts";
import type {
  LearningDecision,
  LearningSituation,
  LearningSignalType,
  MaterialReview,
} from "./types.ts";

export interface StagePathWeek {
  weekNumber: number;
  theme: string;
  objective: string;
  capabilityIds: string[];
  checkpoint: string;
  evidenceRequirement: string;
  expectedArtifact?: string;
}

export interface StagePath {
  id: string;
  title: string;
  targetLearner: string;
  durationWeeks: number;
  stageGoal: string;
  finalArtifact: string;
  weeks: StagePathWeek[];
  milestones: Array<{
    weekNumber: number;
    title: string;
    confirmationRequired: boolean;
    evidencePolicy: "soft_signal" | "hard_evidence";
  }>;
  rationale: string;
}

export type SprintEventType =
  | "material_mismatch"
  | "capacity_drop"
  | "low_energy"
  | "evidence_failed"
  | "goal_clarified"
  | "artifact_push";

export interface SprintEvent {
  weekNumber: number;
  type: SprintEventType;
  description: string;
}

export interface SprintAdjustment {
  weekNumber: number;
  event: SprintEventType;
  before: string;
  after: string;
  reason: string;
  requiresConfirmation: boolean;
  signalTypes: LearningSignalType[];
}

export interface DynamicSprintSimulation {
  scenarioId: string;
  title: string;
  events: SprintEvent[];
  adjustments: SprintAdjustment[];
  trace: Array<{
    step: string;
    summary: string;
    tool: string;
  }>;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function firstCapabilities(plan: AdaptivePlan, count: number): string[] {
  return plan.orderedCapabilities
    .filter((capability) => !capability.satisfied)
    .slice(0, count)
    .map((capability) => capability.capabilityId);
}

function activitySummary(items: AdaptiveWeekItem[]): string {
  if (items.length === 0) return "暂无可执行活动";
  return items.slice(0, 3).map((item) => item.title).join("、");
}

export function planPortfolioStagePath(input: {
  goal: string;
  situation: LearningSituation;
  decision: LearningDecision;
  adaptivePlan: AdaptivePlan;
  materialReviews: MaterialReview[];
}): StagePath {
  const capabilityIds = firstCapabilities(input.adaptivePlan, 8);
  const weakMaterials = input.materialReviews
    .filter((review) => review.verdict === "supplement" || review.verdict === "not_recommended")
    .map((review) => review.title);
  const prefix = capabilityIds.length > 0 ? capabilityIds : input.adaptivePlan.route.nodeIds.slice(0, 6);
  return {
    id: `stage-${stableHash(`${input.goal}|${prefix.join(",")}`)}`,
    title: "AI PM 转型启动阶段",
    targetLearner: "AI PM 转型小白",
    durationWeeks: 8,
    stageGoal: "从模糊 AI PM 学习诉求，推进到一个可评审的 AI 产品作品集小产出。",
    finalArtifact: "AI Agent 产品 PRD 或 AI 产品案例拆解报告",
    weeks: [
      {
        weekNumber: 1,
        theme: "处境识别与资料校准",
        objective: "确认目标是否可执行，并判断现有资料能否作为主线。",
        capabilityIds: prefix.slice(0, 2),
        checkpoint: "用户能说明当前目标、资料角色和最大风险。",
        evidenceRequirement: "资料定位说明 + 目标澄清短文；作为 soft signal，不直接验证掌握。",
      },
      {
        weekNumber: 2,
        theme: "AI 产品判断基础",
        objective: "建立 AI 产品机制、用户问题和能力边界的基本判断框架。",
        capabilityIds: prefix.slice(0, 3),
        checkpoint: "用户能用一个案例解释 AI 功能为什么成立或不成立。",
        evidenceRequirement: "案例拆解 + 能力信号自评；可进入 Evidence Review。",
      },
      {
        weekNumber: 3,
        theme: "作品方向收敛",
        objective: "选择一个小作品方向，形成可交付的 PRD/分析报告骨架。",
        capabilityIds: prefix.slice(1, 4),
        checkpoint: "用户确认作品主题、范围、证据标准和下一步。",
        evidenceRequirement: "作品大纲 + 风险假设 + 评估标准。",
        expectedArtifact: "AI Agent 产品 PRD 初稿或案例拆解大纲",
      },
      {
        weekNumber: 4,
        theme: "方案与评估设计",
        objective: "补齐用户场景、成功指标、失败边界和评估方式。",
        capabilityIds: prefix.slice(2, 5),
        checkpoint: "作品能被第三方按标准评审。",
        evidenceRequirement: "评估表 + 关键用户路径 + 风险说明。",
      },
      {
        weekNumber: 5,
        theme: "原型或材料深化",
        objective: "把作品从文档骨架推进到可展示方案。",
        capabilityIds: prefix.slice(3, 6),
        checkpoint: "完成一版可展示产物。",
        evidenceRequirement: "PRD/案例报告 v1 + 自评。",
      },
      {
        weekNumber: 6,
        theme: "证据补强",
        objective: "针对评审缺口补齐能力信号。",
        capabilityIds: prefix.slice(4, 7),
        checkpoint: "关键缺失信号被补齐。",
        evidenceRequirement: "补强说明 + 修订 diff 或补充分析。",
      },
      {
        weekNumber: 7,
        theme: "作品集包装",
        objective: "把学习过程、产品判断、AI 边界和结果整理成作品集叙事。",
        capabilityIds: prefix.slice(5, 8),
        checkpoint: "能在 10-15 分钟讲清项目。",
        evidenceRequirement: "作品集 README + demo script。",
      },
      {
        weekNumber: 8,
        theme: "复测与下一阶段",
        objective: "复核已验证能力，生成下一阶段路线。",
        capabilityIds: prefix.slice(0, 4),
        checkpoint: "完成阶段复盘和下一阶段选择。",
        evidenceRequirement: "延迟复测 + 下一阶段计划。",
      },
    ],
    milestones: [
      { weekNumber: 1, title: "确认资料角色和目标边界", confirmationRequired: true, evidencePolicy: "soft_signal" },
      { weekNumber: 3, title: "确认作品方向", confirmationRequired: true, evidencePolicy: "hard_evidence" },
      { weekNumber: 5, title: "提交作品 v1", confirmationRequired: false, evidencePolicy: "hard_evidence" },
      { weekNumber: 8, title: "阶段掌握确认", confirmationRequired: true, evidencePolicy: "hard_evidence" },
    ],
    rationale:
      `当前处境为 ${input.situation.currentStage}，下一步是 ${input.decision.primaryNeed}。` +
      (weakMaterials.length > 0
        ? `资料「${weakMaterials.join("、")}」不宜直接当主线，因此阶段从资料校准开始。`
        : "资料无阻断风险，阶段从理解和产出并行启动。"),
  };
}

export function simulateDynamicSprint(input: {
  stagePath: StagePath;
  situation: LearningSituation;
  decision: LearningDecision;
  adaptivePlan: AdaptivePlan;
  materialReviews: MaterialReview[];
}): DynamicSprintSimulation {
  const weakMaterial = input.materialReviews.some((review) =>
    review.verdict === "supplement" || review.verdict === "not_recommended"
  );
  const events: SprintEvent[] = [
    {
      weekNumber: 1,
      type: weakMaterial ? "material_mismatch" : "goal_clarified",
      description: weakMaterial
        ? "用户带来的资料缺练习/评估或存在营销风险，不能直接当主线。"
        : "用户把模糊目标收敛成 AI PM 作品集启动阶段。",
    },
    {
      weekNumber: 2,
      type: input.situation.capacityState === "critical" ? "capacity_drop" : "low_energy",
      description: "本周可用时间和精力下降，需要缩小承诺但保留学习连续性。",
    },
    {
      weekNumber: 3,
      type: "evidence_failed",
      description: "用户提交的案例分析缺少能力信号覆盖，需要先补强再进入作品确认。",
    },
    {
      weekNumber: 3,
      type: "artifact_push",
      description: "周末容量恢复，系统安排作品产出活动并要求 hard evidence。",
    },
  ];
  const before = activitySummary(input.adaptivePlan.weeklyPlan.activities);
  const adjustments: SprintAdjustment[] = [
    {
      weekNumber: 1,
      event: events[0]!.type,
      before,
      after: weakMaterial ? "资料校准活动 + 目标澄清短文" : "目标确认 + 建立模型活动",
      reason: input.decision.reason,
      requiresConfirmation: weakMaterial,
      signalTypes: ["soft_signal"],
    },
    {
      weekNumber: 2,
      event: events[1]!.type,
      before: "90-120 分钟独立产出活动",
      after: "拆成 2 个 30-45 分钟低负荷活动，保留一个核心证据目标",
      reason: "时间精力下降时，系统优先降低粒度和认知负荷，而不是清空计划。",
      requiresConfirmation: false,
      signalTypes: ["behavior_signal"],
    },
    {
      weekNumber: 3,
      event: "evidence_failed",
      before: "直接进入作品确认",
      after: "插入补强活动：补齐缺失能力信号后再提交作品证据",
      reason: "hard evidence 未覆盖关键能力信号，不能直接推动掌握。",
      requiresConfirmation: false,
      signalTypes: ["hard_evidence", "soft_signal"],
    },
    {
      weekNumber: 3,
      event: "artifact_push",
      before: "继续泛读资料",
      after: `提交「${input.stagePath.finalArtifact}」作为阶段作品`,
      reason: "阶段路径需要导向可评审成果，而不是无限学习输入。",
      requiresConfirmation: true,
      signalTypes: ["hard_evidence"],
    },
  ];
  return {
    scenarioId: `sprint-${input.stagePath.id}`,
    title: "AI PM 转型启动阶段前三周动态演示",
    events,
    adjustments,
    trace: [
      { step: "assessSituation", summary: input.situation.nextBestMove, tool: "learningDecisionPolicy" },
      { step: "auditMaterials", summary: `${input.materialReviews.length} 份资料完成适配判断`, tool: "materialReviewer" },
      { step: "planStagePath", summary: `${input.stagePath.durationWeeks} 周阶段路径已生成`, tool: "stagePathPlanner" },
      { step: "simulateDynamicSprint", summary: `${adjustments.length} 次动态调整已生成`, tool: "dynamicSprintSimulator" },
    ],
  };
}
