// 应用层闭环测试：诊断 → 确认 → 活动 → 证据 → 评估 → 节点状态 → 调整
import test from "node:test";
import assert from "node:assert/strict";

import {
  LearningApplicationService,
  currentWeekKey,
} from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { createRuleAgents } from "../../lib/learning/agents/index.ts";

function createService() {
  return new LearningApplicationService(
    new InMemoryLearningStore(),
    createRuleAgents(),
  );
}

const OWNER = "test-owner";

test("空 workspace：新用户无状态", async () => {
  const service = createService();
  const ws = await service.getWorkspace(OWNER);
  assert.equal(ws.profile, null);
  assert.equal(ws.activities.length, 0);
  assert.equal(ws.nodeProgress.length, 0);
});

test("diagnostic 生成初始画像与推荐路线", async () => {
  const service = createService();
  const ws = await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学会用 AI 做知识问答应用",
    weeklyMinutes: 180,
    selfReport: { "ai-literacy.mechanism": 2 },
    preference: "build_first",
  });
  assert.ok(ws.profile, "应有画像");
  assert.equal(ws.profile.status, "proposed");
  assert.ok(ws.route, "应有推荐路线");
  assert.ok(ws.nodeProgress.length > 0, "应初始化节点进度");
});

test("confirm 后 workspace 能读到已确认计划和活动", async () => {
  const service = createService();
  await service.runDiagnostic({
    ownerId: OWNER,
    goal: "学 AI",
    weeklyMinutes: 180,
  });
  const ws = await service.confirmProposal(OWNER);
  assert.equal(ws.profile!.status, "confirmed");
  assert.ok(ws.weeklyPlan, "应有周计划");
  assert.equal(ws.weeklyPlan!.status, "confirmed");
  assert.equal(ws.weeklyPlan!.weekKey, currentWeekKey());
  assert.ok(ws.activities.length >= 1, `应有至少 1 个活动，实际 ${ws.activities.length}`);
  // 注：新用户严格前置下首周仅解锁无前置的起点节点（mechanism），
  // 其余节点需前置 validated 后才进入周计划候选。这符合"前置未满足不能进入"规则。
  // 活动都有完整结构
  for (const a of ws.activities) {
    assert.ok(a.goal.length > 0);
    assert.ok(a.steps.length > 0);
    assert.ok(a.evaluationCriteria.length > 0);
    assert.ok(a.expectedEvidence.length > 0);
  }
});

test("workspace 暴露内容判断、本周行动卡、概念提示和学习产出读模型", async () => {
  const service = createService();
  await service.runDiagnostic({
    ownerId: OWNER,
    goal: "建立 AI PM 入门判断框架，能拆一个 AI Agent 产品场景",
    weeklyMinutes: 180,
    materialIds: ["res.gml-crash-course", "res.openai-evals"],
    preference: "breadth_first",
  });
  const ws = await service.confirmProposal(OWNER);

  assert.ok(ws.contentJudgment.length > 0, "应返回内容判断");
  assert.ok(ws.contentJudgment.some((judgment) => judgment.role === "本周主线"), "本周材料应被标记为主线");
  assert.ok(
    ws.contentJudgment.every((judgment) => judgment.professionalVerdict && judgment.fitVerdict),
    "材料判断应包含专业性和阶段适配",
  );
  assert.ok(ws.courseSlices.length > 0, "应返回课程切片");
  assert.ok(ws.courseSlices.some((slice) => slice.entersCurrentWeek && slice.role === "本周主线"), "应有本周必看的课程切片");
  assert.ok(
    ws.courseSlices.some((slice) => !slice.entersCurrentWeek),
    "应保留后续、参考或跳过片段，而不是把整门课塞进本周",
  );
  assert.ok(
    ws.courseSlices.every((slice) => slice.sourceRange && slice.afterWatchingPrompt && slice.learnerAction),
    "课程切片应说明看哪段、看完回答什么、做什么",
  );

  assert.ok(ws.weeklyActionPlan.length > 0, "应返回本周行动卡");
  assert.ok(ws.nextAction, "应给出本次最小推进");
  assert.ok(
    ws.weeklyActionPlan.some((card) => /先搞懂|看例子|做一版|判断题/.test(card.title)),
    "行动卡标题应表达学习节奏，而不是只重复节点名",
  );
  const mainCards = ws.weeklyActionPlan.filter((card) => card.tier === "主推进");
  assert.ok(mainCards.length <= 4, "3 小时小周最多展示 4 张主推进卡");
  assert.equal(ws.weeklyActionPlan[0]?.tier, "主推进", "本周行动卡应优先呈现主推进");
  for (const card of ws.weeklyActionPlan) {
    assert.ok(card.estimatedMinutes >= 30, "行动卡最小 30 分钟");
    assert.equal(card.estimatedMinutes % 15, 0, "行动卡按 15 分钟递增");
    assert.ok(card.materialSlice.length > 0, "行动卡应说明只看哪段材料");
    assert.ok(card.courseSliceIds.length > 0, "行动卡应绑定具体课程切片");
    assert.ok(card.nextIfStuck.length > 0, "行动卡应有卡住时缩小策略");
  }

  const scenarioCard = ws.weeklyActionPlan.find((card) => card.scenarioQuestion);
  assert.ok(scenarioCard?.scenarioQuestion, "至少一个行动卡应提供轻量情景判断");
  assert.equal(scenarioCard.scenarioQuestion.options.length, 4, "情景判断用四个选择降低启动成本");
  assert.ok(
    scenarioCard.scenarioQuestion.options.every((option) => option.text.length >= 50),
    "情景判断选项应保留足够上下文，不让用户从零组织表达",
  );
  assert.ok(ws.conceptHints.length > 0, "应返回可点开的概念解释");

  const activity = ws.activities.find((item) => item.id === scenarioCard.activityId)!;
  await service.startActivity(OWNER, activity.id);
  const ws2 = await service.submitEvidence(OWNER, activity.id, {
    evidenceType: "judgment",
    content:
      "情景判断：我能判断当前 AI Agent 场景先用规则流程还是模型自动化。" +
      "我会先确认用户任务是否高频、输入是否稳定、失败是否可兜底，" +
      "再决定能力边界、人工确认点和评测方式。",
  });
  const evidence = ws2.evidence.find((item) => item.activityId === activity.id)!;
  const { workspace: reviewed } = await service.reviewEvidence(OWNER, evidence.id);
  assert.ok(
    reviewed.learningOutputs.some((output) => output.kind === "判断记录" && output.sourceActionId === activity.id),
    "通过或退回的判断应进入学习产出轨迹",
  );
});

