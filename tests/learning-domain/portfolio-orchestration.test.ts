// 作品级编排测试：Learning Situation-first → StagePath → Dynamic Simulation → Eval
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import {
  planPortfolioStagePath,
  simulateDynamicSprint,
} from "../../lib/learning/agents/stage-path-planner.ts";
import {
  evaluatePortfolioReadiness,
  summarizeLearningQuality,
} from "../../lib/learning/agents/learning-quality.ts";
import {
  runTrellisMastraWorkflowDemo,
  trellisLearningSituationWorkflow,
  trellisMastraWorkflowSpec,
  trellisMastraRuntime,
} from "../../lib/learning/agents/mastra-workflow.ts";
import { mastra as studioMastra } from "../../src/mastra/index.ts";
import { LearningApplicationService } from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";

function createService() {
  return new LearningApplicationService(new InMemoryLearningStore(), createRuleAgents());
}

test("LearningSituation 识别容量、精力、行为和证据质量", () => {
  const decision = createRuleAgents().learningDecisionPolicy.decideNextMove({
    goalText: "系统学习 AIPM，并在 8 周内做一个 AI Agent 产品 PRD",
    dailyCapacitySignals: [
      { day: "Mon", availableMinutes: 20, energy: "depleted" },
      { day: "Tue", availableMinutes: 15, energy: "low" },
    ],
    behaviorNotes: ["最近拖延，连续两天没动"],
    recentSoftSignalCount: 3,
    recentHardEvidenceCount: 0,
    completionRate: 0.1,
    skippedActivities: 2,
  });
  assert.equal(decision.situation.capacityState, "critical");
  assert.equal(decision.situation.energyState, "depleted");
  assert.equal(decision.situation.behaviorPattern, "avoidant");
  assert.equal(decision.situation.evidenceQuality, "soft_only");
  assert.equal(decision.primaryNeed, "motivation_support");
  assert.ok(decision.situation.activeRisks.some((risk) => risk.includes("时间")));
});

test("runDiagnostic 返回完整阶段路径与动态模拟", async () => {
  const service = createService();
  const workspace = await service.runDiagnostic({
    ownerId: "portfolio-owner-1",
    goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.gml-crash-course"],
    plannerMode: "adaptive_existing_content",
  });
  const analysis = workspace.analysis!;
  assert.ok(analysis.stagePath, "应返回作品级阶段路径");
  assert.equal(analysis.stagePath.durationWeeks, 8);
  assert.equal(analysis.stagePath.targetLearner, "AI PM 转型小白");
  assert.ok(analysis.stagePath.weeks.length >= 6);
  assert.ok(analysis.stagePath.finalArtifact.includes("PRD") || analysis.stagePath.finalArtifact.includes("报告"));
  assert.ok(analysis.dynamicSimulation.adjustments.length >= 4);
  assert.ok(analysis.dynamicSimulation.trace.some((step) => step.tool === "stagePathPlanner"));
});

test("StagePath 与 DynamicSprintSimulation 对同一输入确定性", async () => {
  const service = createService();
  const workspace = await service.runDiagnostic({
    ownerId: "portfolio-owner-2",
    goal: "系统学习 AIPM 并完成作品集案例",
    weeklyMinutes: 180,
    materialIds: ["res.gml-crash-course"],
    plannerMode: "adaptive_existing_content",
  });
  const analysis = workspace.analysis!;
  const a = planPortfolioStagePath({
    goal: analysis.goalAnalysis.goal,
    situation: analysis.learningDecision.situation,
    decision: analysis.learningDecision,
    adaptivePlan: analysis.adaptivePlan,
    materialReviews: analysis.materialReviews,
  });
  const b = planPortfolioStagePath({
    goal: analysis.goalAnalysis.goal,
    situation: analysis.learningDecision.situation,
    decision: analysis.learningDecision,
    adaptivePlan: analysis.adaptivePlan,
    materialReviews: analysis.materialReviews,
  });
  assert.deepEqual(a, b);
  assert.deepEqual(
    simulateDynamicSprint({
      stagePath: a,
      situation: analysis.learningDecision.situation,
      decision: analysis.learningDecision,
      adaptivePlan: analysis.adaptivePlan,
      materialReviews: analysis.materialReviews,
    }),
    simulateDynamicSprint({
      stagePath: b,
      situation: analysis.learningDecision.situation,
      decision: analysis.learningDecision,
      adaptivePlan: analysis.adaptivePlan,
      materialReviews: analysis.materialReviews,
    }),
  );
});

