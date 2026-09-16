import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDeliveryMetrics, summarizeServiceAttempts, deliveryEventSchema, type DeliveryEvent } from "../../lib/learning/intelligence/delivery-metrics.ts";

const event = (id: string, userKey: string, name: DeliveryEvent["name"], at: string, objectId = "task-1"): DeliveryEvent => ({
  id, userKey, name, at, objectId, version: "v1", cohort: "human", authority: "server", outcome: "success",
});

test("无成熟用户时指标未知；分析事件禁止混入答案正文", () => {
  assert.equal(summarizeDeliveryMetrics([], "2026-01-20T00:00:00Z", "v1").firstWeekLoop.rate, null);
  assert.equal(deliveryEventSchema.safeParse({ ...event("a", "u", "page_viewed", "2026-01-01T00:00:00Z"), answer: "private text" }).success, false);
});
test("单位成本包含失败，缺价格不当成免费，少量观测保留每次等待", () => {
  const result = summarizeServiceAttempts([
    { status: "success", latencyMs: 1000, promptTokens: 20, completionTokens: 10, cost: 1 },
    { status: "failure", latencyMs: 3000, promptTokens: 10, completionTokens: 0, cost: 0.5 },
  ], 1);
  assert.equal(result.costPerUsableResult, 1.5);
  assert.equal(result.tokens, 40);
  assert.deepEqual(result.individualLatenciesMs, [1000, 3000]);
  assert.equal(summarizeServiceAttempts([{ status: "success", latencyMs: 1000, promptTokens: 0, completionTokens: 0, cost: null }], 1).costPerUsableResult, null);
});
test("成熟窗口只纳入完整观察用户，去重，排除自动化与只有首页回访", () => {
  const events: DeliveryEvent[] = [
    event("a", "u1", "route_adopted", "2026-01-01T00:00:00Z", "route-1"),
    event("b", "u2", "route_adopted", "2026-01-19T00:00:00Z", "route-2"),
    event("c", "u1", "submission_saved", "2026-01-02T00:00:00Z"),
    event("d", "u1", "feedback_viewed", "2026-01-03T00:00:00Z"),
    event("d", "u1", "feedback_viewed", "2026-01-03T00:00:00Z"),
    event("e", "u1", "page_viewed", "2026-01-10T00:00:00Z"),
    { ...event("f", "robot", "route_adopted", "2026-01-01T00:00:00Z"), cohort: "automation" },
  ];
  const report = summarizeDeliveryMetrics(events, "2026-01-20T00:00:00Z", "v1");
  assert.deepEqual(report.firstWeekLoop, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(report.secondWeekReturn, { numerator: 0, denominator: 1, rate: 0 });
});
test("不同任务的提交与评价不可拼成闭环；客户端点击不能当正式采用", () => {
  const events: DeliveryEvent[] = [
    event("a", "u1", "route_adopted", "2026-01-01T00:00:00Z"),
    event("b", "u1", "submission_saved", "2026-01-02T00:00:00Z", "task-a"),
    event("c", "u1", "feedback_viewed", "2026-01-03T00:00:00Z", "task-b"),
    { ...event("d", "u2", "route_adopted", "2026-01-01T00:00:00Z"), authority: "client" },
  ];
  assert.deepEqual(summarizeDeliveryMetrics(events, "2026-01-20T00:00:00Z", "v1").firstWeekLoop, { numerator: 0, denominator: 1, rate: 0 });
});