test("刷新不重排：重复 confirm 幂等，周计划不变", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const before = await service.getWorkspace(OWNER);
  // 再次 confirm 应抛错（已确认）
  await assert.rejects(() => service.confirmProposal(OWNER), /已确认/);
  const after = await service.getWorkspace(OWNER);
  assert.deepEqual(
    before.activities.map((a) => a.id),
    after.activities.map((a) => a.id),
    "活动不应变化",
  );
});

test("完整闭环：活动开始 → 证据提交 → 评估 → 节点成长", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;

  // 1. 开始活动
  const ws1 = await service.startActivity(OWNER, activity.id);
  const started = ws1.activities.find((a) => a.id === activity.id)!;
  assert.equal(started.status, "in_progress");
  const nodeProgress = ws1.nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.equal(nodeProgress.status, "growing", "开始活动节点应进入成长中");

  // 2. 提交证据
  const ws2 = await service.submitEvidence(OWNER, activity.id, {
    content:
      "模型从数据中学习模式而不是保存事实，生成是在上下文中预测后续内容。" +
      "训练时调整参数，推理时根据概率输出。流畅自信与正确是不同的事，" +
      "幻觉说明概率性输出的边界，泛化依赖训练数据分布。",
  });
  const ev2 = ws2.evidence.find((e) => e.activityId === activity.id)!;
  assert.ok(ev2, "应有证据");
  assert.equal(ev2.status, "submitted");

  // 3. 评估证据（规则版，足量证据 accepted）
  const { workspace: ws3, assessment } = await service.reviewEvidence(OWNER, ev2.id);
  assert.equal(assessment.verdict, "accepted");
  const ev3 = ws3.evidence.find((e) => e.id === ev2.id)!;
  assert.equal(ev3.status, "accepted");
  assert.notEqual(ev3.reviewJson, "{}");
  const persistedReview = JSON.parse(ev3.reviewJson);
  assert.equal(persistedReview.evidenceId, ev2.id);
  assert.ok(Array.isArray(persistedReview.dimensionScores));
  const act3 = ws3.activities.find((a) => a.id === activity.id)!;
  assert.equal(act3.status, "completed", "评估通过后活动完成");

  // 4. 节点状态由证据驱动
  const np3 = ws3.nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.ok(["growing", "validated"].includes(np3.status));
  assert.ok(np3.supportingEvidenceIds.includes(ev2.id), "证据应记录到节点");

  // 5. workspace 恢复：全部状态可读
  const wsFinal = await service.getWorkspace(OWNER);
  assert.equal(wsFinal.evidence.find((e) => e.id === ev2.id)!.status, "accepted");
});

test("不足证据 needs_revision：节点不验证、活动退回", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;

  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "太短。" });
  const ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const { workspace: ws, assessment } = await service.reviewEvidence(OWNER, ev.id);

  assert.equal(assessment.verdict, "needs_revision");
  assert.equal(ws.evidence.find((e) => e.id === ev.id)!.status, "needs_revision");
  const act = ws.activities.find((a) => a.id === activity.id)!;
  assert.equal(act.status, "in_progress", "证据退回后活动回到进行中");
  const np = ws.nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.notEqual(np.status, "validated", "证据退回节点不得验证");
  // 应有调整建议（proposed）
  assert.ok(ws.adjustments.length >= 1, "应有调整记录");
  // 契约：workspace 返回结构化缺口信号（transient 派生，不落库）
  const proposed = ws.adjustments.find((a) => a.status === "proposed");
  assert.ok(proposed, "应有待确认调整建议");
  assert.ok(Array.isArray(proposed!.missingSignals), "missingSignals 应为数组");
  assert.ok(proposed!.missingSignals!.length > 0, "应派生缺失信号");
  const missingLabels = assessment.signalReviews
    .filter((s) => s.status === "missing")
    .map((s) => s.label);
  assert.ok(
    proposed!.missingSignals!.every((label) => missingLabels.includes(label)),
    "派生缺口信号应来自评审结果",
  );
  assert.ok(Array.isArray(proposed!.partialSignals), "partialSignals 应为数组");
  // 契约：actionJson 在 runtime payload 中可用（结构化动作，前端不再解析 reason 判断）
  assert.equal(typeof proposed!.actionJson, "string");
  const actions = JSON.parse(proposed!.actionJson);
  assert.ok(Array.isArray(actions) && actions.some((x) => x.action === "insert_activity"));
});

