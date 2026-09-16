import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";
import { buildLearningOrchestrationState } from "../../lib/learning/intelligence/orchestration.ts";
import { compareCourseGenomes, evaluateDomainGraph } from "../../lib/learning/intelligence/course-intelligence.ts";
import { baselineCourses, baselineMappingsFor, publishedDomainGraph } from "../../lib/learning/intelligence/baseline.ts";
import {
  courseIntelligenceWorkflowSpec,
  startCourseIntelligenceWorkflow,
} from "../../lib/learning/intelligence/workflow-runtime.ts";

function setup() {
  const repository = new InMemoryCourseIntelligenceRepository();
  const learningStore = new InMemoryLearningStore();
  const gateway = new CourseIntelligenceModelGateway(repository, null);
  return { service: new CourseIntelligenceService(repository, gateway, learningStore), learningStore, repository };
}

test("发布领域图包含完整分类并拒绝循环前置", () => {
  assert.ok(publishedDomainGraph.nodes.length >= 30);
  assert.deepEqual(evaluateDomainGraph(publishedDomainGraph), []);
  const broken = structuredClone(publishedDomainGraph);
  broken.nodes[0]!.prerequisiteNodeIds = [broken.nodes[1]!.id];
  broken.nodes[1]!.prerequisiteNodeIds = [broken.nodes[0]!.id];
  assert.ok(evaluateDomainGraph(broken).some((issue) => issue.code === "prerequisite_cycle"));
});

test("正式 Mastra 工作流创建课程方案并停在用户确认", async () => {
  const { service, repository } = setup();
  await service.initialize();
  const result = await startCourseIntelligenceWorkflow({
    ownerId: "owner-formal-workflow",
    rawIntake: {
      goal: "理解 AI 产品能力边界并判断 Agent 场景",
      weeklyCapacity: "light",
      materials: [],
    },
    service,
    repository,
  });
  assert.equal(result.status, "suspended");
  assert.match(result.workflowRunId, /^course-intelligence\./);
  assert.equal(result.curriculum.status, "draft");
  const run = await repository.getWorkflowRunByAggregate("owner-formal-workflow", result.curriculum.id);
  assert.equal(run?.currentStep, "confirm-curriculum");
  assert.equal(courseIntelligenceWorkflowSpec.businessStateOwner, "trellis-d1");
  assert.equal(courseIntelligenceWorkflowSpec.ids.length, 4);
});

test("正式 reset 只清用户路线、决策和学习状态，保留发布目录", async () => {
  const { service, repository } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-formal-reset", {
    goal: "理解 AI 产品能力边界", weeklyCapacity: "light", materials: [],
  });
  await service.confirmCurriculum("owner-formal-reset", draft.id);
  const before = await service.getCurrentLearning("owner-formal-reset");
  assert.ok(before.curriculum);
  const after = await service.resetCurrentLearning("owner-formal-reset");
  assert.equal(after.curriculum, null);
  assert.equal(after.activities.length, 0);
  assert.equal((await repository.listCourses()).length, 30);
});

test("课程新版本只生成影响报告，不覆盖旧版本", () => {
  const previous = structuredClone(baselineCourses[0]!.genome);
  const next = structuredClone(previous);
  next.version = "next";
  next.units[0]!.title = `${next.units[0]!.title}（更新）`;
  const diff = compareCourseGenomes(previous, next);
  assert.equal(diff.requiresReview, true);
  assert.deepEqual(diff.changedUnitIds, [next.units[0]!.id]);
  assert.equal(previous.units[0]!.title.endsWith("（更新）"), false);
});

test("来源快照变化只创建候选更新，相同内容保持 unchanged", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const first = await repository.saveSourceUpdateCandidate({
    id: "snapshot.source.v1",
    sourceId: "source.test",
    contentHash: "hash-v1",
    retrievedAt: "2026-08-31T00:00:00.000Z",
    contentJson: "{}",
  });
  const second = await repository.saveSourceUpdateCandidate({
    id: "snapshot.source.v1-repeat",
    sourceId: "source.test",
    contentHash: "hash-v1",
    retrievedAt: "2026-08-31T01:00:00.000Z",
    contentJson: "{}",
  });
  assert.equal(first.status, "candidate");
  assert.equal(second.status, "unchanged");
  assert.equal(second.candidateSnapshotId, null);
});

