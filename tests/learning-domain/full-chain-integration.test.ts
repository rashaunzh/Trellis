// Full Chain Phase 2 + 3：service pipeline wiring 集成测试
// 链路：runDiagnostic → goalAnalyzer → courseAnalyzer → capabilityMapper →
// adaptiveRoutePlanner → workspace.analysis（transient，不落库）。
// Phase 3：受控 adaptive 激活（plannerMode: legacy | adaptive_preview |
// adaptive_existing_content）。关键不变量：默认流程仍走 legacy planner；
// generic fallback 永不进入正式闭环；adaptive 活动 nodeId 必须是内容包节点。
import test from "node:test";
import assert from "node:assert/strict";

import {
  LearningApplicationService,
} from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import { learningContentPack } from "../../lib/learning/domain/content.ts";

function createService() {
  return new LearningApplicationService(
    new InMemoryLearningStore(),
    createRuleAgents(),
  );
}

const OWNER = "full-chain-owner";

test("runDiagnostic 后 workspace.analysis 存在，goal 等于输入原文，契约字段正确", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "系统学习 AIPM",
    weeklyMinutes: 180,
  });
  assert.ok(ws.analysis, "应有 analysis");
  assert.equal(ws.analysis!.goalAnalysis.goal, "系统学习 AIPM");
  assert.equal(ws.analysis!.plannerMode, "legacy", "Phase 2 不切换默认 planner");
  assert.equal(ws.analysis!.mode, "rule");
  assert.ok(ws.analysis!.capabilityMap.capabilities.length >= 1);
  assert.deepEqual(ws.analysis!.materialReviews, [], "无材料时资料评审为空");
  assert.ok(ws.analysis!.learningDecision.primaryNeed, "应给出下一步学习决策");
  assert.ok(ws.analysis!.adaptivePlan.weeklyPlan.activities.length >= 1, "应有 adaptivePlan 预览");
});

test("AI 学习目标得到 existing_content capabilityMap 与 content_pack 预览", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
  });
  assert.equal(ws.analysis!.capabilityMap.strategy, "existing_content");
  assert.ok(ws.analysis!.capabilityMap.capabilities.length >= 1);
  assert.equal(ws.analysis!.adaptivePlan.mode, "content_pack");
  // 目标能力 id 回填：existing_content 应含命中节点
  assert.ok(ws.analysis!.goalAnalysis.targetCapabilityIds!.length >= 1);
});

test("AIPM 目标：analysis 可观察（generic 或 existing），activeRouteId 仍为 legacy 路线", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "系统学习 AIPM",
    weeklyMinutes: 180,
  });
  assert.ok(ws.analysis, "应有 analysis");
  assert.ok(
    ["existing_content", "generic_fallback"].includes(ws.analysis!.capabilityMap.strategy!),
    "AIPM 目标应得到 existing 或 generic 能力图",
  );
  assert.equal(ws.profile!.activeRouteId, "ai-literacy", "activeRouteId 必须仍是 legacy route");
});

test("非 AI 目标（英语口语）得到 generic fallback analysis，不改变 legacy route，无 generic 泄漏", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "练习英语口语",
    weeklyMinutes: 180,
  });
  assert.equal(ws.analysis!.capabilityMap.strategy, "generic_fallback");
  assert.equal(ws.analysis!.adaptivePlan.mode, "generic");
  assert.equal(ws.profile!.activeRouteId, "ai-literacy", "generic fallback 不得改变 activeRouteId");
  assert.ok(
    ws.nodeProgress.every((p) => !p.nodeId.startsWith("cap.generic.")),
    "generic 能力 id 不得进入 nodeProgress",
  );
});

test("materialIds 为空：courseMaterials = []，capabilityMap 仍由 goalAnalysis 生成", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
  });
  assert.deepEqual(ws.analysis!.courseMaterials, []);
  assert.ok(ws.analysis!.capabilityMap.capabilities.length >= 1);
});

