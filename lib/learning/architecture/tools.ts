import { z } from "zod";
import type { AgentRegistry, LearningDecision, MaterialReview } from "../agents/types.ts";
import type { AdaptivePlan } from "../agents/adaptive-types.ts";
import type { Evidence, LearningActivity, NodeProgress, AdjustmentRecord } from "../domain/types.ts";
import { planPortfolioStagePath, simulateDynamicSprint, type StagePath } from "../agents/stage-path-planner.ts";
import { buildLearningMemorySnapshot } from "./learning-memory.ts";

export interface TrellisTool<TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  run(input: TInput): Promise<TOutput> | TOutput;
}

const anySchema = z.any();

function tool<TInput, TOutput>(input: TrellisTool<TInput, TOutput>): TrellisTool<TInput, TOutput> {
  return input;
}

export function createTrellisToolRegistry(agents: AgentRegistry) {
  const tools = [
    tool({
      id: "assessSituationTool",
      name: "Assess Situation",
      description: "识别学习处境和 next best move。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof agents.learningDecisionPolicy.decideNextMove>[0]): LearningDecision =>
        agents.learningDecisionPolicy.decideNextMove(input),
    }),
    tool({
      id: "reviewMaterialsTool",
      name: "Review Materials",
      description: "判断资料是否适合当前目标、阶段和用户。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof agents.materialReviewer.reviewMaterials>[0]): MaterialReview[] =>
        agents.materialReviewer.reviewMaterials(input),
    }),
    tool({
      id: "mapCapabilitiesTool",
      name: "Map Capabilities",
      description: "把目标与资料映射成能力图和信号。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof agents.capabilityMapper.mapCapabilities>[0]) =>
        agents.capabilityMapper.mapCapabilities(input),
    }),
    tool({
      id: "planStagePathTool",
      name: "Plan Stage Path",
      description: "生成 AI PM 转型启动阶段完整路径。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof planPortfolioStagePath>[0]): StagePath => planPortfolioStagePath(input),
    }),
    tool({
      id: "simulateDynamicSprintTool",
      name: "Simulate Dynamic Sprint",
      description: "演示前三周动态调整。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof simulateDynamicSprint>[0]) => simulateDynamicSprint(input),
    }),
    tool({
      id: "generateArtifactTaskTool",
      name: "Generate Artifact Task",
      description: "生成作品任务的里程碑、证据要求和评审标准。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: () => ({
        title: "作品任务：AI Agent 产品 PRD v1",
        milestones: ["Week 3 确认作品方向", "Week 5 提交作品 v1"],
        expectedEvidence: "AI Agent 产品 PRD v1 或案例拆解报告 + 评估标准 + 自评。",
      }),
    }),
    tool({
      id: "reviewEvidenceTool",
      name: "Review Evidence",
      description: "评审 hard evidence 是否支持能力掌握。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof agents.evidenceEvaluator.evaluateEvidence>[0]) =>
        agents.evidenceEvaluator.evaluateEvidence(input),
    }),
    tool({
      id: "proposeAdjustmentTool",
      name: "Propose Adjustment",
      description: "根据证据、缺口和行为风险提出调整建议。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: Parameters<typeof agents.adjustmentAdvisor.suggestAdjustment>[0]) =>
        agents.adjustmentAdvisor.suggestAdjustment(input),
    }),
    tool({
      id: "summarizeLearningQualityTool",
      name: "Summarize Learning Quality",
      description: "汇总学习质量指标。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: { activities: LearningActivity[]; evidence: Evidence[] }) => ({
        activityCount: input.activities.length,
        acceptedEvidenceCount: input.evidence.filter((evidence) => evidence.status === "accepted").length,
      }),
    }),
    tool({
      id: "buildLearningMemoryTool",
      name: "Build Learning Memory",
      description: "聚合 hard/soft/behavior/material/artifact/decision memory。",
      inputSchema: anySchema,
      outputSchema: anySchema,
      run: (input: {
        ownerId: string;
        activities: LearningActivity[];
        evidence: Evidence[];
        nodeProgress: NodeProgress[];
        adjustments: AdjustmentRecord[];
        materialReviews?: MaterialReview[];
      }) => buildLearningMemorySnapshot(input),
    }),
  ];
  const byId = new Map(tools.map((item) => [item.id, item]));
  return {
    tools,
    list: () => tools.map(({ id, name, description }) => ({ id, name, description })),
    get: (id: string) => byId.get(id),
    run: async (id: string, input: unknown) => {
      const selected = byId.get(id);
      if (!selected) throw new Error(`Unknown Trellis tool: ${id}`);
      return selected.run(input as never);
    },
  };
}

export type TrellisToolRegistry = ReturnType<typeof createTrellisToolRegistry>;
export type { AdaptivePlan };