test("AI PM 目标压缩多源目录，不把 ML 专项当默认前置", async () => {
  const { service } = setup();
  await service.initialize();
  const record = await service.createCurriculum("owner-course-intelligence", {
    goal: "我想判断 Agent 产品场景，设计能力边界、人工兜底和最小评测方案",
    weeklyCapacity: "steady",
    materials: [],
  });
  const active = record.assembly.decisions.filter((decision) => ["anchor", "selected_units", "supplement"].includes(decision.role));
  assert.equal(active.filter((decision) => decision.role === "anchor").length, 1);
  assert.ok(active.length <= 5, "核心目标预算可弹性至5门（收缩版PRD切片1），默认仍趋向3门");
  assert.equal(active.some((decision) => decision.courseId === "microsoft.ai-python-beginners"), false);
  assert.equal(active.some((decision) => decision.courseId === "dlai.ai-python"), false);
  assert.equal(active.some((decision) => decision.courseId === "dlai.ml-specialization"), false);
  assert.ok(record.assembly.stages[0]!.unitRefs.length > 0);
  assert.ok(record.assembly.unresolvedGaps.length > 0);
});

test("指定 DeepLearning.AI 课程目录时不静默混入其他平台", async () => {
  const { service } = setup();
  await service.initialize();
  const record = await service.createCurriculum("owner-dlai-catalog", {
    goal: "我想判断 Agent 产品场景，设计能力边界、人工兜底和最小评测方案",
    weeklyCapacity: "steady",
    materials: [{ url: "https://www.deeplearning.ai/courses/" }],
  });
  const active = record.assembly.decisions.filter((decision) =>
    ["anchor", "selected_units", "supplement"].includes(decision.role),
  );
  assert.ok(active.length > 0);
  assert.ok(active.every((decision) => decision.courseId.startsWith("dlai.")));
  assert.equal(active.some((decision) => decision.courseId === "dlai.ml-specialization"), false);
  assert.match(record.assembly.rationale, /DeepLearning\.AI/);
});

test("确认课程方案后生成准确课程章节活动并保留轻反馈闭环", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-runtime-bridge", {
    goal: "建立 AI 产品判断，能判断 Agent 能力边界",
    weeklyCapacity: "light",
    materials: [],
  });
  await service.confirmCurriculum("owner-runtime-bridge", draft.id);
  const profile = await learningStore.getProfile("owner-runtime-bridge");
  assert.equal(profile?.status, "confirmed");
  const plans = await learningStore.listWeeklyPlans("owner-runtime-bridge", profile!.activeRouteId);
  assert.equal(plans.length, 1);
  const activities = await learningStore.listActivitiesByPlan(plans[0]!.id);
  assert.ok(activities.length >= 1);
  assert.match(activities[0]!.title, / · /);
  assert.match(activities[0]!.expectedEvidence, /具体例子和判断理由/);
  assert.match(activities[0]!.expectedEvidence, /不推断掌握/);
  assert.equal(activities[0]!.curriculumId, draft.id);
  assert.ok(activities[0]!.canonicalNodeId?.includes("."));
  assert.ok(activities[0]!.courseVersionId?.includes("@"));

  const result = await service.recordLearningSignal("owner-runtime-bridge", activities[0]!.id, {
    type: "quiz_result",
    value: 86,
    note: "课程随堂测试通过",
  });
  assert.equal(result.state.status, "has_signal");
  assert.equal(result.state.nodeId, activities[0]!.canonicalNodeId);
  const current = await service.getCurrentLearning("owner-runtime-bridge");
  assert.equal(current.knowledgeStates[0]?.status, "has_signal");
  assert.equal(current.activities[0]?.status, "completed");
});

