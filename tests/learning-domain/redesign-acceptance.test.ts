import test from "node:test";
import assert from "node:assert/strict";
import { cases, modelSchedule, rubric } from "../../scripts/acceptance/redesign/cases.mjs";
import { validateReview } from "../../scripts/acceptance/redesign/report.mjs";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";
import { ModelProviderError } from "../../lib/learning/intelligence/model-provider.ts";

test("冻结样例分配为8开发4保留，模型计划20次且每例均被覆盖", () => {
  assert.equal(cases.filter((item: { split: string }) => item.split === "development").length, 8);
  assert.equal(cases.filter((item: { split: string }) => item.split === "holdout").length, 4);
  assert.equal(modelSchedule().length, 20);
  assert.equal(new Set(modelSchedule().map((item: { caseId: string }) => item.caseId)).size, 12);
});
test("量规拒绝过期输出、漏项、无依据和平均分掩盖失败", () => {
  const scores = Object.fromEntries(rubric.map((dimension: string) => [dimension, { score: 2, evidence: "输出第1段" }]));
  const review = { reviewer: "产品评审", outputsHash: "current", cases: { D1: scores } };
  assert.equal(validateReview(review, "current", rubric, ["D1"]), true);
  assert.equal(validateReview(review, "changed", rubric, ["D1"]), false);
  assert.equal(validateReview(review, "current", rubric, ["D1", "D2"]), false);
  scores[rubric[0]] = { score: 1, evidence: "有问题" };
  assert.equal(validateReview(review, "current", rubric, ["D1"]), false);
});
for (const failure of ["timeout", "malformed"] as const) {
  test(`模型${failure}时降级不伪造来源或直接确认路线`, async () => {
    const repository = new InMemoryCourseIntelligenceRepository();
    const adapter = { async complete() {
      if (failure === "timeout") throw new ModelProviderError("injected timeout", "timeout");
      return { content: "not valid json", promptTokens: 1, completionTokens: 1 };
    } };
    const gateway = new CourseIntelligenceModelGateway(repository, { primary: { apiKey: "test", model: "test", provider: "test", slot: "primary", baseUrl: "https://redesign.invalid" }, fallback: null }, "test", adapter);
    const service = new CourseIntelligenceService(repository, gateway, new InMemoryLearningStore());
    await service.initialize();
    const draft = await service.createCurriculum("redesign-failure", { goal: "理解AI能力边界", weeklyCapacity: "light", materials: [] });
    assert.equal(draft.status, "draft");
    assert.equal((await service.getCurrentLearning("redesign-failure")).activities.length, 0);
    assert.ok((await repository.listAnalysisRuns()).some(run => run.status !== "success"));
    assert.ok(draft.assembly.decisions.every(decision => decision.sourceCitations.length > 0));
  });
}