test("materialIds 非空：courseMaterials 输出覆盖关系（resourceMappings 权威）", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
    materialIds: ["res.gml-crash-course"],
  });
  assert.equal(ws.analysis!.courseMaterials.length, 1);
  assert.equal(ws.analysis!.courseMaterials[0].materialId, "res.gml-crash-course");
  assert.ok(
    ws.analysis!.courseMaterials[0].coveredCapabilityIds!.includes("ai-literacy.mechanism"),
    "材料覆盖应来自 resourceMappings",
  );
  assert.equal(ws.analysis!.materialReviews.length, 1, "有材料时应产出资料评审");
  assert.equal(ws.analysis!.materialReviews[0].materialId, "res.gml-crash-course");
  assert.ok(["core", "reference", "supplement", "not_recommended"].includes(ws.analysis!.materialReviews[0].verdict));
  assert.ok(ws.analysis!.learningDecision.toolCalls.length >= 1, "诊断应附带下一步决策需要的 agent/tool 线索");
});

test("MaterialReview 会影响 runDiagnostic 的 learningDecision", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "系统学习 AIPM，并在 14 天内产出作品集项目",
    weeklyMinutes: 180,
    materialIds: ["res.gml-crash-course"],
  });
  assert.ok(ws.analysis!.materialReviews.length >= 1);
  if (ws.analysis!.materialReviews.some((review) => review.verdict === "supplement" || review.verdict === "not_recommended")) {
    assert.ok(
      ["review_material", "route_correction"].includes(ws.analysis!.learningDecision.primaryNeed),
      "不适合当前阶段的资料应先触发资料评审或路线修正",
    );
    assert.ok(ws.analysis!.learningDecision.toolCalls.includes("materialReviewer"));
  }
});

test("confirmProposal 后 weeklyPlan 仍是 legacy 生成，不被 adaptivePlan 替换", async () => {
  const service = createService();
  const ws0 = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 360,
  });
  // adaptive 预览（depth=2 活动链）：不含 quiz/reflection/integrated_task
  const adaptiveTypes = new Set(
    ws0.analysis!.adaptivePlan.weeklyPlan.activities.map((a) => a.activityType),
  );
  for (const activityType of ["quiz", "reflection", "integrated_task"] as const) {
    assert.ok(
      !adaptiveTypes.has(activityType),
      `adaptive 预览（depth=2 链）不应含 ${activityType}`,
    );
  }
  const ws1 = await service.confirmProposal(OWNER);
  assert.equal(ws1.weeklyPlan!.status, "confirmed");
  for (const activityType of ["quiz", "reflection", "integrated_task"] as const) {
    assert.ok(
      ws1.activities.some((a) => a.activityType === activityType),
      `legacy 周计划应含 ${activityType}`,
    );
  }
  assert.equal(
    ws1.activities.filter((a) => a.isCore).length,
    6,
    "legacy 6h 计划应为 6 个核心活动（未被 adaptive 替换）",
  );
});

test("analysis 是瞬态：getWorkspace 返回 analysis null（不落库）", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  const ws = await service.getWorkspace(OWNER);
  assert.equal(ws.analysis, null, "analysis 只在 runDiagnostic 响应上附带");
});

test("空用户 workspace analysis 为 null", async () => {
  const ws = await createService().getWorkspace("fresh-owner-000");
  assert.equal(ws.analysis, null);
  assert.equal(ws.profile, null);
});

// ── Full Chain Phase 3：受控 adaptive 激活（plannerMode）────────────

test("不传 plannerMode：快照默认 legacy，confirmProposal 仍 legacy", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 360 });
  const ws1 = await service.confirmProposal(OWNER);
  assert.equal(ws1.weeklyPlan!.status, "confirmed");
  assert.ok(ws1.activities.some((a) => a.activityType === "integrated_task"), "legacy 6h 计划应含 integrated_task");
  assert.ok(ws1.activities.some((a) => a.activityType === "quiz"), "legacy 6h 计划应含 quiz");
});