test("编排读模型把零材料用户识别为起点诊断而不是材料过载", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const state = await service.getState("owner-zero-material-orchestration");
  const current = await service.getCurrentLearning("owner-zero-material-orchestration");
  const orchestration = buildLearningOrchestrationState({
    state,
    current,
    resources: await learningStore.listUserResources("owner-zero-material-orchestration"),
  });
  assert.equal(orchestration.situation.entryMode, "zero_material");
  assert.match(orchestration.situation.goalHypothesis, /可开始|可检验/);
  assert.equal(orchestration.weeklyPackage, null);
  assert.equal(orchestration.controlCenter.testMachine[0]?.status, "ready");
});

test("编排读模型以能力任务包、来源中心、测试机和成果陈列室呈现已确认路线", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-orchestration-package", {
    goal: "从零开始形成 AI 产品经理的判断、评测和 PRD 能力",
    weeklyCapacity: "focused",
    materials: [],
  });
  await service.confirmCurriculum("owner-orchestration-package", draft.id);
  const state = await service.getState("owner-orchestration-package");
  const current = await service.getCurrentLearning("owner-orchestration-package");
  const orchestration = buildLearningOrchestrationState({
    state,
    current,
    resources: await learningStore.listUserResources("owner-orchestration-package"),
  });
  assert.equal(orchestration.situation.entryMode, "zero_material");
  assert.match(orchestration.weeklyPackage?.mission ?? "", /本周只做一件事/);
  assert.ok((orchestration.weeklyPackage?.tasks.length ?? 0) > 0);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.capabilityTitles.length);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.capabilityProblem);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.whyNow);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.expectedOutcome);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.failureAction);
  assert.ok(orchestration.weeklyPackage?.tasks[0]?.pathMeaning);
  assert.ok(orchestration.decisionTrace.some((item) => item.kind === "situation"));
  assert.ok(orchestration.decisionTrace.some((item) => item.kind === "prioritization"));
  assert.ok(orchestration.capabilityModel.dimensions.length > 0);
  assert.ok(orchestration.controlCenter.sourceCenter.some((item) => item.kind === "course" && item.nextAction.includes("片段")));
  assert.ok(orchestration.controlCenter.testMachine.some((item) => item.kind === "scenario" || item.kind === "exit_ticket"));
  assert.equal(orchestration.controlCenter.artifactGallery[0]?.state, "draft");
});

test("学习活动可开始、暂停、恢复、补充定位并附加工作台资源", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-continuity", {
    goal: "理解 AI 产品能力边界", weeklyCapacity: "light", materials: [],
  });
  await service.confirmCurriculum("owner-continuity", draft.id);
  const initial = await service.getCurrentLearning("owner-continuity");
  const activity = initial.activities[0]!;
  assert.equal(initial.sourceResolution?.kind, "course_root");
  assert.equal(initial.sourceResolution?.precisionLabel, "只能到课程主页");
  assert.equal(initial.resumeState.nextActionLabel, "开始这一节");
  assert.equal(initial.routeManagementSummary?.adoptedCount, draft.assembly.decisions.filter((item) => ["anchor", "selected_units", "supplement"].includes(item.role)).length);

  const started = await service.startActivity("owner-continuity", activity.id);
  assert.equal(started.activity.status, "in_progress");
  assert.ok(started.activity.startedAt);
  assert.ok(started.activity.lastOpenedAt);
  const opened = await service.getCurrentLearning("owner-continuity");
  assert.equal(opened.resumeState.mode, "opened_without_feedback");
  assert.equal(opened.resumeState.openedWithoutFeedback, true);
  assert.equal(opened.resumeState.nextActionLabel, "继续并补反馈");
  await service.pauseActivity("owner-continuity", activity.id, { reason: "今天时间不够" });
  const paused = await service.getCurrentLearning("owner-continuity");
  assert.equal(paused.resumeState.mode, "paused");
  assert.match(paused.resumeState.reason, /今天时间不够/);
  assert.equal(paused.activities[0]?.pauseReason, "今天时间不够");

  const located = await service.updateActivityLocation("owner-continuity", activity.id, {
    sourceUrl: "https://example.com/course/unit-1?t=120", locatorLabel: "Unit 1 · 02:00–12:00",
  });
  assert.equal(located.sourceResolution.kind, "exact");
  assert.equal(located.sourceResolution.manualOverride, true);
  assert.equal(located.sourceResolution.precisionLabel, "个人补充的准确位置");

  await learningStore.saveUserResource({
    id: "resource.continuity", ownerId: "owner-continuity", title: "补充案例", type: "link",
    content: "只在当前片段使用", sourceUrl: "https://example.com/case", relatedNodeIds: [],
    createdAt: new Date().toISOString(),
  });
  await service.attachResource("owner-continuity", "resource.continuity", { activityId: activity.id });
  const attached = await service.getCurrentLearning("owner-continuity");
  assert.equal(attached.attachedResources[0]?.id, "resource.continuity");
  assert.ok(attached.activities[0]?.inputRefs.includes("resource:resource.continuity"));
});