test("重复退回：同节点第二次 needs_revision 升级建议并 supersede 旧建议", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const activity = (await service.getWorkspace(OWNER)).activities.find((a) => a.status === "planned")!;

  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "第一次证据内容很空泛，只说我学了但没有解释概念、机制、边界，也没有任何判断标准。" });
  const ev1 = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const ws1 = await service.reviewEvidence(OWNER, ev1.id).then((result) => result.workspace);
  const first = ws1.adjustments.find((a) => a.status === "proposed" && a.adjustmentType === "activity_replan")!;
  assert.ok(first, "第一次退回应生成 proposed activity_replan");

  await service.submitEvidence(OWNER, activity.id, { content: "第二次仍然空泛，只说已经理解 AI，但没有训练机制解释、幻觉风险识别、泛化边界说明。" });
  const ev2 = (await service.getWorkspace(OWNER)).evidence
    .filter((e) => e.activityId === activity.id)
    .find((e) => e.id !== ev1.id)!;
  const ws2 = await service.reviewEvidence(OWNER, ev2.id).then((result) => result.workspace);
  const second = ws2.adjustments.find((a) =>
    a.id !== first.id &&
    a.status === "proposed" &&
    a.adjustmentType === "activity_replan",
  );
  assert.ok(second, "第二次退回应生成新的 proposed activity_replan");
  assert.ok(second!.reason.includes("第 2 次未通过"), second!.reason);
  assert.ok(second!.reason.includes("反复缺失"), second!.reason);
  assert.equal(
    ws2.adjustments.find((a) => a.id === first.id)!.status,
    "superseded",
    "同节点新建议产生后旧 proposed 应被 superseded",
  );
});

test("跳学：生成验证活动，前置缺口拒绝", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);

  // 无前置的节点可跳学
  const ws = await service.skipNode(OWNER, "ai-literacy.mechanism");
  const skipActivity = ws.activities.find((a) => a.isSkipValidation);
  assert.ok(skipActivity, "应生成跳学验证活动");
  assert.equal(
    ws.nodeProgress.find((p) => p.nodeId === "ai-literacy.mechanism")!.status,
    "growing",
    "跳学节点进入待验证",
  );

  // 有前置缺口（fit 的前置 mechanism 未验证）不允许跳学
  await assert.rejects(
    () => service.skipNode(OWNER, "ai-literacy.fit"),
    /前置未满足/,
  );
});

test("调整建议确认：proposed → accepted", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;

  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  const ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);

  const ws1 = await service.getWorkspace(OWNER);
  const adjustment = ws1.adjustments.find((a) => a.status === "proposed");
  assert.ok(adjustment, "应有待确认调整建议");
  const beforeActivityCount = ws1.activities.length;
  const ws2 = await service.confirmAdjustment(OWNER, adjustment!.id);
  assert.equal(
    ws2.adjustments.find((a) => a.id === adjustment!.id)!.status,
    "accepted",
  );
  assert.ok(
    ws2.activities.length > beforeActivityCount,
    "确认调整建议后应插入补强活动",
  );
  assert.ok(
    ws2.activities.some((a) => a.title.startsWith("补强活动：") && a.isCore === false),
    "补强活动应作为非核心活动插入本周计划",
  );
});

test("调整建议忽略：proposed → rejected，且不执行补强动作", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;

  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  const ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);

  const ws1 = await service.getWorkspace(OWNER);
  const adjustment = ws1.adjustments.find((a) => a.status === "proposed");
  assert.ok(adjustment, "应有待忽略的调整建议");
  const beforeActivityCount = ws1.activities.length;

  const ws2 = await service.rejectAdjustment(OWNER, adjustment!.id);
  assert.equal(
    ws2.adjustments.find((a) => a.id === adjustment!.id)!.status,
    "rejected",
  );
  assert.equal(
    ws2.activities.length,
    beforeActivityCount,
    "忽略调整建议不应插入补强活动",
  );
});

test("重复提交证据：同一活动第二次提交仍合法（新证据）", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "第一次证据。" });
  // 活动已 evidence_submitted，不能再次提交（应抛错或幂等）
  await assert.rejects(
    () => service.submitEvidence(OWNER, activity.id, { content: "第二次。" }),
  );
});

test("Phase 4 闭环：退回 → 修订重新提交 → 接受 → 节点验证", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  const nodeId = activity.nodeId;

  // 1. 开始 → 提交不足证据 → 退回
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "太短。" });
  let ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const { workspace: ws1, assessment } = await service.reviewEvidence(OWNER, ev.id);
  assert.equal(assessment.verdict, "needs_revision");
  assert.equal(ws1.evidence.find((e) => e.id === ev.id)!.status, "needs_revision");
  assert.equal(ws1.activities.find((a) => a.id === activity.id)!.status, "in_progress");
  assert.notEqual(
    ws1.nodeProgress.find((p) => p.nodeId === nodeId)!.status,
    "validated",
    "退回时节点不得验证",
  );

  // 2. 修订：重新提交足量证据（活动回到 in_progress 后允许再次提交）
  await service.submitEvidence(OWNER, activity.id, {
    content:
      "模型从数据中学习模式而不是保存事实，生成是在上下文中预测后续内容。" +
      "训练时调整参数，推理时根据概率输出。流畅自信与正确是不同的事，" +
      "幻觉说明概率性输出的边界，泛化依赖训练数据分布。",
  });
  ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id && e.status === "submitted")!;
  assert.ok(ev, "修订后应有新证据进入待评估");

  // 3. 重新评估 → 接受 → 活动完成 → 节点验证
  const { workspace: ws2, assessment: a2 } = await service.reviewEvidence(OWNER, ev.id);
  assert.equal(a2.verdict, "accepted");
  assert.equal(ws2.evidence.find((e) => e.id === ev.id)!.status, "accepted");
  assert.equal(ws2.activities.find((a) => a.id === activity.id)!.status, "completed");
  const np = ws2.nodeProgress.find((p) => p.nodeId === nodeId)!;
  assert.equal(np.status, "validated", "证据接受后节点由证据驱动验证");
  assert.ok(np.supportingEvidenceIds.includes(ev.id), "验证证据可追溯");
});

