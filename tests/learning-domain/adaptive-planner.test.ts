// AdaptiveRoutePlanner（规则版 helper）测试
// 覆盖任务要求的最小测试清单：
//   1. 用现有 AI 内容包生成路线时结果不破坏旧行为（RulePlanner fallback 保留）
//   2. 用 generic CapabilityMap 也能生成至少 1 周活动
//   3. 活动必须带 expectedEvidence 和 completionCriteria
//   4. weeklyMinutes 会限制活动数量
//   5. selfReport 高的能力会后置或跳过基础活动
// 附：前置约束、确定性、内容包投影、校验与信号化活动组合器。
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import { learningContentPack } from "../../lib/learning/domain/content.ts";
import {
  RuleAdaptiveRoutePlanner,
  composeAdaptiveActivity,
  toCapabilityMap,
  validateCapabilityMap,
} from "../../lib/learning/agents/adaptive-planner.ts";
import type { CapabilityMap } from "../../lib/learning/agents/adaptive-types.ts";

const planner = new RuleAdaptiveRoutePlanner();

// ── 夹具：通用能力图（非 AI 领域，验证去领域化）─────────
const GENERIC_MAP: CapabilityMap = {
  version: "0.1.0",
  source: "generic",
  capabilities: [
    { id: "pub.audience", title: "受众分析", description: "识别听众与场景", targetLevel: 2, isMilestone: false, signals: ["受众画像识别", "场景匹配"] },
    { id: "pub.structure", title: "演讲结构", description: "组织开场-主体-收尾", targetLevel: 2, isMilestone: false, signals: ["结构设计", "过渡衔接"] },
    { id: "pub.delivery", title: "表达与节奏", description: "声音与肢体表达", targetLevel: 3, isMilestone: true, signals: ["节奏控制", "临场应变"] },
    { id: "pub.qa", title: "问答与反馈", description: "回应提问并利用反馈", targetLevel: 2, isMilestone: false, signals: ["问题拆解", "反馈利用"] },
    { id: "pub.storytelling", title: "故事化表达", description: "用故事增强记忆点", targetLevel: 2, isMilestone: false, signals: ["叙事结构", "情感唤起"] },
  ],
  edges: [
    { from: "pub.audience", to: "pub.structure", relationType: "prerequisite" },
    { from: "pub.structure", to: "pub.delivery", relationType: "prerequisite" },
    { from: "pub.delivery", to: "pub.qa", relationType: "prerequisite" },
  ],
};

function genericInput(overrides: Partial<Parameters<typeof planner.plan>[0]> = {}) {
  return {
    goalAnalysis: { goal: "学会公开演讲", targetCapabilityIds: [], depth: 3 as const },
    capabilityMap: GENERIC_MAP,
    weeklyMinutes: 240,
    preference: "breadth_first" as const,
    ...overrides,
  };
}

// ── 1. 内容包兼容：投影 + content_pack 模式 + 旧行为不破坏 ──

test("toCapabilityMap：内容包投影为 CapabilityMap 且保持节点/边/信号完整", () => {
  const map = toCapabilityMap(learningContentPack);
  assert.equal(map.source, "content_pack");
  assert.equal(map.version, learningContentPack.version);
  assert.equal(map.capabilities.length, learningContentPack.nodes.length);
  assert.equal(map.edges.length, learningContentPack.edges.length);
  const mechanism = map.capabilities.find((c) => c.id === "ai-literacy.mechanism")!;
  assert.equal(mechanism.title, "AI 基本概念与能力边界");
  assert.deepEqual(mechanism.signals, learningContentPack.nodes.find((n) => n.id === "ai-literacy.mechanism")!.signals);
  assert.ok(mechanism.sourceRefs!.length > 0);
  // 边类型保留
  assert.ok(map.edges.some((e) => e.relationType === "prerequisite"));
  assert.ok(map.edges.some((e) => e.relationType === "related"));
  validateCapabilityMap(map); // 投影结果必须通过校验
});