test("反馈适配可跨刷新解释，完成意图与实际用时会持久化", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-adaptation-summary", {
    goal: "理解 AI 能力边界", weeklyCapacity: "light", materials: [],
  });
  await service.confirmCurriculum("owner-adaptation-summary", draft.id);
  const current = await service.getCurrentLearning("owner-adaptation-summary");
  const activity = current.activities[0]!;
  const result = await service.recordLearningSignal("owner-adaptation-summary", activity.id, {
    type: "understanding", value: true, note: "能解释但今天先停在这里",
    completionIntent: "keep_open", actualMinutes: 25,
  });
  assert.equal(result.state.status, "learning");
  const refreshed = await service.getCurrentLearning("owner-adaptation-summary");
  assert.equal(refreshed.activities[0]?.status, "in_progress");
  assert.equal(refreshed.activities[0]?.actualMinutes, 25);
  assert.equal(refreshed.latestAdaptation?.outcome, "advance");
  assert.equal(refreshed.adaptationTimeline.length, 1);
  assert.match(refreshed.adaptationTimeline[0]!.signalSummary, /理解了/);
  assert.equal(refreshed.adaptationTimeline[0]!.applied, true);

  const persistedResult = await service.getLearningTaskResult("owner-adaptation-summary", activity.id);
  assert.equal(persistedResult.taskId, activity.id);
  assert.equal(persistedResult.capabilityNodeId, activity.canonicalNodeId);
  assert.ok(persistedResult.learnedConcepts.length > 0);
  assert.match(persistedResult.nextActionReason, /信号|继续|回看/);

  await service.recordLearningSignal("owner-adaptation-summary", activity.id, {
    type: "quiz_result", value: 90, note: "课程测试通过", completionIntent: "complete", actualMinutes: 35,
  });
  const finalState = await service.getCurrentLearning("owner-adaptation-summary");
  assert.equal(finalState.adaptationTimeline.length, 2);
  assert.match(finalState.adaptationTimeline[0]!.signalSummary, /课程原测验/);
  const completed = await learningStore.getActivity(activity.id);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.actualMinutes, 35);
  assert.ok(completed?.completedAt);
});

test("通用来源先拆成待确认片段，确认后才进入已确认状态", async () => {
  const { service } = setup();
  await service.initialize();
  const source = await service.createContentSource("owner-content-source", {
    title: "AI 产品评估笔记",
    type: "note",
    rawContent: "评估 AI 产品的能力边界、失败边界和用户反馈。",
  });
  assert.equal(source.status, "inbox");
  const analyzed = await service.analyzeUserContentSource("owner-content-source", source.id);
  assert.equal(analyzed.source.status, "needs_review");
  assert.equal(analyzed.analysis?.fragments[0]?.status, "candidate");
  assert.ok((analyzed.analysis?.fragments[0]?.confidence ?? 0) > 0);
  const confirmed = await service.confirmUserContentFragments("owner-content-source", source.id, {
    fragmentIds: [analyzed.analysis!.fragments[0]!.id], decision: "confirmed",
  });
  assert.equal(confirmed.source.status, "confirmed");
  assert.equal(confirmed.analysis?.fragments[0]?.status, "confirmed");
});

