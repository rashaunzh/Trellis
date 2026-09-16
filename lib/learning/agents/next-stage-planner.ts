import type { AdjustmentRecord, Evidence, LearningActivity } from "../domain/types.ts";

export interface NextStagePlan {
  id: string;
  title: string;
  sourceAdjustmentId: string;
  status: "adopted";
  objective: string;
  durationWeeks: number;
  modules: Array<{
    id: string;
    title: string;
    goal: string;
    outputs: string[];
    rubric: string[];
  }>;
  keyArtifacts: string[];
  evidenceConnection: string;
  traceSummary: string;
}

export interface PortfolioArtifactIteration {
  artifactActivityId: string | null;
  artifactTitle: string;
  currentVersion: string;
  status:
    | "not_started"
    | "draft_needed"
    | "revision_needed"
    | "mastery_confirmation_needed"
    | "next_stage_proposed"
    | "packaging_in_progress";
  latestEvidenceId: string | null;
  latestVerdict: Evidence["status"] | "none";
  revisionCount: number;
  acceptedEvidenceIds: string[];
  missingRubrics: string[];
  versions: Array<{
    version: string;
    evidenceId: string;
    status: Evidence["status"];
    rubricGapCount: number;
    summary: string;
  }>;
  nextAction: string;
  readyForPackaging: boolean;
  traceSummary: string;
}

export function isPortfolioNextStageAdjustment(adjustment: AdjustmentRecord): boolean {
  return adjustment.adjustmentType === "route_revision"
    && adjustment.reason.includes("作品已通过掌握确认");
}

export function buildPortfolioNextStagePlan(adjustment: AdjustmentRecord): NextStagePlan | null {
  if (adjustment.status !== "accepted" || !isPortfolioNextStageAdjustment(adjustment)) return null;
  return {
    id: `next-stage-${adjustment.id}`,
    title: "AI PM 作品集包装阶段",
    sourceAdjustmentId: adjustment.id,
    status: "adopted",
    objective: "把已通过评审的 AI Agent 产品 PRD v1 转成可讲、可评审、可投递的作品集材料。",
    durationWeeks: 2,
    modules: [
      {
        id: "portfolio-package",
        title: "作品包装",
        goal: "把作品从学习产物整理成外部读者能快速理解的项目页。",
        outputs: ["项目 README", "技术亮点说明", "架构图截图点位"],
        rubric: [
          "读者 3 分钟内能看懂用户问题、Trellis 判断链路和最终产出。",
          "明确说明哪些能力来自 Trellis domain engine，哪些由 Mastra workflow 承载。",
          "截图或链接能证明 Learning Situation-first、动态调整和 Evidence Review 闭环存在。",
        ],
      },
      {
        id: "eval-deepening",
        title: "评测深化",
        goal: "补齐 eval 报告、失败样例和质量边界，让作品不只是功能演示。",
        outputs: ["eval report", "质量监控截图", "失败/回退案例说明"],
        rubric: [
          "eval 覆盖处境识别、资料适配、阶段路径、动态调整和作品证据评审。",
          "至少包含一个失败或回退案例，并解释为什么不能直接确认掌握。",
          "指标区分产品质量、学习质量和 runtime fallback 状态。",
        ],
      },
      {
        id: "demo-story",
        title: "项目讲述",
        goal: "形成 10-15 分钟作品集讲法，讲清问题洞察、AI-native 机制和边界。",
        outputs: ["demo script", "面试讲述稿", "下一步路线说明"],
        rubric: [
          "10-15 分钟内能完整讲清问题洞察、核心机制、动态 demo、eval 结果和边界。",
          "讲述能从学习者真实处境出发，而不是从技术名词堆叠出发。",
          "能解释 Trellis 的原创点：动态判断、证据到掌握、人类确认和个性化适配。",
          "能讲清当前边界：不是完整 autonomous agent，也不替代正式学习平台。",
        ],
      },
    ],
    keyArtifacts: ["项目 README", "技术亮点文档", "eval report", "demo script", "面试讲述稿"],
    evidenceConnection: "继承 AI Agent 产品 PRD v1 的 accepted hard evidence 和 mastery confirmation，不清空原阶段证据。",
    traceSummary: "route_revision accepted -> next_stage_adopted -> portfolio packaging plan",
  };
}

