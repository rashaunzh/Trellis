// agent 接口测试：四类接口只返回结构化对象
// 1. planner.planLearningRoute → RouteProposal
// 2. planner.composeWeeklyPlan → 确定性（同输入同输出，刷新不重排）
// 3. activityComposer.composeActivity → ActivityDraft（三类活动）
// 4. evidenceEvaluator.evaluateEvidence → EvidenceAssessment
// 5. adjustmentAdvisor.suggestAdjustment → AdjustmentSuggestion
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import { learningContentPack } from "../../lib/learning/domain/content.ts";

const agents = createRuleAgents();

test("planner.planLearningRoute 返回结构化路线提案", () => {
  const proposal = agents.planner.planLearningRoute({
    goal: "学会用 AI 做一个知识问答应用",
    weeklyMinutes: 180,
    materialIds: [],
    selfReport: { "ai-literacy.mechanism": 2 },
    preference: "build_first",
  });
  assert.ok(proposal.routeId);
  assert.ok(Array.isArray(proposal.nodeSequence));
  assert.ok(Array.isArray(proposal.adjacentBranchIds));
  assert.ok(proposal.rationale.length > 0);
  assert.ok(proposal.initialProfile.recommendedFirstNodeId);
  // 返回结构化对象而非自然语言
  assert.equal(typeof proposal.routeId, "string");
  assert.equal(typeof proposal.rationale, "string");
});

test("planner.composeWeeklyPlan 确定性：相同输入相同输出", () => {
  const input = {
    ownerId: "u1",
    routeId: "ai-literacy",
    weekKey: "2026-W33",
    capacityMinutes: 180,
    nodeStatusById: {},
    prerequisiteSatisfied: () => true,
    seed: 42,
  };
  const planA = agents.planner.composeWeeklyPlan(input);
  const planB = agents.planner.composeWeeklyPlan(input);
  assert.deepEqual(planA, planB);
  // 刷新（重新调用）不重排：活动顺序和时长一致
  assert.equal(planA.activities.length, planB.activities.length);
  assert.deepEqual(
    planA.activities.map((a) => a.nodeId),
    planB.activities.map((a) => a.nodeId),
  );
  // 核心活动 2-4 个
  assert.ok(planA.coreActivityCount >= 2 && planA.coreActivityCount <= 4);
  assert.ok(planA.activities.filter((a) => a.isCore).length === planA.coreActivityCount);
  // 总时长不超过容量
  assert.ok(planA.totalMinutes <= 180 + 45);
});

test("planner.composeWeeklyPlan 尊重节点状态：已验证节点不入选", () => {
  const plan = agents.planner.composeWeeklyPlan({
    ownerId: "u1",
    routeId: "ai-literacy",
    weekKey: "2026-W33",
    capacityMinutes: 180,
    nodeStatusById: { "ai-literacy.mechanism": "validated" },
    prerequisiteSatisfied: () => true,
  });
  assert.ok(!plan.activities.some((a) => a.nodeId === "ai-literacy.mechanism"));
});

test("activityComposer 三类活动均返回完整结构", () => {
  const base = {
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    nodeDescription: "解释模型为何有效",
    resourceIds: ["res.gml-crash-course"],
    estimatedMinutes: 30,
    isSkipValidation: false,
  };
  for (const activityType of ["build_model", "follow_demo", "independent_practice"] as const) {
    const draft = agents.activityComposer.composeActivity({ ...base, activityType });
    assert.equal(draft.activityType, activityType);
    assert.ok(draft.title.length > 0);
    assert.ok(draft.goal.length > 0);
    assert.ok(draft.estimatedMinutes >= 30);
    assert.ok(Array.isArray(draft.steps) && draft.steps.length >= 3);
    assert.ok(draft.expectedEvidence.length > 0);
    assert.ok(draft.evaluationCriteria.length > 0);
    assert.ok(draft.nextAdvice.length > 0);
  }
});

test("activityComposer 跳学验证活动有独立标记与提示", () => {
  const draft = agents.activityComposer.composeActivity({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    nodeDescription: "",
    activityType: "independent_practice",
    isSkipValidation: true,
    resourceIds: [],
    estimatedMinutes: 30,
  });
  assert.ok(draft.title.includes("跳学验证"));
  assert.ok(draft.nextAdvice.includes("已验证"));
});

test("evidenceEvaluator 规则版：足量且覆盖目标的证据 accepted", () => {
  const assessment = agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-1",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "explanation",
    content:
      "模型从数据中学习模式而不是保存事实，生成是在上下文中预测后续内容。" +
      "训练时模型通过大量样本调整参数，推理时根据概率输出。" +
      "流畅自信与正确是不同的事，幻觉说明概率性输出的边界，泛化依赖训练数据分布。",
    criteria: "解释覆盖机制与边界",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "accepted");
  assert.ok(Array.isArray(assessment.reasons));
  assert.ok(Array.isArray(assessment.missing));
  assert.equal(assessment.nextAction, "proceed");
  assert.equal(typeof assessment.confidence, "number");
});

test("evidenceEvaluator 规则版：篇幅不足 needs_revision", () => {
  const assessment = agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-2",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "explanation",
    content: "模型很厉害。",
    criteria: "解释覆盖机制与边界",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "needs_revision");
  assert.ok(assessment.missing.length > 0);
});

test("adjustmentAdvisor：证据退回时提出修订建议", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
  });
  assert.ok(suggestion.adjustmentType);
  assert.ok(Array.isArray(suggestion.actions));
  assert.ok(suggestion.actions.length > 0);
  assert.ok(suggestion.reason.length > 0);
  assert.ok(["low", "medium", "high"].includes(suggestion.severity));
});

test("adjustmentAdvisor：前置缺口时插入前置活动", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.architecture",
    nodeTitle: "应用架构选择",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: ["ai-literacy.fit"],
    routeId: "ai-literacy",
  });
  assert.equal(suggestion.adjustmentType, "activity_replan");
  assert.ok(suggestion.actions.some((a) => a.action === "insert_activity"));
  assert.equal(suggestion.severity, "high");
});

test("内容包通过 agent 上下文可用（三条路线资源齐全）", () => {
  assert.equal(learningContentPack.routes.length, 3);
  assert.ok(learningContentPack.nodes.length > 10);
  assert.ok(learningContentPack.resources.length >= 5);
  assert.ok(learningContentPack.tools.length >= 2);
});
