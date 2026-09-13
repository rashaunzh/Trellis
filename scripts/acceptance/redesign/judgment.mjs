import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cases, reservedCases, rubric } from "./cases.mjs";
import { createReport, fingerprint, readJson, sourceFingerprint, validateReview } from "./report.mjs";
import { InMemoryCourseIntelligenceRepository } from "../../../lib/learning/intelligence/repository.ts";
import { InMemoryLearningStore } from "../../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway } from "../../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../../lib/learning/intelligence/service.ts";

const reviewPath = process.argv.find(arg => arg.startsWith("--review-run="))?.slice(13);
// 评审既有输出，禁止重新生成随机 ID 后用旧评分冒充当前结果。
if (reviewPath) {
  const saved = await readJson(resolve(reviewPath, "result.json"));
  const outputs = await readJson(resolve(reviewPath, "outputs.json"));
  const review = await readJson(resolve(reviewPath, "review.json"));
  assert.equal(saved.fixtureHash, fingerprint(cases), "样例已变化，需重新运行");
  assert.equal(saved.sourceHash, await sourceFingerprint(), "源码已变化或旧证据缺少源码指纹，需重新运行");
  assert.equal(saved.outputsHash, fingerprint(outputs));
  assert.ok(saved.automatedPassed, "自动检查仍未通过");
  assert.ok(validateReview(review, saved.outputsHash, rubric, saved.selectedIds), "五维评分必须逐项可用且附依据");
  console.log("PASS 当前样例输出的人工产品评分；这不代表真人使用验收");
  process.exit(0);
}
const includeReserved = process.argv.includes("--include-reserved");
const selected = cases.filter(item => process.argv.includes("--include-holdout") || item.split === "development")
  .concat(includeReserved ? reservedCases : []);
