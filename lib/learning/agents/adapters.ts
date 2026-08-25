// Full Chain Phase 3：AdaptiveActivityDraft → LearningActivity adapter
// 纯函数、确定性。adaptivePlan.activities（AdaptiveActivityDraft）已含
// LearningActivity 所需的全部内容字段（title/goal/estimatedMinutes/inputRefs/
// steps/expectedEvidence/evaluationCriteria/nextAdvice + capabilityId→nodeId）；
// 本适配器补上服务层运行字段（ownerId/weeklyPlanId/status/isSkipValidation/
// sequence）并生成确定性 id（与服务层 stableId 同算法，刷新不重排）。
// 不改数据库、不改 legacy createActivitiesFromPlanDraft。

import { fnv1a } from "./adaptive-planner.ts";
import type { AdaptiveActivityDraft } from "./adaptive-types.ts";
import type { LearningActivity } from "../domain/types.ts";

export interface AdaptiveActivityContext {
  ownerId: string;
  weeklyPlanId: string;
  /** existing_content 模式下 = capabilityId = content pack nodeId（证据评审依赖） */
  nodeId: string;
  isCore: boolean;
  isSkipValidation?: boolean;
  sequence: number;
  whyNow?: string; // 并入 goal（与 legacy createActivitiesFromPlanDraft 同语义）
}

export function adaptiveDraftToActivity(
  draft: AdaptiveActivityDraft,
  ctx: AdaptiveActivityContext,
): LearningActivity {
  const id = `activity-${fnv1a(
    `${ctx.weeklyPlanId}:${ctx.sequence}:${ctx.nodeId}:${draft.activityType}:${draft.title}`,
  )}`;
  return {
    id,
    ownerId: ctx.ownerId,
    weeklyPlanId: ctx.weeklyPlanId,
    nodeId: ctx.nodeId,
    title: draft.title,
    activityType: draft.activityType,
    goal: `${draft.goal} 原因：${ctx.whyNow ?? ""}`.trim(),
    estimatedMinutes: draft.estimatedMinutes,
    isCore: ctx.isCore,
    status: "planned",
    isSkipValidation: ctx.isSkipValidation ?? false,
    inputRefs: draft.inputRefs,
    steps: draft.steps.join("\n"),
    expectedEvidence: draft.expectedEvidence,
    // AdaptiveActivityDraft.completionCriteria 与 evaluationCriteria 同源，
    // LearningActivity 无 completionCriteria 列，取 evaluationCriteria。
    evaluationCriteria: draft.evaluationCriteria,
    nextAdvice: draft.nextAdvice,
    sequence: ctx.sequence,
  };
}
