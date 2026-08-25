// learningDecisionPolicy — 规则版学习决策器
// 目标：把"动态老师/伙伴"的第一步做成可测试的确定性判断。
// ponytail: 先用透明规则覆盖高价值场景；未来接 LLM 时保留本规则作为 fallback。

import type {
  EvidencePolicy,
  LearningDecision,
  LearningDecisionPolicyPort,
  LearningMode,
  LearningNeed,
  LearningSignalType,
  LearningSituation,
  LearningSituationInput,
  LearningStage,
} from "./types.ts";

function clamp01(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function goalClarity(goalText: string): LearningSituation["goalClarity"] {
  const goal = goalText.trim();
  if (goal.length < 8) return "vague";
  if (/(是什么|不知道|不清楚|迷茫|随便学|想学ai|想学 AI)$/i.test(goal)) return "vague";
  if (/(项目|作品|交付|转型|面试|考试|证书|上线|应用|报告)/.test(goal)) return "clear";
  return "usable";
}

function materialStatus(input: LearningSituationInput): LearningSituation["materialStatus"] {
  const reviews = input.materialReviews ?? [];
  if (reviews.some((review) => review.verdict === "not_recommended" || review.verdict === "supplement")) {
    return "risky";
  }
  if (reviews.length > 0 && reviews.every((review) => review.verdict === "core" || review.verdict === "reference")) {
    return "usable";
  }
  const materials = input.courseMaterials ?? [];
  if (materials.length === 0) return "none";
  const hasRisk = materials.some((m) => (m.credibilityLevel ?? 2) <= 1 || !m.coveredCapabilityIds?.length);
  if (hasRisk || input.capabilityMap?.strategy === "generic_fallback") return "risky";
  const hasCoverage = materials.some((m) => (m.coveredCapabilityIds ?? []).length > 0);
  return hasCoverage ? "usable" : "unreviewed";
}

function learnerLevel(input: LearningSituationInput): LearningSituation["learnerLevel"] {
  const levels = Object.values(input.capabilityLevelById ?? {});
  if (levels.length > 0) {
    const avg = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    if (avg >= 2.5) return "advanced";
    if (avg >= 1.5) return "intermediate";
    if (avg >= 0.5) return "beginner";
  }
  if ((input.goalAnalysis?.depth ?? 2) <= 1 && !input.hasRoute) return "newcomer";
  return "beginner";
}

function timePressure(weeksRemaining: number | undefined): LearningSituation["timePressure"] {
  if (typeof weeksRemaining !== "number") return "medium";
  if (weeksRemaining <= 1) return "high";
  if (weeksRemaining <= 3) return "medium";
  return "low";
}

function motivationState(completionRate: number, skippedActivities: number): LearningSituation["motivationState"] {
  if (completionRate < 0.25 || skippedActivities >= 3) return "blocked";
  if (completionRate < 0.55 || skippedActivities >= 1) return "fragile";
  return "steady";
}

function stageFromDecision(input: LearningSituationInput, base: {
  goal: LearningSituation["goalClarity"];
  materials: LearningSituation["materialStatus"];
  pressure: LearningSituation["timePressure"];
  level: LearningSituation["learnerLevel"];
}): LearningStage {
  if (input.latestReviewVerdict === "needs_revision" || (input.repeatedGaps ?? []).length > 0) {
    return "review_and_repair";
  }
  if ((input.dueReviewCount ?? 0) > 0) return "consolidation";
  if (base.pressure === "high" && (input.recentHardEvidenceCount ?? 0) > 0) return "portfolio_packaging";
  if (base.goal === "vague" || base.materials === "none" || base.materials === "risky") return "orientation";
  if (base.level === "newcomer" || base.level === "beginner") return "foundation";
  if ((input.recentHardEvidenceCount ?? 0) === 0 && input.hasActiveActivities) return "artifact_building";
  return input.hasRoute ? "guided_practice" : "orientation";
}

function buildSituation(input: LearningSituationInput): LearningSituation {
  const completionRate = clamp01(input.completionRate, 1);
  const skippedActivities = input.skippedActivities ?? 0;
  const goal = goalClarity(input.goalText);
  const materials = materialStatus(input);
  const level = learnerLevel(input);
  const pressure = timePressure(input.weeksRemaining);
  const motivation = motivationState(completionRate, skippedActivities);
  const repeatedGaps = input.repeatedGaps ?? [];
  const activeRisks: string[] = [];
  if (goal === "vague") activeRisks.push("目标边界不清，直接排计划容易跑偏");
  if (materials === "risky") activeRisks.push("材料可能不适合当前目标，需先校准");
  if (motivation !== "steady") activeRisks.push("近期完成状态不稳，需要降低范围或加强陪伴");
  if (repeatedGaps.length > 0) activeRisks.push(`反复缺口：${repeatedGaps.join("、")}`);
  if (pressure === "high") activeRisks.push("周期临近结束，应优先形成阶段成果");

  return {
    goalClarity: goal,
    materialStatus: materials,
    learnerLevel: level,
    currentStage: stageFromDecision(input, { goal, materials, pressure, level }),
    motivationState: motivation,
    timePressure: pressure,
    recentPattern: {
      completionRate,
      repeatedGaps,
      skippedActivities,
    },
    activeRisks,
  };
}

function makeDecision(
  situation: LearningSituation,
  primaryNeed: LearningNeed,
  recommendedMode: LearningMode,
  nextAction: string,
  reason: string,
  expectedOutcome: string,
  evidencePolicy: EvidencePolicy,
  signalTypes: LearningSignalType[],
  toolCalls: string[],
  confidence = 0.76,
): LearningDecision {
  const canReorder = primaryNeed !== "repair_gap" && primaryNeed !== "spaced_review";
  return {
    situation,
    primaryNeed,
    recommendedMode,
    nextAction,
    reason,
    expectedOutcome,
    evidencePolicy,
    signalTypes,
    tolerance: {
      canReorder,
      reason: canReorder
        ? "当前属于方向或方法选择，短期顺序可调整，重点是靠近阶段目标。"
        : "当前存在验证或复习约束，建议先处理再继续扩展路线。",
    },
    toolCalls,
    confidence,
  };
}

export class RuleLearningDecisionPolicy implements LearningDecisionPolicyPort {
  decideNextMove(input: LearningSituationInput): LearningDecision {
    const situation = buildSituation(input);
    if (situation.goalClarity === "vague") {
      return makeDecision(
        situation,
        "clarify_goal",
        "explain",
        "先把学习目标改写成一句可执行的阶段目标，并说明学完要产出什么。",
        "目标边界不清时直接生成路线，会把用户带进不适合的课程或任务。",
        "用户能说清楚学习主题、阶段成果和当前不确定点。",
        "soft_signal",
        ["soft_signal"],
        ["goalAnalyzer"],
      );
    }
    const blockingReview = (input.materialReviews ?? []).find((review) =>
      review.verdict === "not_recommended" || review.verdict === "supplement"
    );
    if (blockingReview) {
      const need: LearningNeed = blockingReview.verdict === "not_recommended" ? "route_correction" : "review_material";
      return makeDecision(
        situation,
        need,
        "rubric_review",
        blockingReview.verdict === "not_recommended"
          ? "先不要把这份资料当主线，改用更可靠材料或内置内容包校准路线。"
          : "先补齐这份资料缺少的练习、评估标准或项目产出，再进入正式学习计划。",
        blockingReview.rationale,
        "明确这份资料在当前阶段的定位，避免把参考材料误当主线。",
        "soft_signal",
        ["soft_signal"],
        ["materialReviewer", "courseAnalyzer", "capabilityMapper"],
        blockingReview.verdict === "not_recommended" ? 0.86 : 0.78,
      );
    }
    if (situation.materialStatus === "risky" || situation.materialStatus === "unreviewed") {
      return makeDecision(
        situation,
        "review_material",
        "rubric_review",
        "先评估用户已有资料能否作为当前阶段主线，必要时只作为参考材料。",
        "用户资料可能有营销包装、练习不足或与当前水平不匹配，先校准比盲目学习更重要。",
        "得到 core/reference/supplement/not_recommended 的材料定位。",
        "soft_signal",
        ["soft_signal"],
        ["courseAnalyzer", "capabilityMapper"],
      );
    }
    if (situation.motivationState === "blocked" || situation.motivationState === "fragile") {
      return makeDecision(
        situation,
        "motivation_support",
        "guided_practice",
        "把本周范围降到一个 20-45 分钟的低阻力活动，先恢复推进感。",
        "连续未完成时，继续加任务会放大挫败感；先降低范围更有利于长期学习。",
        "用户完成一个小步骤，并留下行为信号用于下周调整。",
        "behavior_signal",
        ["behavior_signal"],
        ["planner", "activityComposer"],
        0.72,
      );
    }
    if (input.latestReviewVerdict === "needs_revision" || (input.missingSignals ?? []).length > 0) {
      return makeDecision(
        situation,
        "repair_gap",
        "rubric_review",
        "围绕缺失能力信号补一轮小任务，再重新提交或复述。",
        "证据已经暴露出具体缺口，继续学习新内容前应先修复关键理解或产出问题。",
        "缺失信号被补齐，学习状态可以继续推进。",
        "hard_evidence",
        ["hard_evidence", "soft_signal"],
        ["evidenceEvaluator", "adjustmentAdvisor"],
        0.84,
      );
    }
    if ((input.dueReviewCount ?? 0) > 0) {
      return makeDecision(
        situation,
        "spaced_review",
        "spaced_review",
        "安排一次短复测或主动回忆，确认已验证能力没有遗忘。",
        "掌握会随时间衰减，间隔复习比继续堆新内容更稳。",
        "完成一次复测，更新掌握状态或暴露遗忘点。",
        "soft_signal",
        ["soft_signal", "behavior_signal"],
        ["planner", "activityComposer"],
      );
    }
    if (situation.timePressure === "high" && (input.recentHardEvidenceCount ?? 0) > 0) {
      return makeDecision(
        situation,
        "package_portfolio",
        "portfolio_packaging",
        "把已有产出整理成阶段成果，说明目标、过程、证据和下一步。",
        "周期临近结束时，阶段定位和成果表达比继续扩展新知识更重要。",
        "形成一个可展示的阶段性学习成果。",
        "hard_evidence",
        ["hard_evidence"],
        ["activityComposer"],
      );
    }
    if (situation.learnerLevel === "newcomer" || situation.learnerLevel === "beginner") {
      return makeDecision(
        situation,
        "build_understanding",
        "feynman",
        "先用自己的话解释一个核心概念，并补一个例子或反例。",
        "小白阶段的关键不是多做任务，而是先建立概念边界和因果理解。",
        "留下可观察的理解信号，而不是只记录完成了阅读。",
        "soft_signal",
        ["soft_signal"],
        ["goalAnalyzer", "activityComposer"],
      );
    }
    if ((input.recentHardEvidenceCount ?? 0) === 0) {
      return makeDecision(
        situation,
        "produce_artifact",
        "project_build",
        "把已学内容压成一个小产出，例如一页分析、一个测试表或一个 demo。",
        "只有学习记录没有产出时，很难证明能力；此时应从理解转向阶段性作品。",
        "产出一个能被评审的 hard evidence。",
        "hard_evidence",
        ["hard_evidence"],
        ["adaptiveRoutePlanner", "activityComposer"],
      );
    }
    return makeDecision(
      situation,
      "practice_skill",
      "independent_practice",
      "继续做一个独立练习，并用评估标准检查完成质量。",
      "当前目标和材料基本可用，且没有高优先级修复项，适合继续推进能力练习。",
      "完成一个可进入证据评审或软信号记录的练习。",
      "hard_evidence",
      ["hard_evidence", "behavior_signal"],
      ["planner", "activityComposer", "evidenceEvaluator"],
      0.7,
    );
  }
}

export default RuleLearningDecisionPolicy;