const run = await createReport("judgment", { mode: "published-baseline-and-rules", fixtureHash: fingerprint(cases), selectedIds: selected.map(item => item.id), sourceVerification: "local-catalog-only" });
const outputs = [];
for (const item of selected) {
  const repository = new InMemoryCourseIntelligenceRepository();
  const store = new InMemoryLearningStore();
  const service = new CourseIntelligenceService(repository, new CourseIntelligenceModelGateway(repository, null), store);
  const owner = `redesign-${crypto.randomUUID()}`;
  let draft;
  const generated = await run.check(`${item.id}/generate`, async () => {
    await service.initialize();
    for (const sourceInput of item.sources ?? []) {
      const source = await service.createContentSource(owner, sourceInput);
      const { analysis } = await service.analyzeUserContentSource(owner, source.id);
      if (sourceInput.rawContent) await service.confirmUserContentFragments(owner, source.id, { fragmentIds: analysis.fragments.map(fragment => fragment.id), decision: "confirmed" });
    }
    if (item.expectedError) {
      await assert.rejects(service.createCurriculum(owner, item.input), new RegExp(item.expectedError));
      outputs.push({ id: item.id, outcome: "capacity-conflict", input: item.input });
      return;
    }
    draft = await service.createCurriculum(owner, item.input);
    outputs.push({ id: item.id, input: item.input, assembly: draft.assembly });
  });
  if (!generated || !draft) continue;
  const state = await service.getState(owner);
  await run.check(`${item.id}/stage-objectives`, () => {
    assert.ok(draft.assembly.stages.every(stage => !/共同基础与判断|目标分支\s*\d/.test(stage.title)), "仍使用无具体能力含义的阶段标题");
    assert.equal(new Set(draft.assembly.stages.map(stage => stage.exitCriteria.join("|"))).size, draft.assembly.stages.length, "阶段出口重复");
    assert.ok(draft.assembly.stages.every(stage => !stage.exitCriteria.some(text => /完成采用章节并达到课程原有测试/.test(text))), "课程完成不等于阶段能力出口");
  });
  await run.check(`${item.id}/decision-evidence`, () => {
    for (const decision of draft.assembly.decisions.filter(entry => entry.selectedUnitIds.length)) {
      const course = state.catalog.find(entry => entry.id === decision.courseId);
      assert.ok(course && decision.selectedUnitIds.every(id => course.units.some(unit => unit.id === id)));
      assert.ok(decision.sourceCitations.length);
      assert.ok(decision.selectedUnitIds.some(id => decision.rationale.includes(course.units.find(unit => unit.id === id).title)), "理由必须指明实际采用内容");
    }
  });
  await run.check(`${item.id}/declared-constraints`, async () => {
    const checks = item.checks ?? [];
    if (checks.includes("noProgramming")) assert.ok(draft.assembly.decisions.filter(entry => entry.selectedUnitIds.length).every(entry => !state.catalog.find(course => course.id === entry.courseId).prerequisites.some(text => /python|编程|pytorch/i.test(text))));
    if (checks.includes("scope")) assert.ok(draft.assembly.decisions.filter(entry => entry.selectedUnitIds.length).every(entry => /DeepLearning/i.test(state.catalog.find(course => course.id === entry.courseId).provider)));
    if (checks.includes("unknownSource")) assert.ok(draft.assembly.sourceIssues.some(entry => entry.status === "needs_text"));
    if (checks.includes("sourceDispositions")) {
      // 预登记预期：重复材料标记重复；不相关材料不得被采纳为核心（defer/exclude/重复均算未采纳）。
      const unadopted = (entry) => entry.duplicateOf || entry.role === "defer" || entry.role === "exclude";
      if (item.id === "D3") {
        assert.ok(draft.assembly.sourceSelections.some(entry => entry.duplicateOf));
        assert.ok(draft.assembly.sourceSelections.some(entry => entry.title.includes("音乐") && entry.role === "defer"));
      } else {
        assert.ok(draft.assembly.sourceSelections.some(unadopted), "不相关或重复材料应被标记为未采纳");
        assert.ok(draft.assembly.sourceSelections.some(entry => !unadopted(entry)), "相关材料应可被采用");
      }
    }
    if (checks.includes("locationFallback")) assert.ok(draft.assembly.segments.some(entry => entry.locatorMissing && entry.locatorLabel));
    await service.confirmCurriculum(owner, draft.id);
    const current = await service.getCurrentLearning(owner);
    assert.ok(current.activities.length > 0);
    assert.ok(current.activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0) <= current.weeklyPlan.capacityMinutes);
    const result = await service.recordLearningSignal(owner, current.activities[0].id, { ...item.feedback, submissionId: `fixture-${item.id}` });
    const feedback = await service.getLearningTaskResult(owner, current.activities[0].id);
    assert.notEqual(feedback.evidenceStrength, "strong");
    assert.deepEqual(feedback.demonstrated, []);
    if (item.feedback.value === "uncertain") assert.equal(result.interpretation.keepsActivityOpen, true);
    if (checks.includes("stageCompletion")) assert.equal((await service.getCurrentLearning(owner)).activities[0].status, "completed");
    if (checks.includes("newSourcePreservesCurrent")) await service.createContentSource(owner, { title: "新增候选", rawContent: "尝试学习Agent" });
    if (checks.includes("excludePreservesCurrent")) {
      const excluded = draft.assembly.decisions.find(entry => entry.selectedUnitIds.length).courseId;
      const revision = await service.reviseCurriculum(owner, draft.id, [{ type: "exclude_course", courseId: excluded }]);
      assert.ok(!revision.curriculum.assembly.segments.some(entry => entry.courseId === excluded));
      await service.rejectDecision(owner, revision.decision.id);
    }
    assert.equal((await service.getCurrentLearning(owner)).curriculum.id, draft.id);
    outputs.find(output => output.id === item.id).feedback = feedback;
  });
}
await writeFile(resolve(run.directory, "outputs.json"), JSON.stringify(outputs, null, 2));
run.report.outputsHash = fingerprint(outputs);
await writeFile(resolve(run.directory, "review-template.json"), JSON.stringify({ reviewer: "", outputsHash: run.report.outputsHash, cases: Object.fromEntries(selected.map(item => [item.id, Object.fromEntries(rubric.map(dimension => [dimension, { score: null, evidence: "" }]))])) }, null, 2));
run.report.productReview = "pending";
run.report.status = "completed";
await run.save();
console.log(`证据：${run.directory}`);
process.exitCode = !run.report.automatedPassed ? 1 : 2;
