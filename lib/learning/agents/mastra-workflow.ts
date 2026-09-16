// Mastra workflow 集成。
// 这里把现有 Trellis 规则引擎包装成 Mastra steps；产品逻辑仍在 domain/agents，
// Mastra 负责作品级可视化 workflow、step 边界与后续 HITL/observability 接入。

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Mastra } from "@mastra/core/mastra";
import { z } from "zod";
import { RuleAdaptiveRoutePlanner } from "./adaptive-planner.ts";
import RuleCapabilityMapper from "./capability-mapper.ts";
import RuleCourseMaterialAnalyzer from "./course-analyzer.ts";
import RuleGoalAnalyzer from "./goal-analyzer.ts";
import RuleLearningDecisionPolicy from "./learning-decision-policy.ts";
import RuleMaterialReviewer from "./material-reviewer.ts";
import { planPortfolioStagePath, simulateDynamicSprint } from "./stage-path-planner.ts";

const workflowPayloadSchema = z.object({
  goal: z.string(),
  weeklyMinutes: z.number().default(240),
  materialIds: z.array(z.string()).default([]),
  selfReport: z.record(z.string(), z.number()).default({}),
  preference: z.enum(["breadth_first", "build_first"]).default("breadth_first"),
  goalAnalysis: z.any().optional(),
  courseMaterials: z.any().optional(),
  materialReviews: z.any().optional(),
  capabilityMap: z.any().optional(),
  adaptivePlan: z.any().optional(),
  learningDecision: z.any().optional(),
  stagePath: z.any().optional(),
  dynamicSimulation: z.any().optional(),
  artifactTask: z.any().optional(),
  evidenceReview: z.any().optional(),
  masteryConfirmation: z.any().optional(),
  nextStageProposal: z.any().optional(),
  qualitySummary: z.any().optional(),
  workflowTrace: z.array(z.object({
    step: z.string(),
    summary: z.string(),
    humanInTheLoop: z.boolean(),
  })).default([]),
});

export type WorkflowPayload = z.infer<typeof workflowPayloadSchema>;

const goalAnalyzer = new RuleGoalAnalyzer();
const courseAnalyzer = new RuleCourseMaterialAnalyzer();
const materialReviewer = new RuleMaterialReviewer();
const capabilityMapper = new RuleCapabilityMapper();
const adaptiveRoutePlanner = new RuleAdaptiveRoutePlanner();
const decisionPolicy = new RuleLearningDecisionPolicy();

function appendTrace(
  payload: WorkflowPayload,
  step: string,
  summary: string,
  humanInTheLoop = false,
): WorkflowPayload {
  return {
    ...payload,
    workflowTrace: [...payload.workflowTrace, { step, summary, humanInTheLoop }],
  };
}

const assessSituation = createStep({
  id: "assessSituation",
  description: "先识别 Learning Situation，而不是直接从 goal 排计划。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => {
    const goalAnalysis = goalAnalyzer.analyzeGoal({
      goal: inputData.goal,
      preference: inputData.preference,
      selfReport: inputData.selfReport,
    });
    return appendTrace(
      { ...inputData, goalAnalysis },
      "assessSituation",
      `目标初步解析为 ${goalAnalysis.domain ?? "未知领域"} / depth=${goalAnalysis.depth ?? 2}`,
    );
  },
});

const auditMaterials = createStep({
  id: "auditMaterials",
  description: "审计资料是否适合当前用户、目标、阶段和时间窗口。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => {
    const courseMaterials = courseAnalyzer.analyzeMaterials({
      goalAnalysis: inputData.goalAnalysis,
      materialIds: inputData.materialIds,
    });
    const materialReviews = materialReviewer.reviewMaterials({
      goalAnalysis: inputData.goalAnalysis,
      materials: courseMaterials,
      weeksRemaining: 8,
    });
    return appendTrace(
      { ...inputData, courseMaterials, materialReviews },
      "auditMaterials",
      `${materialReviews.length} 份资料完成 Learning Fit 判断`,
    );
  },
});

const mapCapabilities = createStep({
  id: "mapCapabilities",
  description: "把目标和资料映射到能力图与能力信号。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => {
    const capabilityMap = capabilityMapper.mapCapabilities({
      goalAnalysis: inputData.goalAnalysis,
      materials: inputData.courseMaterials,
    });
    const targetCapabilityIds = (capabilityMap.matchedContent ?? []).map((item: { nodeId: string }) => item.nodeId);
    const goalAnalysis = { ...inputData.goalAnalysis, targetCapabilityIds };
    return appendTrace(
      { ...inputData, goalAnalysis, capabilityMap },
      "mapCapabilities",
      `${capabilityMap.strategy ?? capabilityMap.source} 能力图，${capabilityMap.capabilities.length} 个能力`,
    );
  },
});