test("作品级 eval suite 覆盖 situation、资料、路径、动态调整和作品闭环", async () => {
  const service = createService();
  const workspace = await service.runDiagnostic({
    ownerId: "portfolio-owner-3",
    goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.gml-crash-course"],
    plannerMode: "adaptive_existing_content",
  });
  const analysis = workspace.analysis!;
  const report = evaluatePortfolioReadiness({
    analysis,
    stagePath: analysis.stagePath,
    simulation: analysis.dynamicSimulation,
  });
  assert.ok(report.total >= 10);
  assert.ok(report.results.some((result) => result.id === "artifact_revision_loop"));
  assert.ok(report.results.some((result) => result.id === "rubric_guardrail"));
  assert.equal(report.passed, report.total);
  assert.equal(report.passRate, 1);
  assert.ok(report.avgScore >= 0.8);
});

test("Learning Quality Monitor 汇总计划、证据、资料错配和 fallback", () => {
  const quality = summarizeLearningQuality({
    weeklyPlan: {
      id: "plan-1",
      ownerId: "owner",
      routeId: "ai-literacy",
      weekKey: "2026-W35",
      capacityMinutes: 180,
      status: "confirmed",
      rationale: "test",
    },
    activities: [
      {
        id: "activity-1",
        ownerId: "owner",
        weeklyPlanId: "plan-1",
        nodeId: "ai-literacy.mechanism",
        title: "建立模型",
        activityType: "build_model",
        goal: "test",
        estimatedMinutes: 45,
        isCore: true,
        status: "completed",
        isSkipValidation: false,
        inputRefs: [],
        steps: "step",
        expectedEvidence: "evidence",
        evaluationCriteria: "criteria",
        nextAdvice: "next",
        sequence: 0,
      },
    ],
    evidence: [
      {
        id: "ev-1",
        ownerId: "owner",
        activityId: "activity-1",
        nodeId: "ai-literacy.mechanism",
        evidenceType: "explanation",
        content: "test",
        externalUrl: "",
        status: "accepted",
        feedback: "",
        extractedJson: "{}",
        reviewJson: "{}",
      },
      {
        id: "ev-2",
        ownerId: "owner",
        activityId: "activity-1",
        nodeId: "ai-literacy.mechanism",
        evidenceType: "notes",
        content: "test",
        externalUrl: "",
        status: "needs_revision",
        feedback: "",
        extractedJson: "{}",
        reviewJson: "{}",
      },
    ],
    nodeProgress: [],
    materialReviews: [{
      materialId: "m1",
      title: "概念课",
      verdict: "supplement",
      qualityScore: 50,
      personalFitScore: 45,
      scores: {
        sourceCredibility: 60,
        structureClarity: 60,
        practiceDensity: 20,
        assessmentClarity: 20,
        projectRelevance: 20,
        freshness: 60,
        marketingRisk: 20,
        beginnerFit: 70,
        goalFit: 50,
        timeFit: 40,
      },
      strengths: [],
      risks: [],
      missingAreas: ["缺少练习"],
      rationale: "可用但需要补充",
    }],
    fallbackMode: true,
  });
  assert.equal(quality.planCompletionRate, 1);
  assert.equal(quality.evidencePassRate, 0.5);
  assert.equal(quality.materialMismatchCount, 1);
  assert.equal(quality.repeatedGapCount, 1);
  assert.equal(quality.fallbackMode, true);
  assert.equal(quality.artifactIterationStatus, "not_started");
  assert.equal(quality.artifactRevisionCount, 1);
  assert.ok(quality.suggestions.length >= 2);
});

test("Mastra workflow 已注册作品级学习处境主链路", () => {
  assert.equal(trellisLearningSituationWorkflow.id, "trellis-learning-situation-workflow");
  assert.equal(trellisMastraWorkflowSpec.runtimeTarget, "mastra");
  assert.equal(
    trellisMastraRuntime.getWorkflow("trellisLearningSituationWorkflow").id,
    "trellis-learning-situation-workflow",
  );
  assert.equal(
    studioMastra.getWorkflow("trellisLearningSituationWorkflow").id,
    "trellis-learning-situation-workflow",
  );
  assert.ok(trellisMastraWorkflowSpec.steps.some((step) => step.id === "assessSituation"));
  assert.ok(trellisMastraWorkflowSpec.steps.some((step) => step.humanInTheLoop));
});

