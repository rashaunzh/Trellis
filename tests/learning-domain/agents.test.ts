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
import { LearningApplicationService } from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";

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
  // 承诺时长（totalMinutes）严格不超过容量
  assert.ok(planA.totalMinutes <= 180, `承诺 ${planA.totalMinutes} 分钟不应超过容量 180`);
  // 核心活动承诺时长 = totalMinutes
  const coreMinutes = planA.activities
    .filter((a) => a.isCore)
    .reduce((s, a) => s + a.estimatedMinutes, 0);
  assert.equal(planA.totalMinutes, coreMinutes);
});

test("planner.composeWeeklyPlan 容量约束：可选不计入承诺", () => {
  // 小容量：180 分钟只能容纳 4 个 30/45 交替活动中的一部分
  const plan = agents.planner.composeWeeklyPlan({
    ownerId: "u1",
    routeId: "ai-literacy",
    weekKey: "2026-W33",
    capacityMinutes: 90,
    nodeStatusById: {},
    prerequisiteSatisfied: () => true,
    seed: 1,
  });
  // 承诺时长严格不超过容量
  assert.ok(plan.totalMinutes <= 90, `承诺 ${plan.totalMinutes} 分钟不应超过容量 90`);
  // 所有活动（含可选）的总时长可以超过容量，但承诺只算核心
  const allMinutes = plan.activities.reduce((s, a) => s + a.estimatedMinutes, 0);
  const coreMinutes = plan.activities
    .filter((a) => a.isCore)
    .reduce((s, a) => s + a.estimatedMinutes, 0);
  assert.equal(plan.totalMinutes, coreMinutes);
  assert.ok(allMinutes >= coreMinutes);
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

test("evidenceEvaluator 规则版：足量且覆盖目标的证据 accepted", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-1",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "explanation",
    capabilitySignals: learningContentPack.nodes.find((node) => node.id === "ai-literacy.mechanism")!.signals,
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
  assert.equal(typeof assessment.score, "number");
  assert.ok(assessment.evidenceCard.summary.length > 0);
  assert.ok(Array.isArray(assessment.signalReviews));
  assert.ok(assessment.signalReviews.some((signal) => signal.status === "covered"));
  assert.ok(Array.isArray(assessment.dimensionScores));
  assert.ok(assessment.dimensionScores.some((dimension) => dimension.id === "signalCoverage"));
});

test("evidenceEvaluator 规则版：篇幅不足 needs_revision", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-2",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "explanation",
    capabilitySignals: learningContentPack.nodes.find((node) => node.id === "ai-literacy.mechanism")!.signals,
    content: "模型很厉害。",
    criteria: "解释覆盖机制与边界",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "needs_revision");
  assert.ok(assessment.missing.length > 0);
});

// ── Evidence Review Engine：不同质量提交材料的评审行为 ──────────
// 以下断言全部基于规则引擎现有输出（未修改任何评分逻辑）。

test("evidenceEvaluator 空泛材料：篇幅够但零信号覆盖 → needs_revision + 插前置", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-vague",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "explanation",
    content:
      "这个内容我觉得挺好的，学完之后感觉很有收获，以后还会继续学习，希望早日掌握这门技术，让自己变得更厉害，也希望能把学到的知识用到实际工作中，帮助解决更多问题，感觉收获很多。",
    criteria: "解释覆盖机制与边界",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "needs_revision");
  // 被拒是因为空泛（零信号覆盖），而不是篇幅不足
  assert.ok(!assessment.missing.some((m) => m.includes("篇幅不足")));
  assert.ok(assessment.missing.some((m) => m.includes("未充分覆盖")));
  assert.ok(assessment.signalReviews.every((signal) => signal.status === "missing"));
  // 信号覆盖过低 → 引擎建议插入前置节点而非直接退回
  assert.equal(assessment.nextAction, "insert_prerequisite");
});

test("evidenceEvaluator 只有链接无正文：低可信度初评 + 网页类型 + unknown 可读性", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-link-only",
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    targetLevel: 2,
    evidenceType: "external",
    externalUrl: "https://example.com/llm-course",
    content: "看这个链接。",
    criteria: "解释覆盖机制与边界",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "needs_revision");
  // 低可信度：MVP 未解析外部链接
  assert.ok(assessment.credibilityNote.includes("低可信度初评"));
  assert.ok(assessment.evidenceCard.summary.includes("尚未真实解析"));
  // Evidence Card 识别为网页类型，但正文不可读
  assert.equal(assessment.evidenceCard.artifactType, "webpage");
  assert.equal(assessment.evidenceCard.sourceReadability, "unknown");
  // 可信度与可解析性维度都只有 45
  const credibility = assessment.dimensionScores.find((d) => d.id === "credibility");
  assert.equal(credibility?.score, 45);
  const parseability = assessment.dimensionScores.find((d) => d.id === "parseability");
  assert.equal(parseability?.score, 45);
});