test("adaptive_preview：返回 analysis，confirmProposal 仍 legacy", async () => {
  const service = createService();
  const ws0 = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 360,
    plannerMode: "adaptive_preview",
  });
  assert.equal(ws0.analysis!.plannerMode, "adaptive_preview");
  assert.ok(ws0.analysis!.adaptivePlan.weeklyPlan.activities.length >= 1, "应返回 adaptivePlan 预览");
  const ws1 = await service.confirmProposal(OWNER);
  assert.ok(
    ws1.activities.some((a) => a.activityType === "integrated_task"),
    "adaptive_preview 不应驱动计划，confirm 仍 legacy",
  );
});

test("adaptive_existing_content + existing_content：confirmProposal 使用 adaptive plan", async () => {
  const service = createService();
  const ws0 = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 360,
    plannerMode: "adaptive_existing_content",
  });
  assert.equal(ws0.analysis!.capabilityMap.strategy, "existing_content");
  assert.equal(ws0.analysis!.plannerMode, "adaptive_existing_content");
  const plan = ws0.analysis!.adaptivePlan;
  const ws1 = await service.confirmProposal(OWNER);
  assert.equal(ws1.weeklyPlan!.status, "confirmed");
  // 活动与 adaptivePlan 一一对应（nodeId/type/标题/时长/isCore/criteria）
  assert.equal(ws1.activities.length, plan.weeklyPlan.activities.length);
  for (let i = 0; i < plan.weeklyPlan.activities.length; i += 1) {
    const item = plan.weeklyPlan.activities[i]!;
    const draft = plan.activities[i]!;
    const act = ws1.activities[i]!;
    assert.equal(act.nodeId, item.capabilityId, "capabilityId 应为内容包 nodeId");
    assert.equal(act.activityType, item.activityType);
    assert.equal(act.title, draft.title, "持久化标题应来自 adaptive 草稿");
    assert.equal(act.estimatedMinutes, item.estimatedMinutes);
    assert.equal(act.isCore, item.isCore);
    assert.equal(act.evaluationCriteria, draft.evaluationCriteria, "评估标准应来自 adaptive 草稿（信号参数化）");
    assert.equal(act.expectedEvidence, draft.expectedEvidence);
  }
  // adaptive depth=2 链不含 legacy 专属活动类型
  assert.ok(
    !ws1.activities.some((a) => ["quiz", "reflection", "integrated_task"].includes(a.activityType)),
    "adaptive 计划不应含 quiz/reflection/integrated_task",
  );
});

test("adaptive mode：activities 都有 content pack nodeId", async () => {
  const service = createService();
  await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
    plannerMode: "adaptive_existing_content",
  });
  const ws1 = await service.confirmProposal(OWNER);
  assert.ok(ws1.activities.length >= 1);
  for (const activity of ws1.activities) {
    assert.ok(
      learningContentPack.nodes.some((n) => n.id === activity.nodeId),
      `活动 nodeId ${activity.nodeId} 应在内容包中（证据评审可解析）`,
    );
  }
});

test("adaptive mode：活动可提交证据并评审（节点在内容包内，信号可消费）", async () => {
  const service = createService();
  await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
    plannerMode: "adaptive_existing_content",
  });
  const ws1 = await service.confirmProposal(OWNER);
  const activity = ws1.activities.find((a) => a.status === "planned")!;
  assert.ok(activity, "应有待开始活动");
  const node = learningContentPack.nodes.find((n) => n.id === activity.nodeId)!;
  assert.ok(node, "活动 nodeId 应解析到内容包节点");
  // 动态构造覆盖该节点全部能力信号的证据（不依赖首个活动是哪个节点）
  const content =
    node.signals.map((label) => `${label}：针对「${label}」给出具体可复核的说明、例子与边界判断。`).join("。")
    + "。并画了概念关系图，标出前置与相邻能力；失效条件可操作；概念解释、边界判断、可复核产出与自我校验都已说明。下一步：继续练习并复盘失败场景。";
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  assert.ok(evidence, "应提交证据");
  const { assessment } = await service.reviewEvidence(OWNER, evidence.id);
  assert.equal(assessment.verdict, "accepted", "覆盖全部节点信号的证据应被接受");
  // Evidence Review 消费 content pack node.signals：全部节点信号出现在 covered 中
  const covered = new Set(
    assessment.signalReviews.filter((s) => s.status === "covered").map((s) => s.label),
  );
  for (const label of node.signals) {
    assert.ok(covered.has(label), `节点信号「${label}」应被覆盖`);
  }
});