const planStagePath = createStep({
  id: "planStagePath",
  description: "规划 AI PM 转型启动阶段完整 6-8 周路径。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => {
    const adaptivePlan = adaptiveRoutePlanner.plan({
      goalAnalysis: inputData.goalAnalysis,
      capabilityMap: inputData.capabilityMap,
      weeklyMinutes: inputData.weeklyMinutes,
      preference: inputData.preference,
      selfReport: inputData.selfReport,
      materials: inputData.courseMaterials,
    });
    const learningDecision = decisionPolicy.decideNextMove({
      goalText: inputData.goal,
      goalAnalysis: inputData.goalAnalysis,
      courseMaterials: inputData.courseMaterials,
      materialReviews: inputData.materialReviews,
      capabilityMap: inputData.capabilityMap,
      hasRoute: true,
      hasActiveActivities: adaptivePlan.weeklyPlan.activities.length > 0,
      weeksRemaining: 8,
      capabilityLevelById: inputData.selfReport,
    });
    const stagePath = planPortfolioStagePath({
      goal: inputData.goal,
      situation: learningDecision.situation,
      decision: learningDecision,
      adaptivePlan,
      materialReviews: inputData.materialReviews,
    });
    return appendTrace(
      { ...inputData, adaptivePlan, learningDecision, stagePath },
      "planStagePath",
      `${stagePath.durationWeeks} 周阶段路径，最终成果：${stagePath.finalArtifact}`,
      true,
    );
  },
});

const simulateDynamicAdjustment = createStep({
  id: "simulateDynamicAdjustment",
  description: "演示前三周内目标、资料、容量、精力和证据变化如何调整计划。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => {
    const dynamicSimulation = simulateDynamicSprint({
      stagePath: inputData.stagePath,
      situation: inputData.learningDecision.situation,
      decision: inputData.learningDecision,
      adaptivePlan: inputData.adaptivePlan,
      materialReviews: inputData.materialReviews,
    });
    return appendTrace(
      { ...inputData, dynamicSimulation },
      "simulateDynamicAdjustment",
      `${dynamicSimulation.adjustments.length} 次动态调整，含 HITL 关键确认点`,
      true,
    );
  },
});

const createArtifactTask = createStep({
  id: "createArtifactTask",
  description: "把 StagePath 作品目标落成可评审 artifact task。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => appendTrace(
    {
      ...inputData,
      artifactTask: {
        title: "作品任务：AI Agent 产品 PRD v1",
        milestones: ["Week 3 确认作品方向", "Week 5 提交作品 v1"],
        expectedEvidence: "PRD v1 / 案例拆解报告 + 评估标准 + 自评",
      },
    },
    "createArtifactTask",
    "生成 AI Agent 产品 PRD v1 作品任务，绑定 Week 3/5 里程碑",
    true,
  ),
});

const reviewArtifactEvidence = createStep({
  id: "reviewArtifactEvidence",
  description: "模拟作品 hard evidence 评审。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => appendTrace(
    {
      ...inputData,
      evidenceReview: {
        verdict: "accepted",
        coveredSignals: ["用户场景描述", "能力边界说明", "评测结果引用", "人工兜底设计"],
      },
    },
    "reviewArtifactEvidence",
    "作品证据覆盖关键 AI PM 能力信号，进入掌握确认",
    false,
  ),
});

const waitForMasteryConfirmation = createStep({
  id: "waitForMasteryConfirmation",
  description: "作品通过后仍需用户确认掌握。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => appendTrace(
    { ...inputData, masteryConfirmation: { status: "pending_confirmation", required: true } },
    "waitForMasteryConfirmation",
    "hard evidence accepted 不等于自动掌握，需要用户确认",
    true,
  ),
});

const proposeNextStage = createStep({
  id: "proposeNextStage",
  description: "掌握确认后提出下一阶段路线建议。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => appendTrace(
    {
      ...inputData,
      nextStageProposal: {
        adjustmentType: "route_revision",
        status: "proposed",
        summary: "作品包装、评测深化和 10-15 分钟项目讲述",
      },
    },
    "proposeNextStage",
    "生成下一阶段 route_revision proposed，等待用户采纳",
    true,
  ),
});

const summarizeQuality = createStep({
  id: "summarizeQuality",
  description: "输出质量、memory、tool、workflow readiness 摘要。",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
  execute: async ({ inputData }) => appendTrace(
    {
      ...inputData,
      qualitySummary: {
        traceCompleteness: 1,
        memoryCompleteness: 0.8,
        toolRegistryReady: true,
        workflowRuntimeReady: true,
        fallbackMode: "rule",
      },
    },
    "summarizeQuality",
    "汇总 eval / monitor / memory / tool / workflow readiness",
  ),
});

