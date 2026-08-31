import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";
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
  assert.ok(active.length < 8, "当前采用来源必须保持有限");
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
  assert.match(activities[0]!.expectedEvidence, /课程随堂测试结果/);
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