test("generic fallback + adaptive_existing_content：confirmProposal 回退 legacy 并标记", async () => {
  const service = createService();
  const ws0 = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "练习英语口语",
    weeklyMinutes: 180,
    plannerMode: "adaptive_existing_content",
  });
  assert.equal(ws0.analysis!.capabilityMap.strategy, "generic_fallback");
  assert.equal(ws0.analysis!.plannerMode, "adaptive_existing_content");
  const ws1 = await service.confirmProposal(OWNER);
  assert.equal(ws1.weeklyPlan!.status, "confirmed");
  assert.ok(ws1.weeklyPlan!.rationale.includes("回退"), "应标记回退 legacy");
  assert.ok(ws1.activities.length >= 1);
  for (const activity of ws1.activities) {
    assert.ok(
      learningContentPack.nodes.some((n) => n.id === activity.nodeId),
      `回退后活动 nodeId ${activity.nodeId} 必须是内容包节点`,
    );
  }
  assert.ok(
    ws1.nodeProgress.every((p) => !p.nodeId.startsWith("cap.generic.")),
    "generic 能力不得进入 nodeProgress",
  );
});

test("weeklyMinutes 限制 adaptive 活动数量与总时长", async () => {
  const service = createService();
  const small = await service.runDiagnostic({
    ownerId: "cap-w-small",
    goal: "学 AI",
    weeklyMinutes: 60,
    plannerMode: "adaptive_existing_content",
  });
  const large = await service.runDiagnostic({
    ownerId: "cap-w-large",
    goal: "学 AI",
    weeklyMinutes: 300,
    plannerMode: "adaptive_existing_content",
  });
  assert.ok(small.analysis!.adaptivePlan.weeklyPlan.totalMinutes <= 60, "小容量预览承诺不超容量");
  assert.ok(large.analysis!.adaptivePlan.weeklyPlan.totalMinutes <= 300, "大容量预览承诺不超容量");
  assert.ok(
    large.analysis!.adaptivePlan.weeklyPlan.coreActivityCount > small.analysis!.adaptivePlan.weeklyPlan.coreActivityCount,
    "大容量核心活动应更多",
  );
  const wsSmall = await service.confirmProposal("cap-w-small");
  const wsLarge = await service.confirmProposal("cap-w-large");
  const coreMinutes = (ws: typeof wsSmall) =>
    ws.activities.filter((a) => a.isCore).reduce((sum, a) => sum + a.estimatedMinutes, 0);
  assert.ok(coreMinutes(wsSmall) <= 60, "小容量落库核心承诺不超容量");
  assert.ok(coreMinutes(wsLarge) <= 300, "大容量落库核心承诺不超容量");
});

test("selfReport 高：adaptive 周计划不排已达标能力的基础活动（satisfied 后置）", async () => {
  const service = createService();
  const ws0 = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 360,
    selfReport: { "ai-literacy.mechanism": 2 },
    plannerMode: "adaptive_existing_content",
  });
  const plan = ws0.analysis!.adaptivePlan;
  const mechanism = plan.orderedCapabilities.find((n) => n.capabilityId === "ai-literacy.mechanism")!;
  assert.equal(mechanism.satisfied, true, "自评达标的 mechanism 应标记 satisfied");
  assert.ok(
    !plan.weeklyPlan.activities.some((a) => a.capabilityId === "ai-literacy.mechanism"),
    "达标能力不应进 adaptive 周计划",
  );
  const ws1 = await service.confirmProposal(OWNER);
  assert.ok(
    !ws1.activities.some((a) => a.nodeId === "ai-literacy.mechanism"),
    "达标能力不应生成活动",
  );
  assert.ok(ws1.activities.length >= 1, "其他能力仍应有活动");
});