test("用现有 AI 内容包生成路线：content_pack 模式 + 前置排序 + 至少 1 周活动", () => {
  const plan = planner.plan({
    goalAnalysis: {
      goal: "学会用评测验证 AI 输出",
      targetCapabilityIds: ["ai-literacy.evaluation"],
      depth: 2,
    },
    capabilityMap: toCapabilityMap(learningContentPack),
    weeklyMinutes: 180,
    preference: "breadth_first",
  });
  assert.equal(plan.mode, "content_pack");
  // 前置闭包：evaluation 的前置链 = mechanism → fit/context → architecture → evaluation
  const order = plan.route.nodeIds;
  assert.ok(order.includes("ai-literacy.evaluation"));
  assert.ok(
    order.indexOf("ai-literacy.mechanism") < order.indexOf("ai-literacy.fit"),
    "前置机制应排在 fit 之前",
  );
  assert.ok(
    order.indexOf("ai-literacy.context") < order.indexOf("ai-literacy.architecture"),
    "context 应先于 architecture",
  );
  assert.ok(
    order.indexOf("ai-literacy.architecture") < order.indexOf("ai-literacy.evaluation"),
    "architecture 应先于 evaluation",
  );
  // 首周：只有无前置的 mechanism 可排（其余前置未满足）
  assert.ok(plan.weeklyPlan.activities.length >= 1);
  assert.ok(plan.weeklyPlan.totalMinutes <= 180);
  assert.ok(plan.activities.length >= 1);
});

test("既有 RulePlanner 保持可用（fallback 兼容，行为不被破坏）", () => {
  const agents = createRuleAgents();
  const proposal = agents.planner.planLearningRoute({
    goal: "学会用 AI 做知识问答应用",
    weeklyMinutes: 180,
    materialIds: [],
    selfReport: {},
    preference: "breadth_first",
  });
  assert.equal(proposal.routeId, "ai-literacy");
  assert.ok(proposal.nodeSequence.length > 0);
  const weekly = agents.planner.composeWeeklyPlan({
    ownerId: "u1",
    routeId: "ai-literacy",
    weekKey: "2026-W34",
    capacityMinutes: 180,
    nodeStatusById: {},
    prerequisiteSatisfied: () => true,
    seed: 42,
  });
  assert.ok(weekly.activities.length >= 1);
  assert.ok(weekly.totalMinutes <= 180);
});

// ── 2. generic CapabilityMap 也能生成至少 1 周活动 ──────

test("generic CapabilityMap（非 AI 领域）生成路线与至少 1 周活动", () => {
  const plan = planner.plan(genericInput());
  assert.equal(plan.mode, "generic");
  assert.equal(plan.route.nodeIds.length, 5);
  // 拓扑序：audience → structure → delivery → qa
  assert.ok(plan.route.nodeIds.indexOf("pub.audience") < plan.route.nodeIds.indexOf("pub.structure"));
  assert.ok(plan.route.nodeIds.indexOf("pub.structure") < plan.route.nodeIds.indexOf("pub.delivery"));
  assert.ok(plan.route.nodeIds.indexOf("pub.delivery") < plan.route.nodeIds.indexOf("pub.qa"));
  assert.ok(plan.weeklyPlan.activities.length >= 1);
  assert.ok(plan.activities.length >= 1);
  assert.ok(plan.rationale.length > 0);
});

// ── 3. 活动必须带 expectedEvidence 和 completionCriteria ──

test("所有活动草稿都带 expectedEvidence / completionCriteria / evaluationCriteria / steps", () => {
  const plans = [
    planner.plan(genericInput()),
    planner.plan({
      goalAnalysis: { goal: "学会用评测验证 AI 输出", targetCapabilityIds: ["ai-literacy.evaluation"], depth: 2 },
      capabilityMap: toCapabilityMap(learningContentPack),
      weeklyMinutes: 180,
      preference: "breadth_first",
    }),
  ];
  for (const plan of plans) {
    assert.ok(plan.activities.length >= 1, "应有活动草稿");
    for (const draft of plan.activities) {
      assert.ok(draft.expectedEvidence.trim().length > 0, `缺少 expectedEvidence：${draft.title}`);
      assert.ok(draft.completionCriteria.trim().length > 0, `缺少 completionCriteria：${draft.title}`);
      assert.ok(draft.evaluationCriteria.trim().length > 0, `缺少 evaluationCriteria：${draft.title}`);
      assert.ok(draft.goal.trim().length > 0);
      assert.ok(draft.steps.length >= 3);
      assert.ok(draft.estimatedMinutes >= 30);
      assert.equal(draft.completionCriteria, draft.evaluationCriteria, "活动完成标准与评估标准同源");
    }
  }
});

// ── 4. weeklyMinutes 限制活动数量与承诺时长 ─────────────

