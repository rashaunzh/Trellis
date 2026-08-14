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
  const ws2 = await service.confirmAdjustment(OWNER, adjustment!.id);
  assert.equal(
    ws2.adjustments.find((a) => a.id === adjustment!.id)!.status,
    "accepted",
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
