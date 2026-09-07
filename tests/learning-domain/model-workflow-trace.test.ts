import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";
import { startCourseIntelligenceWorkflow } from "../../lib/learning/intelligence/workflow-runtime.ts";
import type { ModelProviderAdapter } from "../../lib/learning/intelligence/model-provider.ts";

test("Mastra 课程编排将模型 attempt 关联到 workflow 与决策", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const adapter: ModelProviderAdapter = {
    async complete() {
      return {
        content: JSON.stringify({ summary: "建立 AI 产品场景判断和评测能力", targetNodeIds: ["pm.use-case-fit", "pm.eval-design"], outOfScope: [] }),
        promptTokens: 12, completionTokens: 8,
      };
    },
  };
  const gateway = new CourseIntelligenceModelGateway(repository, {
    apiKey: "test", model: "trace-model", baseUrl: "https://model.invalid/v1",
  }, "qwen", adapter);
  const service = new CourseIntelligenceService(repository, gateway, new InMemoryLearningStore());
  await service.initialize();

  const result = await startCourseIntelligenceWorkflow({
    ownerId: "owner-workflow-trace", rawIntake: {
      goal: "学习 AI 产品场景判断和评测", weeklyCapacity: "light", materials: [],
    }, service, repository,
  });
  const traces = await repository.listAnalysisRuns({ ownerId: "owner-workflow-trace" });
  assert.equal(traces.length, 1);
  assert.equal(traces[0]?.workflowRunId, result.workflowRunId);
  assert.equal(traces[0]?.decisionId, result.decisionId);
  const decision = await repository.getDecision(result.decisionId, "owner-workflow-trace");
  assert.deepEqual(decision?.modelRoute.requestIds, [traces[0]?.requestId]);
});