test("weeklyMinutes 会限制活动数量：小容量活动更少且承诺不超容量", () => {
  const small = planner.plan(genericInput({ weeklyMinutes: 60 }));
  const large = planner.plan(genericInput({ weeklyMinutes: 240 }));
  assert.ok(small.weeklyPlan.totalMinutes <= 60, `小容量承诺 ${small.weeklyPlan.totalMinutes} 不应超 60`);
  assert.ok(large.weeklyPlan.totalMinutes <= 240, `大容量承诺 ${large.weeklyPlan.totalMinutes} 不应超 240`);
  assert.ok(
    large.weeklyPlan.coreActivityCount > small.weeklyPlan.coreActivityCount,
    `大容量核心活动应更多：${large.weeklyPlan.coreActivityCount} vs ${small.weeklyPlan.coreActivityCount}`,
  );
  assert.ok(
    large.weeklyPlan.activities.length > small.weeklyPlan.activities.length,
    "大容量活动总数应更多",
  );
});

// ── 5. selfReport 高的能力会后置或跳过基础活动 ──────────

test("selfReport 达标的能力不进周计划（satisfied 标记）；有基础未达标跳过基础活动", () => {
  // audience 自评 2（targetLevel 2 → 达标）；structure 自评 1（有基础未达标）
  const plan = planner.plan(
    genericInput({
      selfReport: { "pub.audience": 2, "pub.structure": 1 },
    }),
  );
  const audience = plan.orderedCapabilities.find((n) => n.capabilityId === "pub.audience")!;
  assert.equal(audience.satisfied, true, "自评达标的 audience 应标记 satisfied");
  assert.ok(
    !plan.weeklyPlan.activities.some((a) => a.capabilityId === "pub.audience"),
    "audience 不应出现在本周活动",
  );
  assert.ok(
    !plan.activities.some((a) => a.capabilityId === "pub.audience"),
    "audience 不应有活动草稿",
  );
  // structure：跳过建立模型/示范，直接从独立练习开始
  const structureActivities = plan.weeklyPlan.activities.filter((a) => a.capabilityId === "pub.structure");
  assert.ok(structureActivities.length >= 1, "structure 应有本周活动");
  assert.ok(
    structureActivities.every((a) => a.activityType !== "build_model" && a.activityType !== "follow_demo"),
    "有基础的能力应跳过建立模型与示范",
  );
  // 已满足的能力保留在路线中（上下文），只是被后置/跳过
  assert.ok(plan.route.nodeIds.includes("pub.audience"));
});

// ── 6. 前置未满足的能力不进首周 ─────────────────────────

test("前置未满足的能力不出现在首周活动", () => {
  const plan = planner.plan(genericInput({ selfReport: {} }));
  const weekCapabilityIds = plan.weeklyPlan.activities.map((a) => a.capabilityId);
  assert.ok(weekCapabilityIds.includes("pub.audience"), "无前置的 audience 应可排");
  for (const id of ["pub.structure", "pub.delivery", "pub.qa"]) {
    assert.ok(!weekCapabilityIds.includes(id), `${id} 前置未满足不应进入首周`);
  }
});

// ── 7. 确定性：同输入同输出 ─────────────────────────────

test("确定性：相同输入产生相同输出（含 seed 语义）", () => {
  const a = planner.plan(genericInput({ seed: 42 }));
  const b = planner.plan(genericInput({ seed: 42 }));
  assert.deepEqual(a, b);
  const c = planner.plan(genericInput());
  assert.deepEqual(a.route, c.route);
  assert.deepEqual(a.weeklyPlan, c.weeklyPlan);
});

// ── 8. preference：build_first 走目标闭包，无关能力不进路线 ──

test("build_first：路线 = 目标 + 前置闭包，无关能力不进路线", () => {
  const plan = planner.plan(
    genericInput({
      goalAnalysis: { goal: "学会公开演讲并应对提问", targetCapabilityIds: ["pub.qa"], depth: 3 },
      preference: "build_first",
    }),
  );
  assert.deepEqual(
    plan.route.nodeIds.slice().sort(),
    ["pub.audience", "pub.structure", "pub.delivery", "pub.qa"].sort(),
    "应只含目标及其前置闭包",
  );
  assert.ok(!plan.route.nodeIds.includes("pub.storytelling"), "无关能力（storytelling）不应进入路线");
});

