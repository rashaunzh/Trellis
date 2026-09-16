import test from "node:test";
import assert from "node:assert/strict";
import { routeReviewSummary } from "../../lib/learning/intelligence/route-review.ts";

const nodes = [{ id: "ai.base", title: "AI基础" }, { id: "pm.eval", title: "评价设计" }];
const base = { targetNodeIds: ["ai.base", "pm.eval"], segments: [{ nodeIds: ["ai.base"], title: "基础第一节", estimatedMinutes: 45, locatorLabel: "第一章", locatorMissing: true, stopCondition: "说明两种限制" }], unresolvedGaps: [] };
test("首屏根据实际安排指出缺口，不能被complete标签掩盖", () => {
  const result = routeReviewSummary({ ...base, planStatus: "complete" }, nodes);
  assert.equal(result.limited, true);
  assert.deepEqual(result.missing, ["评价设计"]);
  assert.equal(result.confirmLabel, "先开始已覆盖的部分");
  assert.equal(JSON.stringify(result).includes("pm.eval"), false);
  assert.equal(result.firstAction?.minutes, 45);
});
test("未记录覆盖的历史路线不声称已经验证，未确认方案不影响当前路线", () => {
  const result = routeReviewSummary({ ...base, targetNodeIds: ["ai.base"] }, nodes);
  assert.equal(result.limited, false);
  assert.match(result.coverageLabel, /未记录/);
  const limited = routeReviewSummary({ ...base, planStatus: "limited", limitedPlanNotice: { missingNodeIds: ["private.unknown"] } }, nodes);
  assert.equal(limited.limited, true);
  assert.equal(JSON.stringify(limited).includes("private.unknown"), false);
});
