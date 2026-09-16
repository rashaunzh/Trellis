import test from "node:test";
import assert from "node:assert/strict";
import { planLearningProgram, assessProgramCheck, publicProgramUnit } from "../../lib/learning/intelligence/learning-program.ts";

test("十二周完整安排教学、练习与复测，起点未知不产生免修", () => {
  const plan = planLearningProgram({ direction: "ai_product", weeks: 12, weeklyMinutes: 240 });
  assert.equal(plan.status, "ready");
  assert.equal(plan.weeks.length, 12);
  assert.ok(plan.weeks.every(week => week.plannedMinutes <= 240));
  assert.equal(plan.coverage.length, 8);
  assert.ok(plan.coverage.every(item => item.status === "scheduled"));
  const activities = plan.weeks.flatMap(week => week.activities);
  assert.ok(activities.some(item => item.kind === "review"));
  assert.ok(activities.some(item => item.kind === "check"));
  assert.ok(activities.some(item => item.kind === "practice"));
  assert.ok(plan.assumptions.some(item => item.includes("未知")));
});

test("错误计数给出针对性补救，检查不以平均正确率掩盖关键失败", () => {
  const result = assessProgramCheck("model-evaluation", "diagnostic", { "eval-count": "accuracy", "eval-cost": "cost" }, false);
  assert.equal(result.status, "needs_revision");
  assert.ok(result.criteria[0].nextAction.includes("分母"));
  assert.equal(result.criteria[0].selectedAnswer, "0.8和0.8");
  assert.throws(() => assessProgramCheck("model-evaluation", "review", { "eval-count": "counts" }, false), /以外/);
});

test("容量不足明确冲突，不能截短活动或静默丢掉核心目标", () => {
  const plan = planLearningProgram({ direction: "ai_product", weeks: 8, weeklyMinutes: 30 });
  assert.equal(plan.status, "conflict");
  assert.equal(plan.coverage.length, 8);
  assert.ok(plan.issues.some(item => item.includes("时间")));
  assert.ok(plan.requiredMinutes > plan.availableMinutes);
});

test("公开检查不泄露答案；有提示的正确作答只算练习，不算独立验证", () => {
  const unit = publicProgramUnit("model-evaluation");
  assert.ok(unit);
  assert.equal(JSON.stringify(unit).includes("correctOptionId"), false);
  const result = assessProgramCheck("model-evaluation", "diagnostic", {
    "eval-count": "counts", "eval-cost": "cost",
  }, true);
  assert.equal(result.status, "practice_complete");
  assert.equal(result.independent, false);
  assert.equal(result.criteria.length, 2);
});