test("evidenceEvaluator 含测试问题但缺标准答案：标准答案定义被标记为缺失信号", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-no-answer",
    nodeId: "ai-app-dev.rag",
    nodeTitle: "RAG 应用构建",
    targetLevel: 2,
    evidenceType: "explanation",
    content:
      "测试问题：请解释 RAG 检索增强生成的核心流程，包括索引、检索、生成三个阶段，并说明每阶段的作用与局限。用户实际回答：先切分文档建立向量索引，再执行相似度检索，把检索结果拼进提示词生成回答，并指出检索不到时会触发无答案兜底。引用：来自课程资料第三讲。",
    criteria: "测试问题；标准答案定义",
    isSkipValidation: false,
  });
  // 测试问题被识别覆盖，但标准答案定义缺失
  assert.equal(
    assessment.signalReviews.find((s) => s.label === "测试问题")?.status,
    "covered",
  );
  const standardAnswer = assessment.signalReviews.find((s) => s.label === "标准答案定义");
  assert.equal(standardAnswer?.status, "missing");
  assert.ok(assessment.missing.some((m) => m.includes("标准答案定义")));
  // 其余信号覆盖充分 → 整体 accepted，缺口在 missing 中提示
  assert.equal(assessment.verdict, "accepted");
  // Evidence Card 识别为结构化表格材料，含测试/评估设计
  assert.equal(assessment.evidenceCard.artifactType, "table");
  assert.ok(assessment.evidenceCard.extractedItems.includes("包含测试或评估设计"));
});

test("evidenceEvaluator 完整材料（问题+标准答案+实际回答+引用命中）：覆盖多个 signals → accepted", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-complete",
    nodeId: "ai-app-dev.rag",
    nodeTitle: "RAG 应用构建",
    targetLevel: 2,
    evidenceType: "explanation",
    content:
      "RAG 链路说明：先切分文档建立索引，检索时按相似度召回相关片段，拼进提示词生成回答。测试问题设计：RAG 为什么需要切分文档？标准答案定义：文档过长会超出上下文窗口，切分后便于按相关性检索。实际回答：先切分建立索引，检索时按相似度召回片段。引用命中判断：课程资料第二讲，已命中标准答案定义。无答案处理设计：检索不到答案时应拒答，而不是编造。下一步：补充失败案例分析。",
    criteria: "测试问题；标准答案；实际回答",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "accepted");
  assert.equal(assessment.nextAction, "proceed");
  const covered = assessment.signalReviews.filter((s) => s.status === "covered");
  assert.ok(covered.length >= 6, `应覆盖多个信号，实际覆盖 ${covered.length} 个`);
  // 四要素各自对应的信号均被覆盖（短语级信号：引用命中判断 / 测试问题设计 / 标准答案定义）
  for (const label of ["测试问题", "标准答案", "实际回答", "引用命中判断"]) {
    assert.equal(
      assessment.signalReviews.find((s) => s.label === label)?.status,
      "covered",
      `信号「${label}」应被覆盖`,
    );
  }
  // 评估标准在材料中全部命中 → 完成标准完整性满分
  const criteriaDim = assessment.dimensionScores.find((d) => d.id === "criteriaCompleteness");
  assert.equal(criteriaDim?.score, 100);
  assert.ok(assessment.evidenceCard.extractedItems.includes("包含测试或评估设计"));
});

test("evidenceEvaluator 含失败类型分类：失败类型分类信号被覆盖", async () => {
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "ev-failure-class",
    nodeId: "ai-literacy.evaluation",
    nodeTitle: "评测方法",
    targetLevel: 2,
    evidenceType: "explanation",
    content:
      "失败类型分类：本次评测测试时把失败分成三类——幻觉类失败、边界类失败和工具类失败。幻觉类失败是模型生成了不存在的引用；边界类失败是模型在无答案时仍强行回答；工具类失败是调用工具时参数错误。升级标准：修复两类失败后可进入下一轮评测。下一步：补充更多失败样例。",
    criteria: "失败类型分类；升级标准",
    isSkipValidation: false,
  });
  assert.equal(assessment.verdict, "accepted");
  // 失败类型分类作为评估标准信号被覆盖
  assert.equal(
    assessment.signalReviews.find((s) => s.label === "失败类型分类")?.status,
    "covered",
  );
  // 评估标准中的「升级标准」信号同样被覆盖（短语级数据下节点信号为「失败类型分类」）
  assert.equal(
    assessment.signalReviews.find((s) => s.label === "升级标准")?.status,
    "covered",
  );
  // Evidence Card 提取出边界/失败条件判断
  assert.ok(assessment.evidenceCard.extractedItems.includes("包含边界或失败条件判断"));
  assert.equal(assessment.evidenceCard.artifactType, "table");
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