test("重排本周：保留已产生证据和节点状态，只替换开放活动", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 360 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  const originalActivityIds = ws0.activities.map((a) => a.id);

  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, {
    content:
      "模型从数据中学习模式而不是保存事实，生成是在上下文中预测后续内容。" +
      "训练时调整参数，推理时根据概率输出。流畅自信与正确是不同的事，" +
      "幻觉说明概率性输出的边界，泛化依赖训练数据分布。",
  });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);

  const ws1 = await service.replanCurrentWeek(OWNER, { weeklyMinutes: 480 });
  assert.equal(ws1.weeklyPlan!.capacityMinutes, 480);
  assert.ok(
    ws1.evidence.some((e) => e.id === evidence.id && e.status === "accepted"),
    "已接受证据应保留",
  );
  assert.equal(
    ws1.nodeProgress.find((p) => p.nodeId === activity.nodeId)!.status,
    "validated",
    "节点验证状态应保留",
  );
  assert.ok(
    ws1.activities.some((a) => a.id === activity.id),
    "已产生证据的活动应保留以保持追溯",
  );
  assert.ok(
    ws1.activities.some((a) => !originalActivityIds.includes(a.id)),
    "应生成新的本周活动",
  );
  assert.ok(
    ws1.adjustments.some((a) => a.adjustmentType === "activity_replan" && a.status === "accepted"),
    "重排应留下已确认调整记录",
  );
});

test("Proposal/Adjustment：确认建议插入补强活动，原证据与活动仍可追溯", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  const nodeId = activity.nodeId;

  // 不足证据 → needs_revision → 待确认调整建议（含 insert_activity 补强动作）
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "我学了一点概念，模型从数据中学习。" });
  const ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);
  const ws1 = await service.getWorkspace(OWNER);
  const adjustment = ws1.adjustments.find((a) => a.status === "proposed");
  assert.ok(adjustment, "证据退回应生成待确认调整建议");

  // 确认 → accepted + 插入补强活动（非核心、指向原节点）
  const ws2 = await service.confirmAdjustment(OWNER, adjustment!.id);
  assert.equal(ws2.adjustments.find((a) => a.id === adjustment!.id)!.status, "accepted");
  const boost = ws2.activities.find((a) => a.title.startsWith("补强活动："));
  assert.ok(boost, "确认后应插入补强活动");
  assert.equal(boost!.nodeId, nodeId);
  assert.equal(boost!.isCore, false);
  assert.equal(boost!.status, "planned");

  // 原证据仍可追溯（needs_revision 记录保留，未被覆盖）
  assert.ok(ws2.evidence.some((e) => e.id === ev.id && e.status === "needs_revision"), "原证据记录应保留");
  // 原活动仍可追溯（不被清理）
  assert.ok(ws2.activities.some((a) => a.id === activity.id), "原活动应保留以保持追溯");
  // 节点未被错误验证
  assert.notEqual(ws2.nodeProgress.find((p) => p.nodeId === nodeId)!.status, "validated");
});

// ── Proposal / Adjustment Engine：未被既有用例覆盖的闭环路径 ──────────
// 既有用例覆盖：needs_revision → proposed 契约、确认插补强活动、忽略不执行、
// 复测降级。此处补充：证据通过不产生补强建议（含 weekly_light 确认的
// continue 语义）、用户主动提议的确认/忽略闭环（空 actionJson 容错）。

test("证据通过：不产生补强类调整建议；weekly_light 确认不改变计划", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, {
    content: "训练机制解释：模型从大量数据中学习统计规律而非存储事实。概率推理说明：输出按概率分布采样，流畅不等于正确。幻觉风险识别：幻觉来自训练数据覆盖不足。泛化边界说明：泛化依赖训练数据分布，超出分布会失败。AI 与普通程序区分：普通程序按规则执行，AI 从数据学习。判断标准可操作：需要快速推理时适合用 AI，精确计算与隐私场景不适用。概念解释：机制、边界与失效条件都已说清。解释覆盖机制与边界，关系图包含至少 2 个相邻概念。",
  });
  const ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const ws1 = await service.reviewEvidence(OWNER, ev.id).then((r) => r.workspace);
  assert.equal(ws1.evidence.find((e) => e.id === ev.id)!.status, "accepted", "证据应通过");
  // 通过场景不应产生补强/重排建议（只有完成率偏低时的 weekly_light 允许存在）
  assert.equal(
    ws1.adjustments.filter((a) => a.adjustmentType === "activity_replan").length,
    0,
    "证据通过不应产生 activity_replan 建议",
  );
  // weekly_light（continue 语义）：确认后只记录状态，不插入活动
  const light = ws1.adjustments.find((a) => a.adjustmentType === "weekly_light" && a.status === "proposed");
  if (light) {
    const before = ws1.activities.length;
    const ws2 = await service.confirmAdjustment(OWNER, light.id);
    assert.equal(ws2.adjustments.find((a) => a.id === light.id)!.status, "accepted");
    assert.equal(ws2.activities.length, before, "weekly_light 确认不应插入活动");
  }
});

