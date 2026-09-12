import { z } from "zod";

export const deliveryEventSchema = z.object({
  id: z.string().min(1).max(160), userKey: z.string().min(1).max(160),
  name: z.enum(["page_viewed", "route_adopted", "activity_started", "submission_saved", "evaluation_completed", "feedback_viewed", "revision_requested", "revision_saved", "revision_feedback_viewed", "adjustment_viewed", "adjustment_accepted", "adjustment_rejected"]),
  at: z.string().datetime({ offset: true }), objectId: z.string().min(1).max(200), version: z.string().min(1).max(100),
  cohort: z.enum(["human", "automation", "fixture", "model_trial"]),
  authority: z.enum(["server", "client"]), outcome: z.enum(["success", "failure", "cancelled"]),
  errorClass: z.string().max(100).optional(),
}).strict();
export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;
const day = 86_400_000;
const serverFacts = new Set<DeliveryEvent["name"]>(["route_adopted", "submission_saved", "evaluation_completed", "revision_requested", "revision_saved", "adjustment_accepted", "adjustment_rejected"]);
const meaningful = new Set<DeliveryEvent["name"]>(["activity_started", "submission_saved", "feedback_viewed", "revision_saved", "revision_feedback_viewed"]);
function ratio(numerator: number, denominator: number) { return { numerator, denominator, rate: denominator ? numerator / denominator : null }; }

/** objectId在提交、修订、反馈事件中统一为任务ID；成功业务事件只接受服务端记录。 */
export function summarizeDeliveryMetrics(raw: unknown[], asOf: string, version: string) {
  const end = Date.parse(asOf);
  if (!Number.isFinite(end)) throw new Error("报告截止日期无效");
  const parsed = raw.map(event => deliveryEventSchema.parse(event));
  const unique = new Map<string, DeliveryEvent>();
  for (const event of parsed) {
    const previous = unique.get(event.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(event)) throw new Error("相同事件ID包含不同内容");
    unique.set(event.id, event);
  }
  const events = [...unique.values()].filter(event => event.version === version && event.cohort === "human" && event.outcome === "success" && Date.parse(event.at) <= end && (!serverFacts.has(event.name) || event.authority === "server"))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const adopted = new Map<string, number>();
  for (const event of events) if (event.name === "route_adopted" && !adopted.has(event.userKey)) adopted.set(event.userKey, Date.parse(event.at));
  const week1 = [...adopted].filter(([, start]) => end >= start + 7 * day);
  const week2 = [...adopted].filter(([, start]) => end >= start + 14 * day);
  const firstWeekClosed = week1.filter(([userKey, start]) => events.some(submit => submit.userKey === userKey && submit.name === "submission_saved" && Date.parse(submit.at) >= start && Date.parse(submit.at) < start + 7 * day && events.some(view => view.userKey === userKey && view.objectId === submit.objectId && view.name === "feedback_viewed" && Date.parse(view.at) >= Date.parse(submit.at) && Date.parse(view.at) < start + 7 * day))).length;
  const returned = week2.filter(([userKey, start]) => events.some(event => event.userKey === userKey && meaningful.has(event.name) && Date.parse(event.at) >= start + 7 * day && Date.parse(event.at) < start + 14 * day)).length;
  const revisions = new Map<string, DeliveryEvent>();
  for (const event of events) if (event.name === "revision_requested" && !revisions.has(`${event.userKey}/${event.objectId}`)) revisions.set(`${event.userKey}/${event.objectId}`, event);
  const matureRevisions = [...revisions.values()].filter(event => end >= Date.parse(event.at) + 7 * day);
  const revised = matureRevisions.filter(request => events.some(save => save.userKey === request.userKey && save.objectId === request.objectId && save.name === "revision_saved" && Date.parse(save.at) >= Date.parse(request.at) && Date.parse(save.at) < Date.parse(request.at) + 7 * day && events.some(view => view.userKey === save.userKey && view.objectId === save.objectId && view.name === "revision_feedback_viewed" && Date.parse(view.at) >= Date.parse(save.at) && Date.parse(view.at) < Date.parse(request.at) + 7 * day))).length;
  return { asOf, version, cohort: "human", validEventCount: events.length,
    firstWeekLoop: ratio(firstWeekClosed, week1.length), secondWeekReturn: ratio(returned, week2.length), revisionLoop: ratio(revised, matureRevisions.length),
    adjustmentCounts: { viewed: events.filter(e => e.name === "adjustment_viewed").length, accepted: events.filter(e => e.name === "adjustment_accepted").length, rejected: events.filter(e => e.name === "adjustment_rejected").length },
    limitation: "行为闭环不是能力提升。当前按指定产品版本内首次采用建立队列；跨版本迁移用户需单独报告，不合并为全站留存。" };
}

export function summarizeServiceAttempts(attempts: Array<{ status: "success" | "failure" | "cancelled"; latencyMs: number; promptTokens: number; completionTokens: number; cost: number | null }>, usableResults: number) {
  if (!Number.isInteger(usableResults) || usableResults < 0) throw new Error("可用交付数无效");
  for (const attempt of attempts) for (const n of [attempt.latencyMs, attempt.promptTokens, attempt.completionTokens, ...(attempt.cost === null ? [] : [attempt.cost])]) if (!Number.isFinite(n) || n < 0) throw new Error("用量或耗时无效");
  const durations = attempts.map(item => item.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number) => durations.length ? durations[Math.ceil(p * durations.length) - 1] : null;
  const knownCost = attempts.length > 0 && attempts.every(item => item.cost !== null);
  const totalCost = knownCost ? attempts.reduce((sum, item) => sum + item.cost!, 0) : null;
  return { count: attempts.length, usableResults, failures: attempts.filter(item => item.status === "failure").length, cancelled: attempts.filter(item => item.status === "cancelled").length,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: durations.at(-1) ?? null,
    individualLatenciesMs: attempts.length < 20 ? attempts.map(item => item.latencyMs) : null,
    tokens: attempts.reduce((sum, item) => sum + item.promptTokens + item.completionTokens, 0), totalCost,
    costPerUsableResult: totalCost !== null && usableResults > 0 ? totalCost / usableResults : null,
    latencyMeaning: "包含失败与取消的已观测终止时间；另报状态，不把快速失败视为成功性能。" };
}