// ── 9. 能力图校验 ──────────────────────────────────────

test("validateCapabilityMap：重复 ID 与前置环抛错", () => {
  assert.throws(
    () =>
      validateCapabilityMap({
        version: "1",
        capabilities: [
          { id: "a", title: "A", description: "", targetLevel: 2, isMilestone: false, signals: ["x"] },
          { id: "a", title: "A2", description: "", targetLevel: 2, isMilestone: false, signals: ["x"] },
        ],
        edges: [],
      }),
    /重复/,
  );
  assert.throws(
    () =>
      validateCapabilityMap({
        version: "1",
        capabilities: [
          { id: "a", title: "A", description: "", targetLevel: 2, isMilestone: false, signals: ["x"] },
          { id: "b", title: "B", description: "", targetLevel: 2, isMilestone: false, signals: ["x"] },
        ],
        edges: [
          { from: "a", to: "b", relationType: "prerequisite" },
          { from: "b", to: "a", relationType: "prerequisite" },
        ],
      }),
    /环/,
  );
});

// ── 10. 信号化活动组合器：五阶段 + 补强 + 跳学 ───────────

test("composeAdaptiveActivity：五阶段草稿均由能力信号参数化", () => {
  const capability = {
    id: "pub.structure",
    title: "演讲结构",
    description: "组织开场-主体-收尾",
    signals: ["结构设计", "过渡衔接"],
  };
  for (const activityType of ["build_model", "follow_demo", "independent_practice", "integrated_task", "retest"] as const) {
    const draft = composeAdaptiveActivity({ capability, activityType, estimatedMinutes: 45 });
    assert.ok(draft.expectedEvidence.length > 0);
    assert.ok(draft.completionCriteria.length > 0);
    assert.equal(draft.completionCriteria, draft.evaluationCriteria);
    assert.ok(draft.steps.length >= 3);
  }
  // 信号进入证据要求
  const build = composeAdaptiveActivity({ capability, activityType: "build_model", estimatedMinutes: 45 });
  assert.ok(build.expectedEvidence.includes("结构设计"), "expectedEvidence 应引用能力信号");
  assert.ok(build.completionCriteria.includes("过渡衔接"), "completionCriteria 应引用能力信号");
});

test("composeAdaptiveActivity：补强（focusSignals）与跳学验证独立标记", () => {
  const capability = {
    id: "pub.delivery",
    title: "表达与节奏",
    description: "",
    signals: ["节奏控制", "临场应变"],
  };
  const boost = composeAdaptiveActivity({
    capability,
    activityType: "independent_practice",
    estimatedMinutes: 45,
    focusSignals: ["临场应变"],
  });
  assert.ok(boost.title.includes("补强练习"), `补强标题：${boost.title}`);
  assert.ok(boost.steps.some((s) => s.includes("临场应变")), "补强步骤应聚焦缺失信号");

  const skip = composeAdaptiveActivity({
    capability,
    activityType: "independent_practice",
    estimatedMinutes: 45,
    isSkipValidation: true,
  });
  assert.ok(skip.title.includes("跳学验证"), `跳学标题：${skip.title}`);
  assert.ok(skip.nextAdvice.includes("已验证"));

  const integrated = composeAdaptiveActivity({
    capability,
    activityType: "integrated_task",
    estimatedMinutes: 120,
    integrateCapabilityIds: ["pub.structure", "pub.delivery"],
  });
  assert.ok(integrated.goal.includes("2 个能力"), `情境应用整合计数：${integrated.goal}`);
});

// ── 11. 课程材料分析进入活动输入引用 ────────────────────

test("materials：覆盖目标能力的材料进入活动 inputRefs", () => {
  const plan = planner.plan(
    genericInput({
      materials: [
        { materialId: "mat-talk-guide", title: "演讲指南", coveredCapabilityIds: ["pub.audience", "pub.structure"] },
        { materialId: "mat-unrelated", title: "无关材料", coveredCapabilityIds: ["pub.storytelling"] },
      ],
    }),
  );
  const audienceDraft = plan.activities.find((a) => a.capabilityId === "pub.audience");
  assert.ok(audienceDraft, "应有 audience 活动");
  assert.ok(audienceDraft!.inputRefs.includes("mat-talk-guide"), "覆盖材料应进入 inputRefs");
  assert.ok(!audienceDraft!.inputRefs.includes("mat-unrelated"), "无关材料不应进入");
});
