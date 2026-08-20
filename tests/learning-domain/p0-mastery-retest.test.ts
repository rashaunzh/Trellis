// P0：掌握确认（pending_confirmation / confirm-mastery）+ 延迟复测（retest / dueReviews / 降级顺延）
import test from "node:test";
import assert from "node:assert/strict";

import {
  LearningApplicationService,
} from "../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { createRuleAgents } from "../../lib/learning/agents/index.ts";

function createService() {
  return new LearningApplicationService(
    new InMemoryLearningStore(),
    createRuleAgents(),
  );
}

const OWNER = "p0-mastery-owner-01";
const DAY = 86400000;

const GOOD_EVIDENCE =
  "语言模型从训练数据中学统计规律而非存储事实：训练阶段调整参数，推理阶段逐词预测。" +
  "流畅不等于正确，幻觉来自概率采样，泛化依赖数据分布。判断 AI 方案看任务委托、输出校验、失败兜底。";

async function setupConfirmedLearner() {
  const service = createService();
  await service.runDiagnostic({ ownerId: OWNER, goal: "学 AI", weeklyMinutes: 360 });
  await service.confirmProposal(OWNER);
  return service;
}

// ── 掌握确认 ──────────────────────────────────────────
test("综合任务证据 accepted 后节点进入 pending_confirmation（不直接验证）", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const task = ws.activities.find((a) => a.activityType === "integrated_task")!;
  assert.ok(task, "6h 计划应含综合情境任务");
  await service.startActivity(OWNER, task.id);
  await service.submitEvidence(OWNER, task.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === task.id)!;
  const { workspace } = await service.reviewEvidence(OWNER, evidence.id);
  const np = workspace.nodeProgress.find((p) => p.nodeId === task.nodeId)!;
  assert.equal(np.status, "pending_confirmation", "综合任务验证需用户确认，不应直接 validated");
  assert.equal(np.confirmedAt, null);
});

test("confirmMastery confirmed → 节点 validated + mastery_confirm 记录", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const task = ws.activities.find((a) => a.activityType === "integrated_task")!;
  await service.startActivity(OWNER, task.id);
  await service.submitEvidence(OWNER, task.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === task.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const ws2 = await service.confirmMastery(OWNER, task.nodeId, { decision: "confirmed" });
  const np = ws2.nodeProgress.find((p) => p.nodeId === task.nodeId)!;
  assert.equal(np.status, "validated", "用户确认后节点进入已验证");
  assert.ok(np.confirmedAt, "应记录确认时间");
  assert.ok(
    ws2.adjustments.some((a) => a.adjustmentType === "mastery_confirm" && a.status === "accepted"),
    "应写入 mastery_confirm(accepted) 调整记录",
  );
});

test("confirmMastery corrected → 节点回 growing + 降级 + 补强建议", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const task = ws.activities.find((a) => a.activityType === "integrated_task")!;
  await service.startActivity(OWNER, task.id);
  await service.submitEvidence(OWNER, task.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === task.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const ws2 = await service.confirmMastery(OWNER, task.nodeId, { decision: "corrected", note: "还没完全懂" });
  const np = ws2.nodeProgress.find((p) => p.nodeId === task.nodeId)!;
  assert.equal(np.status, "growing", "纠正后回成长中");
  assert.ok(
    ws2.adjustments.some((a) => a.adjustmentType === "mastery_confirm" && a.status === "rejected"),
    "应写入 mastery_confirm(rejected)",
  );
  assert.ok(
    ws2.adjustments.some((a) => a.adjustmentType === "weekly_light" && a.status === "proposed"),
    "应生成补强建议",
  );
});

test("普通活动证据 accepted 仍自动验证（不要求确认）", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  const { workspace } = await service.reviewEvidence(OWNER, evidence.id);
  const np = workspace.nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.equal(np.status, "validated", "普通活动保持自动验证（向后兼容）");
});

// ── 延迟复测 ──────────────────────────────────────────
test("复测到期节点出现在 dueReviews", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  // 手动把复测时间设为过去
  const np = (await service.getWorkspace(OWNER)).nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  np.nextReviewAt = new Date(Date.now() - DAY).toISOString();
  await service["store"].saveNodeProgress(np);
  const ws2 = await service.getWorkspace(OWNER);
  assert.ok(ws2.dueReviews.some((d) => d.nodeId === activity.nodeId), "到期节点应出现在 dueReviews");
});

test("retestNode 生成 retest 活动（isCore=false）", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const ws2 = await service.retestNode(OWNER, activity.nodeId);
  const retest = ws2.activities.find((a) => a.activityType === "retest" && a.nodeId === activity.nodeId);
  assert.ok(retest, "应生成 retest 活动");
  assert.equal(retest!.isCore, false, "复测不计入核心承诺");
});

test("复测通过：nextReviewAt 顺延 + reviewCount 增加（间隔翻倍）", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const ws2 = await service.retestNode(OWNER, activity.nodeId);
  const retest = ws2.activities.find((a) => a.activityType === "retest" && a.nodeId === activity.nodeId)!;
  await service.startActivity(OWNER, retest.id);
  await service.submitEvidence(OWNER, retest.id, { content: GOOD_EVIDENCE });
  const ev2 = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === retest.id)!;
  await service.reviewEvidence(OWNER, ev2.id);
  const np = (await service.getWorkspace(OWNER)).nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.equal(np.reviewCount, 1, "复测次数 +1");
  assert.equal(np.reviewIntervalDays, 28, "间隔翻倍 14→28");
  assert.ok(np.nextReviewAt && new Date(np.nextReviewAt).getTime() > Date.now(), "下次复测顺延到未来");
});

test("复测失败：节点回 growing + 熟练等级降级", async () => {
  const service = await setupConfirmedLearner();
  const ws = await service.getWorkspace(OWNER);
  const activity = ws.activities.find((a) => a.activityType === "build_model")!;
  await service.startActivity(OWNER, activity.id);
  await service.submitEvidence(OWNER, activity.id, { content: GOOD_EVIDENCE });
  const evidence = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === activity.id)!;
  await service.reviewEvidence(OWNER, evidence.id);
  const ws2 = await service.retestNode(OWNER, activity.nodeId);
  const retest = ws2.activities.find((a) => a.activityType === "retest" && a.nodeId === activity.nodeId)!;
  await service.startActivity(OWNER, retest.id);
  await service.submitEvidence(OWNER, retest.id, { content: "太短。" });
  const ev2 = (await service.getWorkspace(OWNER)).evidence.find((e) => e.activityId === retest.id)!;
  const before = (await service.getWorkspace(OWNER)).nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  await service.reviewEvidence(OWNER, ev2.id);
  const np = (await service.getWorkspace(OWNER)).nodeProgress.find((p) => p.nodeId === activity.nodeId)!;
  assert.equal(np.status, "growing", "复测失败回成长中");
  assert.ok(np.confidence <= before.confidence, "熟练等级不升反降");
});