test("Mastra workflow demo 可运行并输出固定 trace", async () => {
  const demo = await runTrellisMastraWorkflowDemo();
  assert.equal(demo.status, "success");
  assert.deepEqual(demo.workflowTrace.map((step) => step.step), [
    "assessSituation",
    "auditMaterials",
    "mapCapabilities",
    "planStagePath",
    "simulateDynamicAdjustment",
    "createArtifactTask",
    "reviewArtifactEvidence",
    "waitForMasteryConfirmation",
    "proposeNextStage",
    "summarizeQuality",
  ]);
  assert.equal(demo.stagePath.durationWeeks, 8);
  assert.equal(demo.dynamicSimulation.adjustments.length, 4);
  assert.equal(demo.artifactTask.title, "作品任务：AI Agent 产品 PRD v1");
  assert.equal(demo.nextStageProposal.status, "proposed");
  assert.ok(demo.hitlSteps.length >= 2);
  assert.equal(demo.fallbackMode, "rule");
  assert.equal(demo.stepOutputs.length, demo.workflowTrace.length);
  assert.ok(demo.hitlCheckpoints.every((checkpoint) => checkpoint.stateWritePolicy === "proposal_then_confirm"));
  assert.ok(demo.hitlCheckpoints.some((checkpoint) =>
    checkpoint.resumeAction.includes("confirm-mastery")
  ));
  assert.deepEqual(demo.resumeContract.supportedResumeActions.slice(-2), [
    "confirm mastery",
    "accept or reject next-stage route_revision",
  ]);
  assert.equal(demo.runtimeReadiness.executable, true);
  assert.equal(demo.runtimeReadiness.observable, true);
});

