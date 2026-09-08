import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";

async function setup() {
  const repository = new InMemoryCourseIntelligenceRepository();
  const store = new InMemoryLearningStore();
  const service = new CourseIntelligenceService(repository, new CourseIntelligenceModelGateway(repository, null), store);
  await service.initialize();
  const owner = "delivery-regression";
  const draft = await service.createCurriculum(owner, { goal: "理解 AI 产品能力边界", weeklyCapacity: "light", materials: [] });
  await service.confirmCurriculum(owner, draft.id);
  const current = await service.getCurrentLearning(owner);
  return { service, repository, store, owner, current };
}

test("不确定反馈保留当前任务且不声称掌握能力", async () => {
  const { service, owner, current } = await setup();
  const activity = current.activities[0]!;
  const response = await service.recordLearningSignal(owner, activity.id, { type: "understanding", value: "uncertain", note: "还不能解释" });
  assert.equal(response.interpretation.outcome, "review");
  assert.equal((await service.getCurrentLearning(owner)).activities.find(item => item.id === activity.id)?.status, "in_progress");
  const result = await service.getLearningTaskResult(owner, activity.id);
  assert.notEqual(result.evidenceStrength, "strong");
  assert.ok(result.notYetProven.length > 0);
});

test("高风险反馈重试不会覆盖之后的暂停和位置修改", async () => {
  const { service, owner, current, store } = await setup();
  const id = current.activities[0]!.id;
  const input = { submissionId: "proposed-retry", type: "understanding", value: "uncertain", note: "我想改路线" };
  await service.recordLearningSignal(owner, id, input);
  await service.pauseActivity(owner, id, { reason: "先休息" });
  await service.updateActivityLocation(owner, id, { sourceUrl: "https://example.com/new-location", locatorLabel: "新位置" });
  await service.recordLearningSignal(owner, id, input);
  const saved = await store.getActivity(id);
  assert.equal(saved?.status, "paused");
  assert.equal(saved?.scope?.sourceUrl, "https://example.com/new-location");
});

test("测验通过不能覆盖同时提交的不确定反馈", async () => {
  const { service, owner, current } = await setup();
  const result = await service.recordLearningSignal(owner, current.activities[0]!.id, { type: "quiz_result", value: 100, understanding: "uncertain" });
  assert.equal(result.interpretation.outcome, "review");
  assert.equal((await service.getCurrentLearning(owner)).activities[0]!.status, "in_progress");
});

test("通用反思回答不能当作节点能力检查并自动推进", async () => {
  const { service, owner, current } = await setup();
  const id = current.activities[0]!.id;
  const check = await service.getScenarioCheck(owner, id);
  const result = await service.recordLearningSignal(owner, id, { type: "scenario_choice", value: "bounded", questionId: check.id });
  assert.equal(result.interpretation.keepsActivityOpen, true);
  assert.match(result.interpretation.rationale, /不能验证/);
});

test("节点专属检查提供评价依据，错误与不确定不推进，一次答对不等于掌握", async () => {
  const { service, owner, current, store } = await setup();
  const activity = { ...current.activities[0]!, canonicalNodeId: "pm.eval-design" };
  await store.saveActivity(activity);
  const check = await service.getScenarioCheck(owner, activity.id);
  assert.match(check.prompt, /保留集/);
  assert.equal(check.assessmentKind, "node_check");
  assert.ok(!("correctOptionId" in check));
  await assert.rejects(service.recordLearningSignal(owner, activity.id, { type: "scenario_choice", value: "invented", questionId: check.id }), /有效选项/);
  const wrong = await service.recordLearningSignal(owner, activity.id, { type: "scenario_choice", value: "choice-1", questionId: check.id });
  assert.equal(wrong.interpretation.keepsActivityOpen, true);
  const uncertain = await service.recordLearningSignal(owner, activity.id, { type: "scenario_choice", value: "choice-3", questionId: check.id, understanding: "uncertain" });
  assert.equal(uncertain.interpretation.keepsActivityOpen, true);
  await service.recordLearningSignal(owner, activity.id, { type: "scenario_choice", value: "choice-3", questionId: check.id, understanding: "understood" });
  const result = await service.getLearningTaskResult(owner, activity.id);
  assert.match(result.evaluationBasis.join(" "), /独立|污染/);
  assert.notEqual(result.evidenceStrength, "strong");
  assert.deepEqual(result.demonstrated, []);
});

for (const failurePoint of ["activity", "decision"]) {
  test(`反馈${failurePoint}写入中断后同一提交可以恢复`, async t => {
    const { service, owner, current, store, repository } = await setup();
    const id = current.activities[0]!.id;
    let fail = true;
    if (failurePoint === "activity") {
      const original = store.saveActivity.bind(store);
      t.mock.method(store, "saveActivity", async (activity: Parameters<typeof original>[0]) => { if (fail) { fail = false; throw new Error("injected write failure"); } return original(activity); });
    } else {
      const original = repository.saveDecision.bind(repository);
      t.mock.method(repository, "saveDecision", async (...args: Parameters<typeof original>) => { if (fail) { fail = false; throw new Error("injected write failure"); } return original(...args); });
    }
    const input = { submissionId: "recover", type: "understanding", value: "understood" };
    await assert.rejects(() => service.recordLearningSignal(owner, id, input), /injected/);
    const recovered = await service.recordLearningSignal(owner, id, input);
    assert.equal(recovered.decision.status, "applied");
    assert.equal((await service.getCurrentLearning(owner)).activities.find(item => item.id === id)?.status, "completed");
    assert.equal((await service.recordLearningSignal(owner, id, input)).decision.id, recovered.decision.id);
  });
}