// ── Proposal / Adjustment Engine：缺口信号驱动的建议文案 ──────────
// 断言基于当前规则引擎输出（commit 2312346 引入 missingSignals 回流）。
// missingSignals 文案、无信号旧文案、回流落库已由下方既有用例覆盖；
// 此处补充未被覆盖的两条路径：补强 insert_activity 动作、仅 reviewRationale 回退。

test("adjustmentAdvisor：needs_revision 建议含补强 insert_activity 动作（缺口文案随信号变化）", () => {
  // 有 missingSignals：动作描述携带具体缺口
  const withSignals = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
    missingSignals: ["概念解释", "边界判断"],
  });
  const insertWith = withSignals.actions.find((a) => a.action === "insert_activity");
  assert.ok(insertWith, "应有补强活动动作");
  assert.equal(insertWith!.targetNodeId, "ai-literacy.mechanism");
  assert.ok(insertWith!.description.includes("补强活动"));
  assert.ok(insertWith!.description.includes("概念解释"));
  assert.ok(withSignals.actions.some((a) => a.action === "revise"));

  // 无缺口信号：动作仍生成，但用通用描述
  const withoutSignals = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
  });
  const insertWithout = withoutSignals.actions.find((a) => a.action === "insert_activity");
  assert.equal(insertWithout?.description, "插入「机制与边界」补强活动后再提交证据。");
});

test("adjustmentAdvisor：仅 reviewRationale 时用评估结论摘要回退", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
    reviewRationale: "当前材料还不足以稳定证明该能力。",
  });
  // 无结构化信号 → 用评估结论摘要，不出现信号词
  assert.ok(suggestion.reason.includes("当前材料还不足以稳定证明该能力"));
  assert.equal(suggestion.summary, "建议按评审反馈补充材料后重新提交。");
  assert.ok(!suggestion.reason.includes("缺少能力信号"));
});

test("adjustmentAdvisor：缺失/部分信号回流到建议文案（判定不变）", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-app-dev.rag",
    nodeTitle: "RAG 应用构建",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-app-dev",
    missingSignals: ["标准答案定义", "引用命中判断"],
    partialSignals: ["测试问题设计"],
  });
  // 判定不变：activity_replan / medium
  assert.equal(suggestion.adjustmentType, "activity_replan");
  assert.equal(suggestion.severity, "medium");
  assert.ok(
    suggestion.actions.some((action) => action.action === "insert_activity" && action.targetNodeId === "ai-app-dev.rag"),
    "证据退回建议应包含可执行的补强活动动作",
  );
  // 文案包含具体信号名称
  assert.ok(suggestion.reason.includes("标准答案定义"), `reason 应含缺失信号：${suggestion.reason}`);
  assert.ok(suggestion.reason.includes("引用命中判断"), `reason 应含缺失信号：${suggestion.reason}`);
  assert.ok(suggestion.reason.includes("测试问题设计"), `reason 应含部分信号：${suggestion.reason}`);
  assert.ok(suggestion.summary.includes("标准答案定义"), `summary 应含缺失信号：${suggestion.summary}`);
});

test("adjustmentAdvisor：无缺口信号时保留旧文案", () => {
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
  assert.equal(suggestion.reason, "节点「机制与边界」的证据未达到评估标准。");
  assert.equal(suggestion.summary, "保持节点成长中，修订证据或增加一次独立练习后再提交。");
  assert.equal(suggestion.severity, "medium");
});

