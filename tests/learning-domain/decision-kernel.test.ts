import test from "node:test";
import assert from "node:assert/strict";

import { interpretLearningSignal, transitionDecision, type DecisionRecord } from "../../lib/learning/intelligence/decision-kernel.ts";

function decision(status: DecisionRecord["status"]): DecisionRecord {
  return {
    id: "decision.test", ownerId: "owner-test", decisionType: "learning_adaptation",
    aggregateType: "learning_activity", aggregateId: "activity.test", workflowRunId: null,
    riskLevel: "high", status, inputHash: "hash", proposal: {}, rationale: {}, citations: [],
    confidence: 0.9, evalReport: {}, modelRoute: {}, createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z", appliedAt: null,
  };
}

test("DecisionRecord 只允许合法状态迁移并生成 append-only 事件", () => {
  const proposed = transitionDecision({ decision: decision("generated"), toStatus: "proposed", actorType: "workflow" });
  assert.equal(proposed.decision.status, "proposed");
  assert.equal(proposed.event.fromStatus, "generated");
  assert.throws(() => transitionDecision({ decision: proposed.decision, toStatus: "applied", actorType: "workflow" }), /决策不能从/);
});

test("测试通过推进，卡住保持活动开放，高影响诉求必须确认", () => {
  assert.equal(interpretLearningSignal({ type: "quiz_result", value: 85, note: "" }).outcome, "advance");
  assert.equal(interpretLearningSignal({ type: "stuck", value: "不理解这个前置", note: "" }).keepsActivityOpen, true);
  const replan = interpretLearningSignal({ type: "judgment", value: "我想切换主线课程", note: "" });
  assert.equal(replan.outcome, "replan");
  assert.equal(replan.riskLevel, "high");
});