export const trellisLearningSituationWorkflow = createWorkflow({
  id: "trellis-learning-situation-workflow",
  description: "Trellis 作品级 Learning Situation-first Mastra workflow",
  inputSchema: workflowPayloadSchema,
  outputSchema: workflowPayloadSchema,
})
  .then(assessSituation)
  .then(auditMaterials)
  .then(mapCapabilities)
  .then(planStagePath)
  .then(simulateDynamicAdjustment)
  .then(createArtifactTask)
  .then(reviewArtifactEvidence)
  .then(waitForMasteryConfirmation)
  .then(proposeNextStage)
  .then(summarizeQuality)
  .commit();

export const trellisMastraRuntime = new Mastra({
  logger: false,
  workflows: {
    trellisLearningSituationWorkflow,
  },
});

export const trellisPortfolioDemoInput: WorkflowPayload = {
  goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
  weeklyMinutes: 240,
  materialIds: ["res.gml-crash-course"],
  selfReport: {},
  preference: "breadth_first",
  workflowTrace: [],
};

const stepOutputKeys: Record<string, string[]> = {
  assessSituation: ["goalAnalysis"],
  auditMaterials: ["courseMaterials", "materialReviews"],
  mapCapabilities: ["capabilityMap", "goalAnalysis.targetCapabilityIds"],
  planStagePath: ["adaptivePlan", "learningDecision", "stagePath"],
  simulateDynamicAdjustment: ["dynamicSimulation"],
  createArtifactTask: ["artifactTask"],
  reviewArtifactEvidence: ["evidenceReview"],
  waitForMasteryConfirmation: ["masteryConfirmation"],
  proposeNextStage: ["nextStageProposal"],
  summarizeQuality: ["qualitySummary"],
};

const hitlDecisionByStep: Record<string, string> = {
  planStagePath: "确认阶段路径、作品目标与主线取舍。",
  simulateDynamicAdjustment: "确认资料错配、容量下降或证据失败时的路径调整。",
  createArtifactTask: "确认 AI Agent 产品 PRD v1 是否进入正式活动链。",
  waitForMasteryConfirmation: "确认 hard evidence accepted 是否真的代表掌握。",
  proposeNextStage: "确认是否采纳作品包装、评测深化和项目讲述的下一阶段路线。",
};

function buildRuntimeReadiness(stepCount: number, hitlCount: number) {
  return {
    runtimeTarget: "mastra" as const,
    executable: true,
    observable: true,
    stepCount,
    hitlCount,
    deterministicDemo: true,
    fallbackMode: "rule" as const,
    durableStateOwner: "trellis-application-service" as const,
    persistenceScope: "workflow report + Trellis state writes" as const,
    productionReady: false,
    productionGaps: [
      "Mastra run snapshot 尚未持久化到数据库。",
      "HITL resume 目前通过 Trellis API 状态机承载，不是 Mastra 原生长任务恢复。",
      "Studio 截图是作品集证据，自动验收仍以 API 和 browser acceptance 为准。",
    ],
  };
}

export async function runTrellisMastraWorkflowDemo(input: WorkflowPayload = trellisPortfolioDemoInput) {
  const workflow = trellisMastraRuntime.getWorkflow("trellisLearningSituationWorkflow");
  const run = await workflow.createRun({
    runId: "trellis-portfolio-demo",
    resourceId: "portfolio-demo",
    disableScorers: true,
  });
  const result = await run.start({ inputData: input });
  if (result.status !== "success" || !result.result) {
    throw new Error(`Trellis Mastra workflow demo failed: ${result.status}`);
  }
  const workflowTrace = result.result.workflowTrace;
  const hitlSteps = workflowTrace.filter((step) => step.humanInTheLoop);
  return {
    runId: run.runId,
    status: result.status,
    traceId: result.traceId,
    workflowTrace,
    stepOutputs: workflowTrace.map((step, index) => ({
      index: index + 1,
      step: step.step,
      status: "completed" as const,
      humanInTheLoop: step.humanInTheLoop,
      summary: step.summary,
      outputKeys: stepOutputKeys[step.step] ?? [],
    })),
    hitlSteps,
    hitlCheckpoints: hitlSteps.map((step) => ({
      checkpointId: `hitl:${step.step}`,
      step: step.step,
      decisionRequired: hitlDecisionByStep[step.step] ?? "需要用户确认后才能写入正式学习状态。",
      stateWritePolicy: "proposal_then_confirm" as const,
      resumeAction: step.step === "waitForMasteryConfirmation"
        ? "POST /api/learning/nodes/:nodeId/confirm-mastery"
        : "POST /api/learning/adjustments/:adjustmentId/confirm",
    })),
    resumeContract: {
      mode: "trellis_state_machine" as const,
      canReplayDeterministically: true,
      canResumeViaApi: true,
      resumeRequiresUserConfirmation: true,
      stateOwner: "LearningApplicationService" as const,
      supportedResumeActions: [
        "confirm stage path proposal",
        "create artifact task",
        "confirm mastery",
        "accept or reject next-stage route_revision",
      ],
    },
    runtimeReadiness: buildRuntimeReadiness(workflowTrace.length, hitlSteps.length),
    stagePath: {
      title: result.result.stagePath.title,
      durationWeeks: result.result.stagePath.durationWeeks,
      finalArtifact: result.result.stagePath.finalArtifact,
      milestones: result.result.stagePath.milestones,
    },
    dynamicSimulation: {
      title: result.result.dynamicSimulation.title,
      adjustments: result.result.dynamicSimulation.adjustments,
    },
    artifactTask: result.result.artifactTask,
    evidenceReview: result.result.evidenceReview,
    masteryConfirmation: result.result.masteryConfirmation,
    nextStageProposal: result.result.nextStageProposal,
    qualitySummary: result.result.qualitySummary,
    fallbackMode: "rule",
  };
}

