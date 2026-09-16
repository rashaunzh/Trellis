// 状态机测试：核心规则
//  1. 活动完成不会直接验证节点
//  2. 证据 accepted 后才可能验证节点
//  3. 跳学会生成验证要求
//  4. 非法迁移抛错
import test from "node:test";
import assert from "node:assert/strict";

import {
  transitionActivity,
  transitionEvidence,
  transitionNode,
  nodeEffectOfActivityEvent,
  nodeEventOfEvidence,
  decideSkip,
} from "../../lib/learning/domain/state-machine.ts";

test("活动状态机：正常路径 planned→completed", () => {
  let s = transitionActivity("planned", { type: "start" });
  assert.equal(s, "in_progress");
  s = transitionActivity(s, { type: "submitEvidence" });
  assert.equal(s, "evidence_submitted");
  s = transitionActivity(s, { type: "reviewAccepted" });
  assert.equal(s, "reviewed");
  s = transitionActivity(s, { type: "complete" });
  assert.equal(s, "completed");
});

test("活动状态机：证据退回回到 in_progress", () => {
  let s = transitionActivity("in_progress", { type: "submitEvidence" });
  assert.equal(s, "evidence_submitted");
  s = transitionActivity(s, { type: "reviewNeedsRevision" });
  assert.equal(s, "in_progress");
});

test("活动状态机：非法迁移抛错", () => {
  assert.throws(() => transitionActivity("planned", { type: "complete" }));
  assert.throws(() => transitionActivity("completed", { type: "start" }));
});

test("证据状态机：draft→submitted→accepted", () => {
  let s = transitionEvidence("draft", { type: "submit" });
  assert.equal(s, "submitted");
  s = transitionEvidence(s, { type: "accept" });
  assert.equal(s, "accepted");
});

test("证据状态机：退回后重新提交", () => {
  let s = transitionEvidence("submitted", { type: "requestRevision" });
  assert.equal(s, "needs_revision");
  s = transitionEvidence(s, { type: "resubmit" });
  assert.equal(s, "submitted");
});

test("核心规则 1：活动完成不会直接验证节点", () => {
  // 活动进入任何状态都不产生节点事件
  assert.equal(nodeEffectOfActivityEvent("planned"), null);
  assert.equal(nodeEffectOfActivityEvent("in_progress"), null);
  assert.equal(nodeEffectOfActivityEvent("evidence_submitted"), null);
  assert.equal(nodeEffectOfActivityEvent("reviewed"), null);
  assert.equal(nodeEffectOfActivityEvent("completed"), null);
  // 节点从 unstarted 开始学习进入 growing
  let nodeStatus = transitionNode("unstarted", { type: "beginLearning" });
  assert.equal(nodeStatus, "growing");
  // 即使活动 completed（无节点事件），节点仍是 growing，不能直接 validated
  nodeStatus = transitionNode(nodeStatus, { type: "beginLearning" });
  assert.equal(nodeStatus, "growing");
  // 只有 evidenceAccepted 才能 validated
  nodeStatus = transitionNode(nodeStatus, { type: "evidenceAccepted" });
  assert.equal(nodeStatus, "validated");
});

test("核心规则 2：证据 accepted 后才可能验证节点", () => {
  // needs_revision 不产生节点事件
  assert.equal(nodeEventOfEvidence("needs_revision"), null);
  // accepted 产生 evidenceAccepted 事件
  const event = nodeEventOfEvidence("accepted");
  assert.deepEqual(event, { type: "evidenceAccepted" });
  // 节点由 growing → validated
  const status = transitionNode("growing", { type: "evidenceAccepted" });
  assert.equal(status, "validated");
});

test("核心规则 3：跳学必须生成验证活动", () => {
  const decision = decideSkip("unstarted", false);
  assert.equal(decision.nodeStatus, "growing");
  assert.equal(decision.requiresValidationActivity, true);
});

test("跳学规则：前置缺口不允许跳学", () => {
  assert.throws(() => decideSkip("unstarted", true), /前置未满足/);
});

test("跳学规则：已验证节点无需跳学", () => {
  assert.throws(() => decideSkip("validated", false), /无需跳学/);
});

test("节点状态机：unstarted→growing→validated", () => {
  let s = transitionNode("unstarted", { type: "beginLearning" });
  assert.equal(s, "growing");
  s = transitionNode(s, { type: "evidenceAccepted" });
  assert.equal(s, "validated");
});

test("节点状态机：新证据可降级（validated→growing）", () => {
  const s = transitionNode("validated", { type: "evidenceInvalidated" });
  assert.equal(s, "growing");
});

test("节点状态机：非法迁移抛错", () => {
  assert.throws(() => transitionNode("unstarted", { type: "evidenceInvalidated" }));
});
