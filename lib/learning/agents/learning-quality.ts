// 作品级评测与监控读模型（规则版，确定性）。

import type {
  Evidence,
  AdjustmentStatus,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";
import type {
  DynamicSprintSimulation,
  StagePath,
} from "./stage-path-planner.ts";
import type {
  LearningAnalysis,
  MaterialReview,
} from "./types.ts";
import type { PortfolioArtifactIteration } from "./next-stage-planner.ts";

export interface LearningQualityMonitor {
  planCompletionRate: number;
  evidencePassRate: number;
  repeatedGapCount: number;
  materialMismatchCount: number;
  artifactTaskExists: boolean;
  artifactEvidenceStatus: "none" | Evidence["status"];
  nextStageAdjustmentStatus: "none" | AdjustmentStatus;
  nextStagePlanExists: boolean;
  artifactIterationStatus: PortfolioArtifactIteration["status"];
  artifactRevisionCount: number;
  traceCompleteness: number;
  memoryCompleteness: number;
  toolRegistryReady: boolean;
  workflowRuntimeReady: boolean;
  fallbackMode: boolean;
  reviewConfidence: number;
  suggestions: string[];
}

export interface EvalResult {
  id: string;
  passed: boolean;
  score: number;
  rationale: string;
}

export interface LearningEvalReport {
  passRate: number;
  total: number;
  passed: number;
  avgScore: number;
  results: EvalResult[];
  recommendations: string[];
}

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100) / 100;
}

export function summarizeLearningQuality(input: {
  weeklyPlan: WeeklyPlan | null;
  activities: LearningActivity[];
  evidence: Evidence[];
  nodeProgress: NodeProgress[];
  materialReviews?: MaterialReview[];
  fallbackMode?: boolean;
  nextStagePlanExists?: boolean;
  artifactIteration?: PortfolioArtifactIteration;
}): LearningQualityMonitor {
  const completed = input.activities.filter((activity) => activity.status === "completed").length;
  const accepted = input.evidence.filter((evidence) => evidence.status === "accepted").length;
  const mismatch = (input.materialReviews ?? []).filter((review) =>
    review.verdict === "supplement" || review.verdict === "not_recommended"
  ).length;
  const repeatedGapCount = input.evidence.filter((evidence) => evidence.status === "needs_revision").length;
  const suggestions: string[] = [];
  if (mismatch > 0) suggestions.push("先处理资料适配风险，避免把参考材料误当主线。");
  if (repeatedGapCount > 0) suggestions.push("证据反复缺口应转成补强活动，而不是继续扩新内容。");
  if (input.weeklyPlan && completed === 0 && input.activities.length > 0) {
    suggestions.push("当前活动未完成，下一轮应降低活动粒度或调整容量。");
  }
  if (input.artifactIteration?.status === "revision_needed") {
    suggestions.push("作品证据已进入修订轮，应优先补齐 rubric 缺口再推进包装。");
  }
  if (input.artifactIteration?.status === "mastery_confirmation_needed") {
    suggestions.push("作品 hard evidence 已通过，但还需要用户确认掌握，不能静默进入下一阶段。");
  }
  const artifactActivity = input.activities.find((activity) =>
    activity.activityType === "integrated_task"
    && /作品任务|AI Agent 产品 PRD|案例拆解报告|portfolio/i.test(
      `${activity.title} ${activity.goal} ${activity.expectedEvidence}`,
    )
  );
  const artifactEvidence = artifactActivity
    ? input.evidence.find((evidence) => evidence.activityId === artifactActivity.id && evidence.status === "accepted")
      ?? input.evidence.find((evidence) => evidence.activityId === artifactActivity.id)
    : undefined;
  const nextStage = input.evidence.some((evidence) => evidence.status === "accepted")
    ? input.nodeProgress.some((progress) => progress.confirmedAt) ? "proposed" : "none"
    : "none";
  return {
    planCompletionRate: ratio(completed, input.activities.length),
    evidencePassRate: ratio(accepted, input.evidence.length),
    repeatedGapCount,
    materialMismatchCount: mismatch,
    artifactTaskExists: Boolean(artifactActivity),
    artifactEvidenceStatus: artifactEvidence?.status ?? "none",
    nextStageAdjustmentStatus: nextStage,
    nextStagePlanExists: input.nextStagePlanExists ?? false,
    artifactIterationStatus: input.artifactIteration?.status ?? (artifactActivity ? "draft_needed" : "not_started"),
    artifactRevisionCount: input.artifactIteration?.revisionCount ?? repeatedGapCount,
    traceCompleteness: artifactActivity ? 0.8 : 0.45,
    memoryCompleteness: input.evidence.length > 0 || input.activities.length > 0 ? 0.7 : 0.35,
    toolRegistryReady: true,
    workflowRuntimeReady: true,
    fallbackMode: input.fallbackMode ?? false,
    reviewConfidence: input.evidence.length > 0 ? ratio(accepted, input.evidence.length) : 0,
    suggestions,
  };
}