test("Solver v3 支持固定、暂缓和章节约束，重算保留父版本", async () => {
  const { service } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-revision-v3", {
    goal: "理解生成式 AI 边界并判断 Agent 产品场景", weeklyCapacity: "steady", materials: [],
  });
  assert.equal(draft.assembly.schemaVersion, 3);
  assert.ok(draft.assembly.segments.length > 0);
  const anchor = draft.assembly.decisions.find((decision) => decision.role === "anchor")!;
  const revised = await service.reviseCurriculum("owner-revision-v3", draft.id, {
    constraints: [{ type: "pin_course", courseId: anchor.courseId }],
  });
  assert.equal(revised.curriculum.parentCurriculumId, draft.id);
  assert.equal(revised.curriculum.revision, (draft.revision ?? 1) + 1);
  assert.deepEqual(revised.curriculum.assembly.constraints, [{ type: "pin_course", courseId: anchor.courseId }]);
  assert.equal(revised.decision.status, "proposed");
});

test("可选情景题不泄漏答案，错误判断会物化针对性回看", async () => {
  const { service, learningStore } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-scenario-v3", {
    goal: "理解 AI 能力边界", weeklyCapacity: "light", materials: [],
  });
  await service.confirmCurriculum("owner-scenario-v3", draft.id);
  const profile = await learningStore.getProfile("owner-scenario-v3");
  const plan = (await learningStore.listWeeklyPlans("owner-scenario-v3", profile!.activeRouteId))[0]!;
  const activity = (await learningStore.listActivitiesByPlan(plan.id))[0]!;
  const check = await service.getScenarioCheck("owner-scenario-v3", activity.id);
  assert.equal("correctOptionId" in check, false);
  const result = await service.recordLearningSignal("owner-scenario-v3", activity.id, {
    type: "scenario_choice", value: "automatic", note: "", questionId: check.id,
  });
  assert.equal(result.interpretation.outcome, "review");
  assert.equal(result.materializedAdaptation.applied, true);
  const updated = await learningStore.getActivity(activity.id);
  assert.equal(updated?.status, "in_progress");
  assert.equal(updated?.estimatedMinutes, 30);
  assert.match(updated?.steps ?? "", /回看/);
});

test("第一周有效信号生成第二周草案，历史活动与信号保留", async () => {
  const { service, learningStore, repository } = setup();
  await service.initialize();
  const draft = await service.createCurriculum("owner-two-week-v3", {
    goal: "理解 AI 产品能力边界并判断 Agent 场景", weeklyCapacity: "light", materials: [],
  });
  await service.confirmCurriculum("owner-two-week-v3", draft.id);
  const current = await service.getCurrentLearning("owner-two-week-v3");
  const activity = current.activities[0]!;
  await service.recordLearningSignal("owner-two-week-v3", activity.id, { type: "quiz_result", value: 88, note: "原课程测试通过" });
  const result = await service.closeWeek("owner-two-week-v3", current.weeklyPlan!.weekKey);
  assert.equal(result.nextWeek.status, "draft");
  assert.ok(result.activities.length > 0);
  assert.equal((await repository.listLearningSignals("owner-two-week-v3", draft.id)).length, 1);
  assert.equal((await learningStore.getActivity(activity.id))?.status, "completed");
  await service.confirmWeek("owner-two-week-v3", result.nextWeek.weekKey);
  assert.equal((await learningStore.getWeeklyPlanByWeek("owner-two-week-v3", current.weeklyPlan!.routeId, result.nextWeek.weekKey))?.status, "confirmed");
});