test("Portfolio Artifact Loop 生成作品任务并走证据评审到掌握确认", async () => {
  const service = createService();
  const ownerId = "portfolio-artifact-owner-1";
  await service.runDiagnostic({
    ownerId,
    goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.openai-evals"],
    plannerMode: "adaptive_existing_content",
  });
  await service.confirmProposal(ownerId);

  const workspace = await service.createPortfolioArtifactActivity(ownerId);
  assert.equal(workspace.artifactIteration.status, "draft_needed");
  const artifact = workspace.activities.find((activity) =>
    activity.activityType === "integrated_task" && activity.title.includes("AI Agent 产品 PRD"),
  );
  assert.ok(artifact, "应生成正式作品 integrated_task");
  assert.equal(artifact!.isCore, true);
  assert.ok(artifact!.expectedEvidence.includes("评估标准"));
  assert.ok(artifact!.steps.includes("Week 3"));
  assert.ok(artifact!.nextAdvice.includes("Week 3/5"));
  assert.ok(artifact!.nextAdvice.includes("掌握确认"));

  await service.startActivity(ownerId, artifact!.id);
  await service.submitEvidence(ownerId, artifact!.id, {
    evidenceType: "artifact",
    content:
      "AI Agent 产品 PRD v1：用户场景描述是一位 AI PM 转型小白在三周内需要完成可评审作品，但容易把学习停在资料收集。问题陈述拆解为目标模糊、资料错配、时间容量变化和证据不足。成功标准定义为能输出 PRD、案例拆解和评测方案，并被第三方复核。方案与需求区分：需求是动态学习适配，方案才是 Trellis 工作流。价值假设说明：通过 Learning Situation-first 判断，用户能更早发现风险。能力清单拆解包括处境识别、资料评估、阶段路径、动态调整和证据评审。输入输出定义包括学习目标、资料、时间精力信号、行为信号、作品证据，输出 next best move、active risks、stage path 和调整记录。可评测标准包括计划完成率、证据通过率、资料错配次数和评审置信度。能力边界说明：soft signal 只影响下一步决策，不能直接 validated。人工兜底设计：主路径变化、作品方向确认、掌握确认需要用户确认。评测结果引用使用 eval suite 的 situation、material fit、stage path、dynamic adjustment、artifact loop 五项。上线回滚判断：证据失败或能力边界不清时不确认掌握。用户感知指标是学习者是否知道下一步做什么，系统指标区分为评审覆盖率和 fallback 状态。产品改进建议是下一步把作品反馈沉入下一阶段路线。",
  });
  const evidence = (await service.getWorkspace(ownerId)).evidence.find((item) => item.activityId === artifact!.id);
  assert.ok(evidence, "应保存作品证据");

  const reviewed = await service.reviewEvidence(ownerId, evidence!.id);
  const progress = reviewed.workspace.nodeProgress.find((item) => item.nodeId === artifact!.nodeId);
  assert.equal(reviewed.assessment.verdict, "accepted");
  assert.equal(progress?.status, "pending_confirmation", "作品通过后仍需用户掌握确认");

  const confirmed = await service.confirmMastery(ownerId, artifact!.nodeId, { decision: "confirmed" });
  const nextStage = confirmed.adjustments.find((adjustment) =>
    adjustment.adjustmentType === "route_revision"
    && adjustment.status === "proposed"
    && adjustment.reason.includes("作品已通过掌握确认"),
  );
  assert.ok(nextStage, "确认作品掌握后应生成下一阶段路线建议");
  assert.ok(nextStage!.summary.includes("作品包装"));
  assert.ok(nextStage!.summary.includes("评测深化"));
  assert.equal(confirmed.nextStagePlan, null, "采纳前不应直接进入下一阶段");

  const adopted = await service.confirmAdjustment(ownerId, nextStage!.id);
  assert.ok(adopted.nextStagePlan, "采纳下一阶段建议后应生成行动视图");
  assert.equal(adopted.nextStagePlan!.title, "AI PM 作品集包装阶段");
  assert.deepEqual(adopted.nextStagePlan!.modules.map((module) => module.title), [
    "作品包装",
    "评测深化",
    "项目讲述",
  ]);
  assert.ok(
    adopted.nextStagePlan!.modules.every((module) => module.rubric.length >= 3),
    "下一阶段每个模块应带作品级 rubric",
  );
  const nextStageActivities = adopted.activities.filter((activity) => activity.title.startsWith("下一阶段："));
  assert.deepEqual(nextStageActivities.map((activity) => activity.title), [
    "下一阶段：作品包装",
    "下一阶段：评测深化",
    "下一阶段：项目讲述",
  ]);
  assert.ok(nextStageActivities.every((activity) => activity.isCore), "下一阶段模块应进入正式核心活动");
  assert.ok(
    nextStageActivities.every((activity) => activity.expectedEvidence.includes("原作品证据")),
    "下一阶段活动应继承上一阶段作品证据",
  );
  assert.ok(
    nextStageActivities.every((activity) => activity.steps.includes("评审标准：")),
    "下一阶段活动步骤应写入 rubric",
  );
  assert.ok(
    nextStageActivities.some((activity) => activity.evaluationCriteria.includes("runtime fallback")),
    "评测深化活动应评审 fallback 边界",
  );
  assert.ok(
    nextStageActivities.some((activity) => activity.expectedEvidence.includes("10-15 分钟")),
    "项目讲述活动应带面试讲述标准",
  );
  assert.ok(adopted.nextStagePlan!.evidenceConnection.includes("accepted hard evidence"));
  assert.equal(
    adopted.evidence.find((item) => item.activityId === artifact!.id)?.status,
    "accepted",
    "采纳下一阶段不清空原作品证据",
  );

  const evalDeepening = nextStageActivities.find((activity) => activity.title === "下一阶段：评测深化")!;
  await service.startActivity(ownerId, evalDeepening.id);
  await service.submitEvidence(ownerId, evalDeepening.id, {
    evidenceType: "artifact",
    content:
      "eval report：本次补充了 situation、material fit、stage path、dynamic adjustment 和 artifact loop 的评估覆盖。报告包含一个失败案例：证据内容过短时不能确认掌握，需要退回补充。指标区分产品质量和学习质量，并说明计划完成率、证据通过率、资料错配次数和评审置信度。",
  });
  const weakRubricEvidence = (await service.getWorkspace(ownerId)).evidence.find((item) =>
    item.activityId === evalDeepening.id && item.status === "submitted"
  )!;
  const weakRubricReview = await service.reviewEvidence(ownerId, weakRubricEvidence.id);
  assert.equal(weakRubricReview.assessment.verdict, "needs_revision");
  assert.equal(weakRubricReview.workspace.artifactIteration.status, "packaging_in_progress");
  assert.ok(weakRubricReview.workspace.artifactIteration.revisionCount >= 1);
  assert.ok(weakRubricReview.workspace.artifactIteration.versions.length >= 2);
  assert.ok(
    weakRubricReview.workspace.artifactIteration.versions.some((version) =>
      version.status === "needs_revision" && version.rubricGapCount > 0
    ),
    "版本历史应记录未通过版本和 rubric 缺口数量",
  );
  assert.ok(
    weakRubricReview.assessment.rubricReviews.some((review) =>
      review.criterion.includes("runtime fallback") && review.status !== "covered"
    ),
    "缺 runtime fallback 时 rubric review 应指出未覆盖",
  );
  assert.ok(
    weakRubricReview.assessment.missing.some((item) => item.includes("rubric")),
    "rubric 缺口应进入 missing，供 UI 和调整建议解释",
  );

  await service.submitEvidence(ownerId, evalDeepening.id, {
    evidenceType: "artifact",
    content:
      "eval report v2：本次补充了 situation、material fit、stage path、dynamic adjustment 和 artifact loop 的评估覆盖。报告包含一个失败案例：证据内容过短时不能确认掌握，需要退回补充。指标区分产品质量和学习质量，并说明计划完成率、证据通过率、资料错配次数和评审置信度。runtime fallback 状态明确标注为 rule fallback，无 API key 时仍可运行，并说明 fallback 与 live LLM 的边界。评审结果解释为什么缺少 runtime fallback 不能直接确认掌握。下一步建议进入 10-15 分钟作品讲述和截图整理。",
  });
  const revisedEvidence = (await service.getWorkspace(ownerId)).evidence.find((item) =>
    item.activityId === evalDeepening.id && item.status === "submitted"
  )!;
  const revisedReview = await service.reviewEvidence(ownerId, revisedEvidence.id);
  assert.equal(revisedReview.assessment.verdict, "accepted");
  assert.equal(revisedReview.workspace.artifactIteration.status, "packaging_in_progress");
  assert.ok(revisedReview.workspace.artifactIteration.versions.at(-1)?.version);
  assert.equal(revisedReview.workspace.artifactIteration.versions.at(-1)?.status, "accepted");
});