export type TrellisMastraRuntimeReport = Awaited<ReturnType<typeof runTrellisMastraWorkflowDemo>>;

export interface TrellisWorkflowStepSpec {
  id: string;
  tool: string;
  description: string;
  humanInTheLoop: boolean;
  fallback: string;
}

export interface TrellisWorkflowSpec {
  id: string;
  name: string;
  runtimeTarget: "mastra";
  steps: TrellisWorkflowStepSpec[];
  studioExpectation: string;
}

export const trellisMastraWorkflowSpec: TrellisWorkflowSpec = {
  id: "trellis-learning-situation-workflow",
  name: "Trellis Learning Situation Workflow",
  runtimeTarget: "mastra",
  steps: [
    {
      id: "assessSituation",
      tool: "learningDecisionPolicy",
      description: "识别目标、资料、容量、精力、行为、证据质量形成 LearningSituation。",
      humanInTheLoop: false,
      fallback: "规则版 LearningDecisionPolicy",
    },
    {
      id: "auditMaterials",
      tool: "materialReviewer",
      description: "判断资料是否适合当前用户、目标、阶段和时间窗口。",
      humanInTheLoop: false,
      fallback: "规则版 MaterialReviewer",
    },
    {
      id: "mapCapabilities",
      tool: "capabilityMapper",
      description: "把目标和资料映射到能力图与能力信号。",
      humanInTheLoop: false,
      fallback: "内容包投影或 generic preview，不进入正式闭环",
    },
    {
      id: "planStagePath",
      tool: "stagePathPlanner",
      description: "生成 AI PM 转型启动阶段 6-8 周路径。",
      humanInTheLoop: true,
      fallback: "规则版 StagePath",
    },
    {
      id: "simulateDynamicAdjustment",
      tool: "simulateDynamicSprintTool",
      description: "演示前三周动态调整。",
      humanInTheLoop: true,
      fallback: "legacy planner 或规则版 adaptive planner",
    },
    {
      id: "createArtifactTask",
      tool: "generateArtifactTaskTool",
      description: "把阶段作品目标落成可评审作品任务。",
      humanInTheLoop: true,
      fallback: "规则版 Artifact Task",
    },
    {
      id: "reviewArtifactEvidence",
      tool: "reviewEvidenceTool",
      description: "评审作品 hard evidence。",
      humanInTheLoop: false,
      fallback: "规则版 EvidenceEvaluator",
    },
    {
      id: "waitForMasteryConfirmation",
      tool: "masteryConfirmation",
      description: "作品证据通过后等待用户确认掌握。",
      humanInTheLoop: true,
      fallback: "Trellis 状态机 pending_confirmation",
    },
    {
      id: "proposeNextStage",
      tool: "proposeAdjustmentTool",
      description: "掌握确认后提出下一阶段路线建议。",
      humanInTheLoop: true,
      fallback: "规则版 AdjustmentAdvisor",
    },
    {
      id: "summarizeQuality",
      tool: "summarizeLearningQualityTool",
      description: "汇总质量、memory、tool、workflow readiness。",
      humanInTheLoop: false,
      fallback: "规则版 Quality Monitor",
    },
  ],
  studioExpectation: "Mastra Studio 应展示上述顺序、分支、HITL 节点和每步结构化输出。",
};