test("用户主动提议 route_revision：确认后 accepted，空动作不插入活动", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws1 = await service.proposeAdjustment(OWNER, {
    adjustmentType: "route_revision",
    reason: "想切换路线到 AI 应用开发",
  });
  const proposed = ws1.adjustments.find((a) => a.adjustmentType === "route_revision" && a.status === "proposed");
  assert.ok(proposed, "应有待确认的路线调整建议");
  assert.equal(proposed!.actionJson, "[]", "主动提议应无结构化动作");
  const before = ws1.activities.length;
  const ws2 = await service.confirmAdjustment(OWNER, proposed!.id);
  assert.equal(ws2.adjustments.find((a) => a.id === proposed!.id)!.status, "accepted");
  assert.equal(ws2.activities.length, before, "确认主动提议不应插入活动");
  assert.equal(ws2.nextStagePlan, null, "普通 route_revision 不生成作品集下一阶段");
});

test("用户主动提议 route_revision：忽略后 rejected", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws1 = await service.proposeAdjustment(OWNER, {
    adjustmentType: "route_revision",
    reason: "想切换路线到 AI 应用开发",
  });
  const proposed = ws1.adjustments.find((a) => a.adjustmentType === "route_revision" && a.status === "proposed")!;
  const ws2 = await service.rejectAdjustment(OWNER, proposed.id);
  assert.equal(ws2.adjustments.find((a) => a.id === proposed.id)!.status, "rejected");
  assert.equal(ws2.activities.length, ws1.activities.length, "忽略主动提议不应改变计划");
});

// ── v0.3-beta 服务层推导：failureCount / isRetestFailure / lastMissingSignals / supersede ──
// advisor 侧文案由 agents.test.ts 单测覆盖；此处验证服务层在 reviewEvidence 中
// 正确推导历史上下文并传入 advisor，以及 supersede 的保守执行。

test("同一节点第二次 needs_revision：新建议 reason 含「第 2 次未通过」", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  // 第一次：短证据 → needs_revision（failureCount=1）
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  let ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);
  // 第二次：仍不足 → needs_revision（服务层应推导 failureCount=2）
  await service.submitEvidence(OWNER, activity.id, { content: "模型很厉害，能回答很多问题。" });
  ev = (await service.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === activity.id).at(-1)!;
  const ws2 = await service.reviewEvidence(OWNER, ev.id).then((r) => r.workspace);
  const second = ws2.adjustments.filter((a) => a.status === "proposed").at(-1);
  assert.ok(second, "第二次失败应产生新建议");
  assert.ok(
    second!.reason.includes("第 2 次未通过"),
    `reason 应含第 2 次未通过：${second!.reason}`,
  );
});

test("第二次缺同一信号：新建议 reason 含「反复缺失」", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  // 两次都覆盖不足且刻意缺「幻觉风险识别」
  const weak1 = "训练机制解释：模型从数据中学习。概率推理说明：输出按概率分布采样。";
  const weak2 = "训练机制解释：模型从数据中学习。概率推理说明：输出按概率分布采样。泛化边界说明：超出分布会失败。";
  await service.submitEvidence(OWNER, activity.id, { content: weak1 });
  let ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);
  await service.submitEvidence(OWNER, activity.id, { content: weak2 });
  ev = (await service.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === activity.id).at(-1)!;
  const ws2 = await service.reviewEvidence(OWNER, ev.id).then((r) => r.workspace);
  const second = ws2.adjustments.filter((a) => a.status === "proposed").at(-1);
  assert.ok(second, "第二次失败应产生新建议");
  assert.ok(
    second!.reason.includes("反复缺失"),
    `reason 应含反复缺失：${second!.reason}`,
  );
});

test("复测证据退回：新建议 reason 含「复测未通过」", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 360 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  // 先验证通过（普通活动 accepted 自动验证），才能发起复测
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, {
    content: "训练机制解释：模型从大量数据中学习统计规律而非存储事实。概率推理说明：输出按概率分布采样，流畅不等于正确。幻觉风险识别：幻觉来自训练数据覆盖不足。泛化边界说明：泛化依赖训练数据分布，超出分布会失败。AI 与普通程序区分：普通程序按规则执行，AI 从数据学习。判断标准可操作：需要快速推理时适合用 AI，精确计算与隐私场景不适用。概念解释：机制、边界与失效条件都已说清。解释覆盖机制与边界，关系图包含至少 2 个相邻概念。",
  });
  let ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);
  const ws1 = await service.getWorkspace(OWNER);
  assert.equal(ws1.nodeProgress.find((p) => p.nodeId === activity.nodeId)!.status, "validated", "普通活动证据通过应验证节点");
  // 发起复测 → 复测活动 → 提交不足证据 → 复测失败
  const wsRetest = await service.retestNode(OWNER, activity.nodeId);
  const retestActivity = wsRetest.activities.find((a) => a.activityType === "retest" && a.nodeId === activity.nodeId)!;
  await service.startActivity(OWNER, retestActivity.id);
  await service.submitEvidence(OWNER, retestActivity.id, { content: "短。" });
  ev = (await service.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === retestActivity.id).at(-1)!;
  const ws2 = await service.reviewEvidence(OWNER, ev.id).then((r) => r.workspace);
  // 完成率低会额外产生 weekly_light，需精确匹配复测失败对应的 activity_replan
  const suggestion = ws2.adjustments.filter((a) => a.adjustmentType === "activity_replan" && a.status === "proposed").at(-1);
  assert.ok(suggestion, "复测失败应产生 activity_replan 调整建议");
  assert.ok(
    suggestion!.reason.includes("复测未通过"),
    `reason 应含复测未通过：${suggestion!.reason}`,
  );
});