export function summarizePortfolioArtifactIteration(input: {
  activities: LearningActivity[];
  evidence: Evidence[];
  adjustments: AdjustmentRecord[];
  nextStagePlan: NextStagePlan | null;
}): PortfolioArtifactIteration {
  const portfolioActivities = input.activities.filter(isPortfolioIterationActivity);
  const artifact = portfolioActivities[0];
  if (!artifact) {
    return {
      artifactActivityId: null,
      artifactTitle: "AI Agent 产品 PRD v1",
      currentVersion: "v1",
      status: "not_started",
      latestEvidenceId: null,
      latestVerdict: "none",
      revisionCount: 0,
      acceptedEvidenceIds: [],
      missingRubrics: [],
      versions: [],
      nextAction: "生成作品任务，把阶段路径落成可评审 hard evidence。",
      readyForPackaging: false,
      traceSummary: "stage_path -> artifact_task_needed",
    };
  }

  const portfolioActivityIds = new Set(portfolioActivities.map((activity) => activity.id));
  const artifactEvidence = input.evidence.filter((item) => portfolioActivityIds.has(item.activityId));
  const latest = artifactEvidence.at(-1);
  const acceptedEvidenceIds = artifactEvidence
    .filter((item) => item.status === "accepted")
    .map((item) => item.id);
  const revisionCount = artifactEvidence.filter((item) => item.status === "needs_revision").length;
  const missingRubrics = artifactEvidence.flatMap((item) => parseMissingRubrics(item.reviewJson));
  const versions = buildArtifactVersions(artifactEvidence);
  const proposedNextStage = input.adjustments.find((adjustment) =>
    isPortfolioNextStageAdjustment(adjustment) && adjustment.status === "proposed"
  );

  if (input.nextStagePlan) {
    return {
      artifactActivityId: artifact.id,
      artifactTitle: artifact.title,
      currentVersion: versionOf(revisionCount),
      status: "packaging_in_progress",
      latestEvidenceId: latest?.id ?? null,
      latestVerdict: latest?.status ?? "none",
      revisionCount,
      acceptedEvidenceIds,
      missingRubrics,
      versions,
      nextAction: "继续完成作品包装、评测深化和项目讲述三个下一阶段活动。",
      readyForPackaging: true,
      traceSummary: "accepted_artifact -> mastery_confirmed -> next_stage_adopted",
    };
  }

  if (proposedNextStage) {
    return {
      artifactActivityId: artifact.id,
      artifactTitle: artifact.title,
      currentVersion: versionOf(revisionCount),
      status: "next_stage_proposed",
      latestEvidenceId: latest?.id ?? null,
      latestVerdict: latest?.status ?? "none",
      revisionCount,
      acceptedEvidenceIds,
      missingRubrics,
      versions,
      nextAction: "采纳下一阶段 route_revision，把作品转成包装、评测深化和 10-15 分钟讲述活动。",
      readyForPackaging: false,
      traceSummary: "accepted_artifact -> mastery_confirmed -> next_stage_proposed",
    };
  }

  if (acceptedEvidenceIds.length > 0) {
    return {
      artifactActivityId: artifact.id,
      artifactTitle: artifact.title,
      currentVersion: versionOf(revisionCount),
      status: "mastery_confirmation_needed",
      latestEvidenceId: latest?.id ?? null,
      latestVerdict: latest?.status ?? "none",
      revisionCount,
      acceptedEvidenceIds,
      missingRubrics,
      versions,
      nextAction: "完成掌握确认；hard evidence accepted 仍不等于系统静默确认掌握。",
      readyForPackaging: false,
      traceSummary: "accepted_artifact -> mastery_confirmation_needed",
    };
  }

  if (latest?.status === "needs_revision") {
    return {
      artifactActivityId: artifact.id,
      artifactTitle: artifact.title,
      currentVersion: versionOf(revisionCount),
      status: "revision_needed",
      latestEvidenceId: latest.id,
      latestVerdict: latest.status,
      revisionCount,
      acceptedEvidenceIds,
      missingRubrics,
      versions,
      nextAction: "按能力信号和 rubric 缺口修订作品，提交下一版证据。",
      readyForPackaging: false,
      traceSummary: "artifact_v1_reviewed -> revision_needed",
    };
  }

  return {
    artifactActivityId: artifact.id,
    artifactTitle: artifact.title,
    currentVersion: "v1",
    status: "draft_needed",
    latestEvidenceId: latest?.id ?? null,
    latestVerdict: latest?.status ?? "none",
    revisionCount,
    acceptedEvidenceIds,
    missingRubrics,
    versions,
    nextAction: "提交 PRD v1 / 案例拆解报告，并附对照 rubric 的自评。",
    readyForPackaging: false,
    traceSummary: "artifact_task_created -> evidence_needed",
  };
}

function buildArtifactVersions(evidence: Evidence[]): PortfolioArtifactIteration["versions"] {
  return evidence.map((item, index) => {
    const rubricGaps = parseMissingRubrics(item.reviewJson);
    return {
      version: `v${index + 1}`,
      evidenceId: item.id,
      status: item.status,
      rubricGapCount: rubricGaps.length,
      summary: summarizeEvidenceVersion(item, rubricGaps.length),
    };
  });
}

function summarizeEvidenceVersion(evidence: Evidence, rubricGapCount: number): string {
  if (evidence.status === "accepted") return "通过 Evidence Review，可进入掌握确认或作品包装。";
  if (evidence.status === "needs_revision") {
    return rubricGapCount > 0
      ? `需修订：仍有 ${rubricGapCount} 个 rubric 缺口。`
      : "需修订：能力信号或证据质量不足。";
  }
  if (evidence.status === "submitted") return "已提交，等待 Evidence Review。";
  return "草稿状态，尚未进入评审。";
}

function versionOf(revisionCount: number): string {
  return `v${Math.max(1, revisionCount + 1)}`;
}

function parseMissingRubrics(reviewJson: string): string[] {
  try {
    const parsed = JSON.parse(reviewJson || "{}") as {
      rubricReviews?: Array<{ criterion?: unknown; status?: unknown }>;
    };
    if (!Array.isArray(parsed.rubricReviews)) return [];
    return parsed.rubricReviews
      .filter((review) => review.status !== "covered" && typeof review.criterion === "string")
      .map((review) => review.criterion as string);
  } catch {
    return [];
  }
}

function isPortfolioIterationActivity(activity: LearningActivity): boolean {
  return activity.activityType === "integrated_task"
    && /作品任务|AI Agent 产品 PRD|案例拆解报告|portfolio|下一阶段|作品包装|评测深化|项目讲述/i.test(
      `${activity.title} ${activity.goal} ${activity.expectedEvidence}`,
    );
}
