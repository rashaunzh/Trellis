import type { AgentRegistry, LearningAnalysis, MaterialReview } from "../agents/types.ts";
import type { AdjustmentRecord, Evidence, LearningActivity, NodeProgress } from "../domain/types.ts";
import { createDecisionTrace, type LearningDecisionTrace } from "./decision-trace.ts";
import { buildLearningMemorySnapshot, type LearningMemorySnapshot } from "./learning-memory.ts";
import { createTrellisToolRegistry, type TrellisToolRegistry } from "./tools.ts";

export interface KernelDecision<TOutput> {
  decisionId: string;
  kind: string;
  output: TOutput;
  rationale: string;
  confidence: number;
  trace: LearningDecisionTrace;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export class TrellisCoreKernel {
  readonly tools: TrellisToolRegistry;
  private readonly agents: AgentRegistry;

  constructor(agents: AgentRegistry) {
    this.agents = agents;
    this.tools = createTrellisToolRegistry(agents);
  }

  decision<TOutput>(input: {
    ownerId: string;
    kind: string;
    output: TOutput;
    rationale: string;
    confidence?: number;
    trace: LearningDecisionTrace;
  }): KernelDecision<TOutput> {
    return {
      decisionId: `kdec-${stableHash(`${input.ownerId}:${input.kind}:${input.rationale}`)}`,
      kind: input.kind,
      output: input.output,
      rationale: input.rationale,
      confidence: input.confidence ?? 0.75,
      trace: input.trace,
    };
  }

  traceDiagnostic(ownerId: string, analysis: LearningAnalysis): LearningDecisionTrace {
    return createDecisionTrace({
      ownerId,
      trigger: "diagnostic",
      kind: "learning_situation_stage_path",
      summary: analysis.learningDecision.situation.nextBestMove,
      requiresConfirmation: true,
      inputs: [
        { name: "goal", type: "goal", summary: analysis.goalAnalysis.goal },
        { name: "materials", type: "material", summary: `${analysis.materialReviews.length} 份资料` },
      ],
      signals: [
        {
          type: "state_signal",
          label: "nextBestMove",
          value: analysis.learningDecision.situation.nextBestMove,
          weight: "strong",
        },
      ],
      steps: [
        { id: "assessSituation", tool: "assessSituationTool", summary: analysis.learningDecision.reason, humanInTheLoop: false },
        { id: "planStagePath", tool: "planStagePathTool", summary: analysis.stagePath.title, humanInTheLoop: true },
      ],
      stateChanges: [{ target: "profile", action: "proposed", summary: "诊断生成路线提案，等待用户确认。" }],
    });
  }

  artifactTaskDecision(ownerId: string) {
    const output = {
      title: "作品任务：AI Agent 产品 PRD v1",
      milestones: ["Week 3 确认作品方向", "Week 5 提交作品 v1"],
      expectedEvidence: "AI Agent 产品 PRD v1 或案例拆解报告 + 评估标准 + 自评。",
      nextAdvice: "通过 Evidence Review 后进入掌握确认，确认后提出下一阶段建议。",
    };
    return this.decision({
      ownerId,
      kind: "artifact_task",
      output,
      rationale: "阶段路径需要导向 hard evidence 作品，而不是停留在资料输入。",
      trace: createDecisionTrace({
        ownerId,
        trigger: "artifact_task",
        kind: "create_artifact_task",
        summary: output.title,
        requiresConfirmation: true,
        signals: [{ type: "hard_evidence", label: "artifact_required", value: output.expectedEvidence, weight: "strong" }],
        steps: [{ id: "generateArtifactTask", tool: "generateArtifactTaskTool", summary: output.title, humanInTheLoop: true }],
        stateChanges: [{ target: "activity", action: "created", summary: "生成正式作品 integrated_task。" }],
      }),
    });
  }

  nextStageDecision(ownerId: string) {
    const output = {
      adjustmentType: "route_revision" as const,
      reason: "作品已通过掌握确认，可以进入下一阶段路线建议",
      summary: "建议进入 AI PM 作品集下一阶段：作品包装、评测深化和 10-15 分钟项目讲述；保留本阶段证据，围绕面试可讲性补强。",
      actions: [{ action: "continue", description: "进入作品包装、评测深化和项目讲述阶段。" }],
    };
    return this.decision({
      ownerId,
      kind: "next_stage",
      output,
      rationale: "accepted 作品证据和用户掌握确认共同满足进入下一阶段的条件。",
      trace: createDecisionTrace({
        ownerId,
        trigger: "next_stage",
        kind: "propose_next_stage",
        summary: output.summary,
        requiresConfirmation: true,
        signals: [
          { type: "hard_evidence", label: "artifact_evidence", value: "accepted", weight: "strong" },
          { type: "state_signal", label: "mastery_confirmation", value: "confirmed", weight: "blocking" },
        ],
        steps: [{ id: "proposeNextStage", tool: "proposeAdjustmentTool", summary: output.summary, humanInTheLoop: true }],
        stateChanges: [{ target: "adjustment", action: "proposed", summary: "生成下一阶段 route_revision 提案。" }],
      }),
    });
  }

  memory(input: {
    ownerId: string;
    activities: LearningActivity[];
    evidence: Evidence[];
    nodeProgress: NodeProgress[];
    adjustments: AdjustmentRecord[];
    materialReviews?: MaterialReview[];
  }): LearningMemorySnapshot {
    return buildLearningMemorySnapshot(input);
  }
}