test("新建议产生后：同节点旧 proposed 被 superseded", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const activity = ws0.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  let ev = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, ev.id);
  const ws1 = await service.getWorkspace(OWNER);
  const first = ws1.adjustments.filter((a) => a.adjustmentType === "activity_replan" && a.status === "proposed").at(-1)!;
  assert.ok(first, "第一次失败应有 activity_replan 建议");
  // 第二次失败 → 新建议 → 旧 proposed 应被 superseded
  await service.submitEvidence(OWNER, activity.id, { content: "模型很厉害。" });
  ev = (await service.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === activity.id).at(-1)!;
  const ws2 = await service.reviewEvidence(OWNER, ev.id).then((r) => r.workspace);
  const second = ws2.adjustments.filter((a) => a.adjustmentType === "activity_replan" && a.status === "proposed").at(-1)!;
  assert.ok(second, "第二次失败应有新 activity_replan 建议");
  assert.notEqual(second.id, first.id, "新旧建议 id 应不同");
  assert.equal(
    ws2.adjustments.find((a) => a.id === first.id)!.status,
    "superseded",
    "同节点旧 proposed 应被取代",
  );
  assert.equal(
    ws2.adjustments.find((a) => a.id === second.id)!.status,
    "proposed",
    "新建议保持待确认",
  );
});

test("accepted/rejected 旧建议不被 supersede", async () => {
  // accepted 路径
  const serviceA = createService();
  await serviceA.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await serviceA.confirmProposal(OWNER);
  const wsA0 = await serviceA.getWorkspace(OWNER);
  const activityA = wsA0.activities.find((a) => a.status === "planned")!;
  await serviceA.startActivity(OWNER, activityA.id);
  await serviceA.submitEvidence(OWNER, activityA.id, { content: "短。" });
  let evA = (await serviceA.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activityA.id)!;
  await serviceA.reviewEvidence(OWNER, evA.id);
  const wsA1 = await serviceA.getWorkspace(OWNER);
  const firstA = wsA1.adjustments.filter((a) => a.adjustmentType === "activity_replan" && a.status === "proposed").at(-1)!;
  await serviceA.confirmAdjustment(OWNER, firstA.id);
  await serviceA.submitEvidence(OWNER, activityA.id, { content: "模型很厉害。" });
  evA = (await serviceA.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === activityA.id).at(-1)!;
  const wsA2 = await serviceA.reviewEvidence(OWNER, evA.id).then((r) => r.workspace);
  assert.equal(
    wsA2.adjustments.find((a) => a.id === firstA.id)!.status,
    "accepted",
    "accepted 旧建议不应被 supersede",
  );

  // rejected 路径
  const serviceB = createService();
  await serviceB.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await serviceB.confirmProposal(OWNER);
  const wsB0 = await serviceB.getWorkspace(OWNER);
  const activityB = wsB0.activities.find((a) => a.status === "planned")!;
  await serviceB.startActivity(OWNER, activityB.id);
  await serviceB.submitEvidence(OWNER, activityB.id, { content: "短。" });
  let evB = (await serviceB.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activityB.id)!;
  await serviceB.reviewEvidence(OWNER, evB.id);
  const wsB1 = await serviceB.getWorkspace(OWNER);
  const firstB = wsB1.adjustments.filter((a) => a.adjustmentType === "activity_replan" && a.status === "proposed").at(-1)!;
  await serviceB.rejectAdjustment(OWNER, firstB.id);
  await serviceB.submitEvidence(OWNER, activityB.id, { content: "模型很厉害。" });
  evB = (await serviceB.getWorkspace(OWNER)).evidence.filter((e) => e.activityId === activityB.id).at(-1)!;
  const wsB2 = await serviceB.reviewEvidence(OWNER, evB.id).then((r) => r.workspace);
  assert.equal(
    wsB2.adjustments.find((a) => a.id === firstB.id)!.status,
    "rejected",
    "rejected 旧建议不应被 supersede",
  );
});

test("采纳 weekly_light（无动作）：不插活动，rationale 追加采纳说明", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const rationaleBefore = ws0.weeklyPlan!.rationale;
  const activityCountBefore = ws0.activities.length;

  // 用户主动提出节奏微调 → weekly_light proposed，actionJson 为空
  await service.proposeAdjustment(OWNER, { adjustmentType: "weekly_light", reason: "本周想放慢节奏" });
  const ws1 = await service.getWorkspace(OWNER);
  const adjustment = ws1.adjustments.find((a) => a.adjustmentType === "weekly_light" && a.status === "proposed")!;
  assert.ok(adjustment, "应有待确认的 weekly_light 建议");

  const ws2 = await service.confirmAdjustment(OWNER, adjustment.id);
  // 状态 accepted
  assert.equal(ws2.adjustments.find((a) => a.id === adjustment.id)!.status, "accepted");
  // 不插入活动、不删除活动
  assert.equal(ws2.activities.length, activityCountBefore, "weekly_light 采纳不应插入活动");
  assert.ok(ws2.activities.every((a) => ws0.activities.some((b) => b.id === a.id)), "不应删除已有活动");
  // rationale 可观察变化：追加采纳说明
  assert.notEqual(ws2.weeklyPlan!.rationale, rationaleBefore);
  assert.ok(ws2.weeklyPlan!.rationale.includes("已采纳节奏微调"), ws2.weeklyPlan!.rationale);
  assert.ok(ws2.weeklyPlan!.rationale.includes(adjustment.summary), "应包含建议摘要");
});