test("无编程基础的产品学习者不会被默认安排编程前置课程", async () => {
  const { service, owner } = await setup();
  const draft = await service.createCurriculum(owner, { goal: "没有编程基础，每周两小时学习 AI 产品判断", weeklyCapacity: "light", materials: [] });
  const state = await service.getState(owner);
  const adopted = new Set(draft.assembly.stages.flatMap(stage => stage.unitRefs.map(ref => ref.courseId)));
  assert.ok(state.catalog.filter(course => adopted.has(course.id)).every(course => !course.prerequisites.some(item => /编程|python|pytorch|代码/i.test(item))));
});

test("自然语言明确限定平台时不混入外部课程", async () => {
  const { service, owner } = await setup();
  const draft = await service.createCurriculum(owner, { goal: "仅采用 DeepLearning.AI 的课程学习 AI 产品评估", weeklyCapacity: "light", materials: [] });
  assert.ok(draft.assembly.stages.flatMap(stage => stage.unitRefs).every(ref => ref.courseId.startsWith("dlai.")));
});

test("目标中的30分钟容量与界面档位冲突时明确报错", async () => {
  const { service, owner } = await setup();
  await assert.rejects(() => service.createCurriculum(owner, { goal: "每周只有30分钟学习AI", weeklyCapacity: "light", materials: [] }), /时间/);
});

test("同一反馈提交重试返回原信号，不重复写入决策", async () => {
  const { service, owner, current } = await setup();
  const id = current.activities[0]!.id;
  const input = { submissionId: "request-1", type: "understanding", value: "uncertain" };
  const first = await service.recordLearningSignal(owner, id, input);
  const retry = await service.recordLearningSignal(owner, id, input);
  assert.equal(retry.signal.id, first.signal.id);
  assert.equal(retry.decision.id, first.decision.id);
  await assert.rejects(() => service.recordLearningSignal(owner, id, { ...input, value: "understood" }), /同一提交标识/);
});

test("本周承诺不超过用户选择的时间容量", async () => {
  const { current } = await setup();
  assert.ok(current.activities.reduce((sum, item) => sum + item.estimatedMinutes, 0) <= current.weeklyPlan!.capacityMinutes);
});

test("逐片段审阅的来源进入新路线并冻结分析版本", async () => {
  const { service, owner, current } = await setup();
  const source = await service.createContentSource(owner, { title: "我的 AI 笔记", rawContent: "# AI 能力边界\nAI 能力边界：解释模型不确定性与失败条件。\n# Agent\nAgent 工具调用与人工确认。" });
  const details = await service.analyzeUserContentSource(owner, source.id);
  assert.equal(details.analysis?.fragments.length, 2);
  assert.equal(details.analysis?.readingScope, "provided_text");
  await service.confirmUserContentFragments(owner, source.id, { fragmentIds: [details.analysis!.fragments[0]!.id], decision: "confirmed" });
  await assert.rejects(() => service.confirmUserContentFragments(owner, source.id, { fragmentIds: ["unknown"], decision: "confirmed" }), /版本/);
  const draft = await service.createCurriculum(owner, { goal: "理解 AI 能力边界", weeklyCapacity: "light", materials: [] });
  assert.equal(draft.assembly.sourceSelections?.length, 1);
  assert.equal(draft.assembly.sourceSelections?.[0]?.analysisVersion, 1);
  await service.analyzeUserContentSource(owner, source.id);
  assert.equal((await service.getState(owner)).curriculum?.assembly.sourceSelections?.[0]?.analysisVersion, 1);
  assert.equal((await service.getCurrentLearning(owner)).curriculum?.id, current.curriculum?.id);
});

test("跨周仍可恢复尚未完成的已确认计划", async () => {
  const { service, owner, current, store } = await setup();
  await store.saveWeeklyPlan({ ...current.weeklyPlan!, weekKey: "2020-W01" });
  const resumed = await service.getCurrentLearning(owner);
  assert.equal(resumed.weeklyPlan?.id, current.weeklyPlan?.id);
  assert.equal(resumed.activities.length, current.activities.length);
});

test("重复前置受阻反馈不会重复创建补救任务", async () => {
  const { service, owner, current } = await setup();
  const id = current.activities[0]!.id;
  const input = { type: "stuck", value: "基础看不懂", note: "术语不清楚" };
  await service.recordLearningSignal(owner, id, input);
  const first = await service.getCurrentLearning(owner);
  await service.recordLearningSignal(owner, id, input);
  const second = await service.getCurrentLearning(owner);
  assert.equal(second.activities.length, first.activities.length);
});

test("自报测试通过只表示练习信号，不证明迁移能力", async () => {
  const { service, owner, current } = await setup();
  const activity = current.activities[0]!;
  await service.recordLearningSignal(owner, activity.id, { type: "quiz_result", value: 100 });
  const result = await service.getLearningTaskResult(owner, activity.id);
  assert.notEqual(result.evidenceStrength, "strong");
  assert.deepEqual(result.demonstrated, []);
  assert.ok(result.notYetProven.length > 0);
});

test("新草稿不隐藏已确认路线及任务", async () => {
  const { service, owner, current } = await setup();
  const draft = await service.createCurriculum(owner, { goal: "学习 Agent 的产品边界", weeklyCapacity: "light", materials: [] });
  assert.equal((await service.getState(owner)).curriculum?.id, draft.id);
  const resumed = await service.getCurrentLearning(owner);
  assert.equal(resumed.curriculum?.id, current.curriculum?.id);
  assert.deepEqual(resumed.activities.map(item => item.id), current.activities.map(item => item.id));
});