test("个人可用课程只对所属 owner 可见，不进入共享 catalog", async () => {
  const { service, repository } = setup();
  await service.initialize();
  const personal = structuredClone(baselineCourses[0]!);
  const originalId = personal.genome.id;
  personal.genome.id = "personal.private-course";
  personal.genome.title = "我的私有课程";
  personal.genome.url = "https://example.com/private-course";
  const published = {
    genome: personal.genome,
    tags: personal.tags,
    mappings: baselineMappingsFor(new Set([originalId])).map((mapping) => ({ ...mapping, courseId: personal.genome.id })),
  };
  const now = new Date().toISOString();
  await repository.saveCourseCandidate({
    id: "candidate.personal-ready", ownerId: "owner-private-a", title: personal.genome.title,
    sourceUrl: personal.genome.url, outline: personal.genome.units.map((unit) => unit.title),
    analysisJson: "{}", candidateJson: JSON.stringify(published), evalJson: JSON.stringify({ passed: true }),
    status: "personal_ready", createdAt: now, updatedAt: now,
  });
  assert.ok((await repository.listAvailableCourses("owner-private-a")).some((course) => course.genome.id === personal.genome.id));
  assert.equal((await repository.listAvailableCourses("owner-private-b")).some((course) => course.genome.id === personal.genome.id), false);
  assert.equal((await repository.listCourses()).some((course) => course.genome.id === personal.genome.id), false);
});

test("多课程 intake 最多接受 8 项", async () => {
  const { service } = setup();
  await service.initialize();
  await assert.rejects(service.createCurriculum("owner-too-many", {
    goal: "理解 AI 能力边界", weeklyCapacity: "light",
    materials: Array.from({ length: 9 }, (_, index) => ({ title: `课程 ${index + 1}`, url: "", outline: "" })),
  }));
});

test("无内置模型时陌生目录不伪装为专业课程分析", async () => {
  const { service } = setup();
  await service.initialize();
  const result = await service.analyzeMaterial("owner-material", {
    title: "未知课程",
    url: "https://example.com/course",
    outline: "第一章 概念\n第二章 实践",
  });
  assert.equal(result.status, "needs_analysis");
  assert.equal(result.matchedCourse, null);
  assert.equal(result.extractedUnits.length, 2);
});

test("候选课程只有通过完整映射发布门后才进入正式 catalog", async () => {
  const { service, repository } = setup();
  await service.initialize();
  const now = new Date().toISOString();
  await repository.saveCourseCandidate({
    id: "candidate.publish-test",
    ownerId: "owner-publisher",
    title: "发布测试课程",
    sourceUrl: "https://example.com/publish-test",
    outline: ["第一章", "第二章"],
    analysisJson: "{}",
    status: "candidate",
    createdAt: now,
    updatedAt: now,
  });
  const seed = structuredClone(baselineCourses[0]!);
  const previousId = seed.genome.id;
  seed.genome.id = "test.published-course";
  seed.genome.title = "发布测试课程";
  seed.genome.url = "https://example.com/publish-test";
  seed.genome.version = "2026-08-31";
  const mappings = baselineMappingsFor(new Set([previousId])).map((mapping) => ({
    ...mapping,
    courseId: seed.genome.id,
  }));
  await service.updateCourseCandidateDraft("candidate.publish-test", {
    genome: seed.genome,
    tags: ["test"],
    mappings,
  });
  await service.reviewCourseCandidate({
    candidateId: "candidate.publish-test",
    reviewerOwnerId: "owner-reviewer",
    decision: "validated",
    reason: "来源、章节结构和节点映射均已人工核对",
  });
  const published = await service.publishCourseCandidate("candidate.publish-test", {
    genome: seed.genome,
    tags: ["test"],
    mappings,
  });
  assert.equal(published.genome.id, seed.genome.id);
  assert.ok((await repository.listCourses()).some((course) => course.genome.id === seed.genome.id));
});