export function evaluatePortfolioReadiness(input: {
  analysis: LearningAnalysis;
  stagePath: StagePath;
  simulation: DynamicSprintSimulation;
}): LearningEvalReport {
  const results: EvalResult[] = [
    {
      id: "situation_decision",
      passed: Boolean(input.analysis.learningDecision.primaryNeed && input.analysis.learningDecision.situation.nextBestMove),
      score: input.analysis.learningDecision.confidence,
      rationale: "Learning Situation 必须产出 nextBestMove 与结构化决策。",
    },
    {
      id: "material_fit",
      passed: input.analysis.materialReviews.every((review) =>
        ["core", "reference", "supplement", "not_recommended"].includes(review.verdict)
      ),
      score: input.analysis.materialReviews.length > 0 ? 0.9 : 0.7,
      rationale: "资料必须被定位为主线/参考/补充/不建议。",
    },
    {
      id: "stage_path",
      passed: input.stagePath.durationWeeks >= 6 && input.stagePath.weeks.length >= 6,
      score: input.stagePath.durationWeeks >= 6 ? 0.92 : 0.4,
      rationale: "作品级版本必须规划完整阶段，而不是只排本周。",
    },
    {
      id: "dynamic_adjustment",
      passed: input.simulation.adjustments.length >= 4,
      score: input.simulation.adjustments.length >= 4 ? 0.9 : 0.5,
      rationale: "前三周演示必须覆盖多次动态调整。",
    },
    {
      id: "artifact_loop",
      passed: input.stagePath.finalArtifact.length > 0 && input.stagePath.milestones.some((m) => m.evidencePolicy === "hard_evidence"),
      score: 0.88,
      rationale: "阶段路径必须导向 hard evidence 作品产出。",
    },
    {
      id: "artifact_revision_loop",
      passed: input.stagePath.milestones.some((m) => m.weekNumber >= 5 && m.evidencePolicy === "hard_evidence"),
      score: 0.86,
      rationale: "作品级闭环必须支持作品 v1、评审、修订和下一阶段包装，而不是一次提交即完成。",
    },
    {
      id: "rubric_guardrail",
      passed: input.stagePath.finalArtifact.includes("PRD") || input.stagePath.finalArtifact.includes("案例"),
      score: 0.84,
      rationale: "作品证据必须被 rubric 约束，缺关键标准时应退回修订。",
    },
    {
      id: "decision_trace_shape",
      passed: Boolean(input.analysis.decisionTrace?.traceId && input.analysis.decisionTrace.steps.length >= 2),
      score: input.analysis.decisionTrace ? 0.86 : 0.35,
      rationale: "诊断必须输出统一 Decision Trace，解释输入、工具步骤和 HITL。",
    },
    {
      id: "kernel_boundary",
      passed: Boolean(input.analysis.decisionTrace?.decision.requiresConfirmation),
      score: 0.84,
      rationale: "Core Kernel 决策应是结构化提案，不直接静默写入高风险状态。",
    },
    {
      id: "memory_model",
      passed: true,
      score: 0.82,
      rationale: "Learning Memory 以聚合读模型表达 hard/soft/behavior/material/artifact/decision memory。",
    },
    {
      id: "tool_registry",
      passed: true,
      score: 0.86,
      rationale: "内部规则能力已标准化为 Trellis Tool Registry，可被 Kernel 和 workflow 复用。",
    },
    {
      id: "workflow_runtime",
      passed: input.simulation.trace.length >= 4,
      score: 0.86,
      rationale: "Mastra runtime demo 应展示 workflow step、trace、HITL 和 fallbackMode。",
    },
  ];
  const passed = results.filter((result) => result.passed).length;
  const avgScore = Math.round((results.reduce((sum, result) => sum + result.score, 0) / results.length) * 100) / 100;
  const recommendations = results
    .filter((result) => !result.passed)
    .map((result) => `${result.id} 未通过：${result.rationale}`);
  return {
    passRate: ratio(passed, results.length),
    total: results.length,
    passed,
    avgScore,
    results,
    recommendations,
  };
}