test("集成：证据缺口从 reviewEvidence 回流到调整建议落库", async () => {
  const service = new LearningApplicationService(new InMemoryLearningStore(), agents);
  const owner = "adj-gap-owner-01";
  await service.runDiagnostic({ ownerId: owner, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(owner);
  const ws = await service.getWorkspace(owner);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(owner, activity.id);
  // 篇幅不足 → needs_revision，多个能力信号缺失
  await service.submitEvidence(owner, activity.id, { content: "模型很厉害。" });
  const evidence = (await service.getWorkspace(owner)).evidence.find((e) => e.activityId === activity.id)!;
  const { assessment } = await service.reviewEvidence(owner, evidence.id);
  assert.equal(assessment.verdict, "needs_revision");
  assert.ok(assessment.signalReviews.some((s) => s.status === "missing"));
  const ws2 = await service.getWorkspace(owner);
  const adjustment = ws2.adjustments.filter((a) => a.adjustmentType === "activity_replan").at(-1);
  assert.ok(adjustment, "应落库 activity_replan 调整建议");
  assert.ok(
    adjustment!.reason.includes("缺少能力信号"),
    `调整 reason 应包含具体信号缺口：${adjustment!.reason}`,
  );
});

test("内容包通过 agent 上下文可用（三条路线资源齐全）", () => {
  assert.equal(learningContentPack.routes.length, 3);
  assert.ok(learningContentPack.nodes.length > 10);
  assert.ok(learningContentPack.resources.length >= 5);
  assert.ok(learningContentPack.tools.length >= 2);
  assert.ok(learningContentPack.nodes.every((node) => node.signals.length >= 3));
});

// ── Proposal / Adjustment Engine：未被既有用例覆盖的分支 ──────────────
// 既有用例覆盖：needs_revision 基础建议、前置缺口判定、补强 insert_activity、
// reviewRationale 回退、信号回流文案、无信号旧文案、缺口回流落库。
// 此处补充：前置缺口 vs 普通补强的动作契约区分（UI 依赖该语义）、
// weekly_light 两条未测分支（完成率低 / 跳过节点）。

test("adjustmentAdvisor：前置缺口与普通补强的动作契约可区分", () => {
  // 前置缺口：insert_activity 指向前置节点，description 带「插入前置节点活动：」前缀，severity high
  const gap = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.fit",
    nodeTitle: "神经网络与深度学习",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: ["ai-literacy.mechanism"],
    routeId: "ai-literacy",
  });
  assert.equal(gap.adjustmentType, "activity_replan");
  assert.equal(gap.severity, "high");
  const gapInsert = gap.actions.find((a) => a.action === "insert_activity");
  assert.equal(gapInsert?.targetNodeId, "ai-literacy.mechanism", "前置插入目标应为前置节点");
  assert.ok(
    gapInsert?.description.startsWith("插入前置节点活动："),
    `前置插入 description 应带「插入前置节点活动：」前缀：${gapInsert?.description}`,
  );

  // 普通补强：insert_activity 指向当前节点，description 带「插入补强活动：」前缀，severity medium
  const boost = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.fit",
    nodeTitle: "神经网络与深度学习",
    evidenceVerdict: "needs_revision",
    activityStatus: "evidence_submitted",
    completionRate: 1,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
    missingSignals: ["边界判断"],
  });
  assert.equal(boost.adjustmentType, "activity_replan");
  assert.equal(boost.severity, "medium");
  const boostInsert = boost.actions.find((a) => a.action === "insert_activity");
  assert.equal(boostInsert?.targetNodeId, "ai-literacy.fit", "补强插入目标应为当前节点");
  assert.ok(
    boostInsert?.description.startsWith("插入补强活动："),
    `补强插入 description 应带「插入补强活动：」前缀：${boostInsert?.description}`,
  );
});

test("adjustmentAdvisor：完成率低时给出 weekly_light 收缩建议", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "accepted",
    activityStatus: "reviewed",
    completionRate: 0.4,
    skippedNodeIds: [],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
  });
  assert.equal(suggestion.adjustmentType, "weekly_light");
  assert.equal(suggestion.severity, "medium");
  assert.ok(
    suggestion.actions.some((a) => a.action === "continue"),
    "完成率低建议应含 continue 动作",
  );
  assert.ok(
    !suggestion.actions.some((a) => a.action === "insert_activity"),
    "收缩建议不应插入活动",
  );
});

test("adjustmentAdvisor：跳过节点时建议安排验证活动（每节点一条）", () => {
  const suggestion = agents.adjustmentAdvisor.suggestAdjustment({
    nodeId: "ai-literacy.mechanism",
    nodeTitle: "机制与边界",
    evidenceVerdict: "accepted",
    activityStatus: "reviewed",
    completionRate: 1,
    skippedNodeIds: ["ai-literacy.fit", "ai-literacy.context"],
    prerequisiteGaps: [],
    routeId: "ai-literacy",
  });
  assert.equal(suggestion.adjustmentType, "weekly_light");
  assert.equal(suggestion.severity, "medium");
  const inserts = suggestion.actions.filter((a) => a.action === "insert_activity");
  assert.equal(inserts.length, 2, "每个跳过节点应有一条验证活动动作");
  assert.ok(
    inserts.every((a) => a.targetNodeId && a.description.includes("验证活动")),
    "跳过节点动作应指向节点并说明验证活动",
  );
});
