import type {
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
} from "../domain/types.ts";
import type { MaterialReview } from "../agents/types.ts";

export interface LearningMemorySnapshot {
  ownerId: string;
  hardEvidenceMemory: Array<{
    evidenceId: string;
    nodeId: string;
    activityId: string;
    status: Evidence["status"];
    summary: string;
    supportingSignals: string[];
  }>;
  softSignalMemory: Array<{
    source: "self_report" | "reflection" | "confusion" | "note";
    summary: string;
    affectsDecisionOnly: true;
  }>;
  behaviorMemory: Array<{
    signal: "low_completion" | "capacity_drop" | "avoidance" | "restart" | "input_heavy";
    summary: string;
  }>;
  materialMemory: Array<{
    materialId: string;
    verdict: MaterialReview["verdict"];
    reason: string;
  }>;
  artifactMemory: Array<{
    activityId: string;
    artifactType: "prd" | "case_report" | "eval_report" | "demo_script";
    status: "planned" | "submitted" | "accepted" | "needs_revision" | "mastery_confirmed";
    milestone: "week3_direction" | "week5_v1" | "next_stage";
  }>;
  decisionMemory: Array<{
    adjustmentId: string;
    decisionType: AdjustmentRecord["adjustmentType"];
    status: AdjustmentRecord["status"];
    summary: string;
  }>;
}

function isPortfolioArtifactActivity(activity: LearningActivity): boolean {
  return activity.activityType === "integrated_task"
    && /作品任务|AI Agent 产品 PRD|案例拆解报告|portfolio/i.test(
      `${activity.title} ${activity.goal} ${activity.expectedEvidence}`,
    );
}

function signalLabels(evidence: Evidence): string[] {
  try {
    const parsed = JSON.parse(evidence.reviewJson || "{}") as {
      signalReviews?: Array<{ label: string; status: string }>;
    };
    return (parsed.signalReviews ?? [])
      .filter((signal) => signal.status === "covered")
      .map((signal) => signal.label)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export function buildLearningMemorySnapshot(input: {
  ownerId: string;
  activities: LearningActivity[];
  evidence: Evidence[];
  nodeProgress: NodeProgress[];
  adjustments: AdjustmentRecord[];
  materialReviews?: MaterialReview[];
}): LearningMemorySnapshot {
  const evidenceByActivity = new Map<string, Evidence[]>();
  for (const evidence of input.evidence) {
    evidenceByActivity.set(evidence.activityId, [
      ...(evidenceByActivity.get(evidence.activityId) ?? []),
      evidence,
    ]);
  }
  const progressByNode = new Map(input.nodeProgress.map((progress) => [progress.nodeId, progress]));
  const artifactActivities = input.activities.filter(isPortfolioArtifactActivity);
  const completedCount = input.activities.filter((activity) => activity.status === "completed").length;
  const behaviorMemory: LearningMemorySnapshot["behaviorMemory"] = [];
  if (input.activities.length > 0 && completedCount === 0) {
    behaviorMemory.push({ signal: "low_completion", summary: "本周已有活动但尚未完成，下一步应降低粒度或保留核心任务。" });
  }
  if (input.activities.some((activity) => activity.title.includes("作品任务"))) {
    behaviorMemory.push({ signal: "input_heavy", summary: "系统已推动从资料输入转向作品产出。" });
  }
  return {
    ownerId: input.ownerId,
    hardEvidenceMemory: input.evidence
      .filter((evidence) => evidence.status === "accepted")
      .map((evidence) => ({
        evidenceId: evidence.id,
        nodeId: evidence.nodeId,
        activityId: evidence.activityId,
        status: evidence.status,
        summary: evidence.feedback || evidence.content.slice(0, 90),
        supportingSignals: signalLabels(evidence),
      })),
    softSignalMemory: input.nodeProgress
      .filter((progress) => progress.status === "growing")
      .slice(0, 5)
      .map((progress) => ({
        source: "self_report",
        summary: `节点 ${progress.nodeId} 仍在成长中，只能影响下一步决策，不能直接验证掌握。`,
        affectsDecisionOnly: true,
      })),
    behaviorMemory,
    materialMemory: (input.materialReviews ?? []).map((review) => ({
      materialId: review.materialId,
      verdict: review.verdict,
      reason: review.rationale,
    })),
    artifactMemory: artifactActivities.map((activity) => {
      const evidence = evidenceByActivity.get(activity.id) ?? [];
      const accepted = evidence.some((item) => item.status === "accepted");
      const needsRevision = evidence.some((item) => item.status === "needs_revision");
      const progress = progressByNode.get(activity.nodeId);
      return {
        activityId: activity.id,
        artifactType: "prd",
        status: progress?.confirmedAt
          ? "mastery_confirmed"
          : accepted
            ? "accepted"
            : needsRevision
              ? "needs_revision"
              : evidence.length > 0
                ? "submitted"
                : "planned",
        milestone: accepted ? "week5_v1" : "week3_direction",
      };
    }),
    decisionMemory: input.adjustments.map((adjustment) => ({
      adjustmentId: adjustment.id,
      decisionType: adjustment.adjustmentType,
      status: adjustment.status,
      summary: adjustment.summary,
    })),
  };
}