test("Portfolio Artifact Loop 掌握纠正时不生成下一阶段建议", async () => {
  const service = createService();
  const ownerId = "portfolio-artifact-owner-2";
  await service.runDiagnostic({
    ownerId,
    goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.openai-evals"],
    plannerMode: "adaptive_existing_content",
  });
  await service.confirmProposal(ownerId);
  const workspace = await service.createPortfolioArtifactActivity(ownerId);
  const artifact = workspace.activities.find((activity) =>
    activity.activityType === "integrated_task" && activity.title.includes("AI Agent 产品 PRD"),
  )!;

  await service.startActivity(ownerId, artifact.id);
  await service.submitEvidence(ownerId, artifact.id, {
    evidenceType: "artifact",
    content:
      "AI Agent 产品 PRD v1：用户场景描述和问题陈述拆解明确，成功标准定义清楚，方案与需求区分清楚，价值假设说明完整。能力清单拆解包含处境识别、资料评估、阶段路径、动态调整和证据评审。输入输出定义明确，包含目标、资料、时间精力、行为信号和作品证据。可评测标准包括计划完成率、证据通过率、资料错配次数和评审置信度。能力边界说明 soft signal 不能直接 validated，人工兜底设计包括作品方向确认和掌握确认。评测结果引用 eval suite，上线回滚判断依据失败标准，用户感知指标和系统指标区分明确，产品改进建议是补齐下一阶段讲述。",
  });
  const evidence = (await service.getWorkspace(ownerId)).evidence.find((item) => item.activityId === artifact.id)!;
  await service.reviewEvidence(ownerId, evidence.id);

  const corrected = await service.confirmMastery(ownerId, artifact.nodeId, {
    decision: "corrected",
    note: "作品还不能讲清楚",
  });
  assert.ok(
    !corrected.adjustments.some((adjustment) =>
      adjustment.adjustmentType === "route_revision"
      && adjustment.reason.includes("作品已通过掌握确认"),
    ),
    "纠正掌握时不应生成下一阶段路线建议",
  );
  assert.ok(
    corrected.adjustments.some((adjustment) =>
      adjustment.adjustmentType === "weekly_light" && adjustment.status === "proposed",
    ),
    "纠正掌握仍应走现有补强建议",
  );
});
