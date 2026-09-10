import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cases, rubric, modelSchedule } from "./cases.mjs";
import { createReport, fingerprint } from "./report.mjs";
import { InMemoryCourseIntelligenceRepository } from "../../../lib/learning/intelligence/repository.ts";
import { InMemoryLearningStore } from "../../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway, builtInModelConfig } from "../../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../../lib/learning/intelligence/service.ts";

try { loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const routes = builtInModelConfig(process.env);
const run = await createReport("model", { fixtureHash: fingerprint(cases), schedule: modelSchedule(), mode: "real-provider-synthetic-inputs", provider: routes.primary?.provider, model: routes.primary?.model, fallbackModel: routes.fallback?.model, sourceVerification: "local-catalog-and-synthetic-text" });
if (!routes.primary) {
  run.report.status = "blocked";
  run.report.blockedReason = "未配置主模型；未调用，不计为通过";
  await run.save(); console.log(run.report.blockedReason); process.exit(2);
}
const outputs = [];
for (const scheduled of modelSchedule()) {
  const item = cases.find(entry => entry.id === scheduled.caseId);
  const repository = new InMemoryCourseIntelligenceRepository(); // 每次独立缓存，重复样例不会命中缓存。
  const store = new InMemoryLearningStore();
  const service = new CourseIntelligenceService(repository, new CourseIntelligenceModelGateway(repository, routes), store);
  const owner = `redesign-model-${crypto.randomUUID()}`;
  await run.check(`${item.id}/${scheduled.repetition}`, async () => {
    const output = { ...scheduled, input: item.input, sourceAnalyses: [] };
    outputs.push(output);
    try {
      await service.initialize();
      for (const input of item.sources ?? []) {
        const source = await service.createContentSource(owner, input);
        const analyzed = await service.analyzeUserContentSource(owner, source.id);
        output.sourceAnalyses.push(analyzed);
        if (input.rawContent) await service.confirmUserContentFragments(owner, source.id, { fragmentIds: analyzed.analysis.fragments.map(fragment => fragment.id), decision: "confirmed" });
      }
      if (item.expectedError) {
        await assert.rejects(service.createCurriculum(owner, item.input), new RegExp(item.expectedError));
        output.outcome = "capacity-conflict-before-model";
      } else {
        const draft = await service.createCurriculum(owner, item.input);
        output.assembly = draft.assembly;
        output.graphVersion = (await repository.getPublishedGraph()).version;
        output.sourceVersions = (await repository.listAvailableCourses(owner)).map(course => ({ id: course.genome.id, version: course.genome.version }));
        await service.confirmCurriculum(owner, draft.id);
        const current = await service.getCurrentLearning(owner);
        await service.recordLearningSignal(owner, current.activities[0].id, { ...item.feedback, submissionId: crypto.randomUUID() });
        output.feedback = await service.getLearningTaskResult(owner, current.activities[0].id);
        output.feedbackMode = "product-signal-policy";
        const traces = await repository.listAnalysisRuns({ ownerId: owner });
        assert.ok(traces.some(trace => trace.kind === "learning_intent.v1" && trace.status === "success"), "目标理解未出现成功模型调用，不能把基线降级记作模型通过");
      }
    } finally {
      // 不保存配置对象、Key 或请求认证头；失败也保留运行记录。
      output.traces = (await repository.listAnalysisRuns({ ownerId: owner })).map(({ id, kind, model, provider, status, latencyMs, promptTokens, completionTokens, error }) => ({ id, kind, model, provider, status, latencyMs, promptTokens, completionTokens, error }));
      await writeFile(resolve(run.directory, "outputs.json"), JSON.stringify(outputs, null, 2));
    }
  });
}
run.report.outputsHash = fingerprint(outputs);
run.report.productReview = "pending";
run.report.status = "completed";
run.report.scheduledTrials = 20;
run.report.actualModelAttempts = outputs.reduce((sum, item) => sum + item.traces.length, 0);
await writeFile(resolve(run.directory, "review-template.json"), JSON.stringify({ reviewer: "", outputsHash: run.report.outputsHash, cases: Object.fromEntries(modelSchedule().map(item => [`${item.caseId}/${item.repetition}`, Object.fromEntries(rubric.map(dimension => [dimension, { score: null, evidence: "" }]))])) }, null, 2));
await run.save();
console.log(`全部输出与失败记录：${run.directory}`);
process.exitCode = run.report.automatedPassed ? 2 : 1;