test("低置信章节映射不能发布", async () => {
  const { service, repository } = setup();
  await service.initialize();
  const now = new Date().toISOString();
  await repository.saveCourseCandidate({
    id: "candidate.low-confidence",
    ownerId: "owner-publisher",
    title: "低置信课程",
    sourceUrl: "https://example.com/low-confidence",
    outline: ["第一章"],
    analysisJson: "{}",
    status: "candidate",
    createdAt: now,
    updatedAt: now,
  });
  const seed = structuredClone(baselineCourses[0]!);
  const mappings = baselineMappingsFor(new Set([seed.genome.id])).map((mapping) => ({ ...mapping, confidence: 0.5 }));
  await service.updateCourseCandidateDraft("candidate.low-confidence", {
    genome: seed.genome,
    tags: ["test"],
    mappings,
  });
  await assert.rejects(
    service.reviewCourseCandidate({
      candidateId: "candidate.low-confidence",
      reviewerOwnerId: "owner-reviewer",
      decision: "validated",
      reason: "低置信映射不能通过候选验证",
    }),
    /阻断问题/,
  );
});

test("评估型目标的核心节点被安排，或路线诚实标记为有限方案", async () => {
  const { service } = setup();
  await service.initialize();
  const record = await service.createCurriculum("owner-eval-goal", {
    goal: "我写过客服方案，希望学习 AI 可靠性评估，重点掌握产品评测设计、失败类型分析和指标实验，不想从基础理论重新开始",
    weeklyCapacity: "steady",
    materials: [],
  });
  const { assembly } = record;
  const coveredNodes = new Set(assembly.mappings.map((mapping) => mapping.nodeId));
  const evalCore = ["pm.eval-design", "pm.failure-taxonomy", "pm.metrics-experiment"];
  const missingCore = evalCore.filter((id) => !coveredNodes.has(id));
  if (assembly.planStatus === "limited") {
    // 诚实失败：必须声明缺失核心与用户可选处理，不得伪装完整路线
    assert.ok(assembly.limitedPlanNotice, "有限方案必须携带 limitedPlanNotice");
    assert.ok(assembly.limitedPlanNotice!.missingNodeIds.length > 0);
    assert.ok(assembly.limitedPlanNotice!.options.length >= 3);
    assert.ok(missingCore.length > 0, "标记 limited 时应确有核心节点未覆盖");
  } else {
    // 完整路线：评估核心节点必须被安排，而不是全部进入缺口
    assert.equal(missingCore.length, 0, `评估核心节点未安排：${missingCore.join("、")}`);
    assert.ok(!assembly.unresolvedGaps.some((gap) => gap.includes("产品评测设计") && gap.includes("失败类型与风险场景")));
  }
  const active = assembly.decisions.filter((decision) => ["anchor", "selected_units", "supplement"].includes(decision.role));
  assert.ok(active.length <= 5, "核心预算上限为 5 门");
});

test("相关片段前置缺失时作为补充采用，不被清退", async () => {
  const { service } = setup();
  await service.initialize();
  const source = await service.createContentSource("owner-prereq-supplement", {
    title: "评估清单笔记",
    type: "note",
    rawContent: "评估 AI 输出需要先定义失败类型，再设计抽样检查与人工确认条件，记录每次评估的基线。",
  });
  const { analysis } = await service.analyzeUserContentSource("owner-prereq-supplement", source.id);
  await service.confirmUserContentFragments("owner-prereq-supplement", source.id, {
    fragmentIds: analysis!.fragments.map((fragment) => fragment.id), decision: "confirmed",
  });
  const draft = await service.createCurriculum("owner-prereq-supplement", {
    goal: "理解 AI 产品能力边界", weeklyCapacity: "light", materials: [],
  });
  const selection = draft.assembly.sourceSelections?.find((entry) => entry.sourceId === source.id);
  assert.ok(selection, "已确认片段应有处置记录");
  assert.notEqual(selection.role, "defer", "能力节点已被路线覆盖的片段不得因前置缺失被清退");
  if ((selection.prerequisiteGaps ?? []).length > 0) {
    assert.equal(selection.role, "supplement");
    assert.match(selection.rationale, /前置/, "前置缺失必须如实告知，不得静默");
  }
});