test("采纳 route_revision（空动作）：不插活动，rationale 不变", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const ws0 = await service.getWorkspace(OWNER);
  const rationaleBefore = ws0.weeklyPlan!.rationale;
  const activityCountBefore = ws0.activities.length;

  await service.proposeAdjustment(OWNER, { adjustmentType: "route_revision", reason: "想换方向" });
  const ws1 = await service.getWorkspace(OWNER);
  const adjustment = ws1.adjustments.find((a) => a.adjustmentType === "route_revision" && a.status === "proposed")!;
  assert.ok(adjustment, "应有待确认的 route_revision 建议");

  const ws2 = await service.confirmAdjustment(OWNER, adjustment.id);
  assert.equal(ws2.adjustments.find((a) => a.id === adjustment.id)!.status, "accepted");
  assert.equal(ws2.activities.length, activityCountBefore, "空动作不插活动");
  assert.equal(ws2.weeklyPlan!.rationale, rationaleBefore, "route_revision 不改 rationale");
});

test("workspace 返回周复盘：汇总完成、证据、修订和下一步", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const activity = (await service.getWorkspace(OWNER)).activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const ws = await service.reviewEvidence(OWNER, evidence.id).then((result) => result.workspace);

  assert.ok(ws.weekReview, "workspace 应返回周复盘");
  assert.equal(ws.weekReview!.revisionCount, 1);
  assert.equal(ws.weekReview!.nextWeekProposal.canGenerate, true);
  assert.ok(ws.weekReview!.nextBestMove.includes("修订"), ws.weekReview!.nextBestMove);
});

test("生成下周计划：保留本周证据与作品版本，不清空当前周状态", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const activity = (await service.getWorkspace(OWNER)).activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, {
    content: "训练机制解释：模型从大量数据中学习统计规律而非存储事实。概率推理说明：输出按概率分布采样，流畅不等于正确。幻觉风险识别：幻觉来自训练数据覆盖不足。泛化边界说明：泛化依赖训练数据分布，超出分布会失败。AI 与普通程序区分：普通程序按规则执行，AI 从数据学习。判断标准可操作：需要快速推理时适合用 AI，精确计算与隐私场景不适用。概念解释：机制、边界与失效条件都已说清。解释覆盖机制与边界，关系图包含至少 2 个相邻概念。",
  });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const before = await service.getWorkspace(OWNER);

  const after = await service.generateNextWeekPlan(OWNER);

  const currentWeek = await service.getWorkspace(OWNER, { weekKey: before.weeklyPlan!.weekKey });
  assert.equal(currentWeek.evidence.find((item) => item.id === evidence.id)!.status, "accepted");
  assert.equal(currentWeek.activities.find((item) => item.id === activity.id)!.status, "completed");
  assert.notEqual(after.weeklyPlan!.weekKey, before.weeklyPlan!.weekKey, "生成下周后应返回新周 workspace");
  assert.ok(after.weeklyPlanHistory.some((week) => week.weekKey === before.weeklyPlan!.weekKey && week.reviewArchivedAt));
  assert.ok(after.adjustments.some((item) => item.reason.includes("周复盘生成下一周计划")));
});

test("工作台资源进入当前阶段：映射节点后自动挂到同节点开放活动", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const activity = (await service.getWorkspace(OWNER)).activities.find((a) => a.status === "planned")!;

  const ws = await service.saveUserResource(OWNER, {
    type: "resource",
    title: "我的课程笔记",
    content: "这是一段用于当前节点的材料摘要。",
    relatedNodeIds: [activity.nodeId],
  });

  const resource = ws.userResources.find((item) => item.title === "我的课程笔记")!;
  assert.ok(resource.relatedNodeIds.includes(activity.nodeId));
  assert.ok(ws.activities.find((item) => item.id === activity.id)!.inputRefs.includes(resource.id));

  await service.saveUserResource(OWNER, {
    type: "resource",
    title: "我的课程笔记",
    content: "这是一段用于当前节点的材料摘要。",
    relatedNodeIds: [activity.nodeId],
  });
  const reread = await service.getWorkspace(OWNER);
  assert.equal(
    reread.contentJudgment.filter((judgment) => judgment.title === "我的课程笔记").length,
    1,
    "材料判断读模型应压掉同名同内容重复材料",
  );
});

