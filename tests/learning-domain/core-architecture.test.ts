// 核心架构升级：Kernel / Trace / Memory / Tools / Runtime
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import { TrellisCoreKernel } from "../../lib/learning/architecture/kernel.ts";
import { createDecisionTrace } from "../../lib/learning/architecture/decision-trace.ts";
import { buildLearningMemorySnapshot } from "../../lib/learning/architecture/learning-memory.ts";
import { createTrellisToolRegistry } from "../../lib/learning/architecture/tools.ts";
import { LearningApplicationService } from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { runTrellisMastraWorkflowDemo } from "../../lib/learning/agents/mastra-workflow.ts";

function createService() {
  return new LearningApplicationService(new InMemoryLearningStore(), createRuleAgents());
}

test("TrellisToolRegistry 注册核心 tools 并可列出 manifest", () => {
  const registry = createTrellisToolRegistry(createRuleAgents());
  const tools = registry.list();
  assert.ok(tools.length >= 10);
  assert.ok(tools.some((tool) => tool.id === "assessSituationTool"));
  assert.ok(tools.some((tool) => tool.id === "buildLearningMemoryTool"));
  assert.ok(registry.get("planStagePathTool"));
});

test("TrellisCoreKernel 生成 artifact 与 next stage 结构化决策", () => {
  const kernel = new TrellisCoreKernel(createRuleAgents());
  const artifact = kernel.artifactTaskDecision("kernel-owner");
  assert.equal(artifact.kind, "artifact_task");
  assert.equal(artifact.trace.trigger, "artifact_task");
  assert.ok(artifact.trace.steps.some((step) => step.tool === "generateArtifactTaskTool"));
  const next = kernel.nextStageDecision("kernel-owner");
  assert.equal(next.output.adjustmentType, "route_revision");
  assert.equal(next.trace.decision.requiresConfirmation, true);
});

test("LearningDecisionTrace 统一记录 trigger、signals、HITL 与 stateChanges", () => {
  const trace = createDecisionTrace({
    ownerId: "trace-owner",
    trigger: "next_stage",
    kind: "propose_next_stage",
    summary: "进入作品包装",
    requiresConfirmation: true,
    signals: [{ type: "hard_evidence", label: "作品证据", value: "accepted", weight: "strong" }],
    steps: [{ id: "proposeNextStage", tool: "proposeAdjustmentTool", summary: "提出下一阶段", humanInTheLoop: true }],
    stateChanges: [{ target: "adjustment", action: "proposed", summary: "生成 route_revision" }],
  });
  assert.equal(trace.trigger, "next_stage");
  assert.equal(trace.signals[0]!.type, "hard_evidence");
  assert.equal(trace.steps[0]!.humanInTheLoop, true);
  assert.equal(trace.stateChanges[0]!.target, "adjustment");
});

test("LearningMemorySnapshot 聚合 hard evidence、artifact 和 decision memory", async () => {
  const service = createService();
  const ownerId = "memory-owner";
  await service.runDiagnostic({
    ownerId,
    goal: "我是转 AI PM 的小白，希望完成 AI Agent 产品 PRD",
    weeklyMinutes: 240,
    plannerMode: "adaptive_existing_content",
  });
  await service.confirmProposal(ownerId);
  const ws = await service.createPortfolioArtifactActivity(ownerId);
  const artifact = ws.activities.find((activity) => activity.title.includes("AI Agent 产品 PRD"))!;
  await service.startActivity(ownerId, artifact.id);
  await service.submitEvidence(ownerId, artifact.id, {
    evidenceType: "artifact",
    content:
      "AI Agent 产品 PRD v1：用户场景描述、问题陈述拆解、成功标准定义、方案与需求区分、价值假设说明都清楚。能力清单拆解、输入输出定义、可评测标准、能力边界说明、人工兜底设计完整。评测结果引用、上线回滚判断、用户感知指标、系统指标区分、产品改进建议都可复核。",
  });
  const evidence = (await service.getWorkspace(ownerId)).evidence.find((item) => item.activityId === artifact.id)!;
  await service.reviewEvidence(ownerId, evidence.id);
  await service.confirmMastery(ownerId, artifact.nodeId, { decision: "confirmed" });

  const workspace = await service.getWorkspace(ownerId);
  const memory = buildLearningMemorySnapshot({
    ownerId,
    activities: workspace.activities,
    evidence: workspace.evidence,
    nodeProgress: workspace.nodeProgress,
    adjustments: workspace.adjustments,
  });
  assert.ok(memory.hardEvidenceMemory.length >= 1);
  assert.equal(memory.artifactMemory[0]!.status, "mastery_confirmed");
  assert.ok(memory.decisionMemory.some((item) => item.decisionType === "route_revision"));
});

test("Mastra workflow demo 覆盖完整 artifact-to-next-stage runtime trace", async () => {
  const demo = await runTrellisMastraWorkflowDemo();
  assert.equal(demo.workflowTrace.length, 10);
  assert.deepEqual(demo.workflowTrace.map((step) => step.step).slice(-5), [
    "createArtifactTask",
    "reviewArtifactEvidence",
    "waitForMasteryConfirmation",
    "proposeNextStage",
    "summarizeQuality",
  ]);
  assert.equal(demo.qualitySummary.toolRegistryReady, true);
  assert.equal(demo.stepOutputs.length, 10);
  assert.ok(demo.stepOutputs.every((step) => step.status === "completed"));
  assert.ok(demo.stepOutputs.some((step) => step.outputKeys.includes("stagePath")));
  assert.ok(demo.hitlCheckpoints.some((checkpoint) => checkpoint.checkpointId === "hitl:proposeNextStage"));
  assert.equal(demo.resumeContract.canResumeViaApi, true);
  assert.equal(demo.runtimeReadiness.durableStateOwner, "trellis-application-service");
  assert.equal(demo.runtimeReadiness.productionReady, false);
});