test("Course Slicer v2：用户课程目录切成多段，少数进入本周，高阶片段跳过", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI PM", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const activity = (await service.getWorkspace(OWNER)).activities.find((a) => a.status === "planned")!;

  const ws = await service.saveUserResource(OWNER, {
    type: "resource",
    title: "AI PM 入门视频课目录",
    content: [
      "01. AI Agent 是什么：能力边界与失败场景",
      "02. 用户场景：从痛点到任务定义",
      "03. Eval metrics：怎么判断效果是否可上线",
      "04. Advanced deployment：多 Agent 架构与生产部署",
      "05. Fine-tuning benchmark：模型微调和数学证明",
    ].join("\n"),
    relatedNodeIds: [activity.nodeId],
  });

  const resource = ws.userResources.find((item) => item.title === "AI PM 入门视频课目录")!;
  const slices = ws.courseSlices.filter((slice) => slice.resourceId === resource.id);
  assert.ok(slices.length >= 5, "课程目录应被切成多个 slice");
  assert.ok(slices.filter((slice) => slice.role === "本周主线").length <= 2, "本周只采用少数关键片段");
  assert.ok(slices.some((slice) => slice.role === "暂不碰" && slice.difficulty === "偏难"), "高阶片段应先跳过");
  assert.ok(
    ws.weeklyActionPlan.some((card) => card.courseSliceIds.some((sliceId) => slices.some((slice) => slice.id === sliceId))),
    "行动卡应绑定用户课程切片",
  );
});

test("指定 weekKey 读取不同周：周历史聚合完成数和证据数", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const week1 = await service.getWorkspace(OWNER);
  const activity = week1.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, {
    content: "训练机制解释：模型从大量数据中学习统计规律而非存储事实。概率推理说明：输出按概率分布采样。幻觉风险识别：幻觉来自覆盖不足。泛化边界说明：超出分布会失败。AI 与普通程序区分：普通程序按规则执行，AI 从数据学习。判断标准可操作：需要快速推理时适合用 AI，精确计算与隐私场景不适用。概念解释完整，关系图包含相邻概念。",
  });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const week2 = await service.generateNextWeekPlan(OWNER, week1.weeklyPlan!.weekKey);

  const rereadWeek1 = await service.getWorkspace(OWNER, { weekKey: week1.weeklyPlan!.weekKey });
  const rereadWeek2 = await service.getWorkspace(OWNER, { weekKey: week2.weeklyPlan!.weekKey });

  assert.equal(rereadWeek1.weeklyPlan!.weekKey, week1.weeklyPlan!.weekKey);
  assert.equal(rereadWeek2.weeklyPlan!.weekKey, week2.weeklyPlan!.weekKey);
  assert.ok(rereadWeek1.weeklyPlanHistory.find((week) => week.weekKey === week1.weeklyPlan!.weekKey)!.acceptedEvidenceCount >= 1);
  assert.ok(rereadWeek2.activities.length > 0);
});

test("跨周活动操作返回活动所属周 workspace", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const week1 = await service.getWorkspace(OWNER);
  const firstActivity = week1.activities.find((item) => item.status === "planned")!;
  await service.startActivity(OWNER, firstActivity.id);
  await service.submitEvidence(OWNER, firstActivity.id, { content: "先提交一条短证据，用来触发本周复盘和下周计划。" });
  const firstEvidence = (await service.getWorkspace(OWNER)).evidence.find((item) => item.activityId === firstActivity.id)!;
  await service.reviewEvidence(OWNER, firstEvidence.id);
  const week2 = await service.generateNextWeekPlan(OWNER, week1.weeklyPlan!.weekKey);
  const activity = week2.activities.find((item) => item.status === "planned")!;

  const started = await service.startActivity(OWNER, activity.id);
  assert.equal(started.weeklyPlan!.weekKey, week2.weeklyPlan!.weekKey);

  const submitted = await service.submitEvidence(OWNER, activity.id, {
    content: "短证据也应留在第 2 周视角等待评审。",
  });
  assert.equal(submitted.weeklyPlan!.weekKey, week2.weeklyPlan!.weekKey);

  const evidence = submitted.evidence.find((item) => item.activityId === activity.id)!;
  const reviewed = await service.reviewEvidence(OWNER, evidence.id).then((result) => result.workspace);
  assert.equal(reviewed.weeklyPlan!.weekKey, week2.weeklyPlan!.weekKey);
});

test("周复盘归档：刷新后优先返回已归档复盘，可主动更新", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const week = await service.getWorkspace(OWNER);
  await service.archiveCurrentWeekReview(OWNER, week.weeklyPlan!.weekKey);
  const archived = await service.getWorkspace(OWNER, { weekKey: week.weeklyPlan!.weekKey });

  assert.ok(archived.weekReview!.archivedAt);
  assert.equal(archived.weekReview!.summary, week.weekReview!.summary);

  const activity = archived.activities.find((a) => a.status === "planned")!;
  await service.startActivity(OWNER, activity.id);
  const updated = await service.archiveCurrentWeekReview(OWNER, week.weeklyPlan!.weekKey);
  assert.ok(updated.weekReview!.summary.includes("完成 0/"));
  assert.ok(updated.weekReview!.archivedAt);
});

test("用户资源被后续周同节点活动继承", async () => {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 180 });
  await service.confirmProposal(OWNER);
  const week1 = await service.getWorkspace(OWNER);
  const activity = week1.activities.find((a) => a.status === "planned")!;
  const withResource = await service.saveUserResource(OWNER, {
    type: "resource",
    title: "后续周也要使用的材料",
    content: "这份材料绑定到当前节点。",
    relatedNodeIds: [activity.nodeId],
  });
  const resource = withResource.userResources.find((item) => item.title === "后续周也要使用的材料")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: "短。" });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const week2 = await service.generateNextWeekPlan(OWNER, week1.weeklyPlan!.weekKey);

  const inherited = week2.activities.find((item) => item.nodeId === activity.nodeId);
  if (inherited) {
    assert.ok(inherited.inputRefs.includes(resource.id));
  } else {
    assert.ok(week2.weeklyPlanHistory.some((week) => week.generatedFromReview));
  }
});
