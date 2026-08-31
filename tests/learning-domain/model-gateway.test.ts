import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  CourseIntelligenceModelGateway,
  hashInput,
} from "../../lib/learning/intelligence/model-gateway.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";

test("损坏缓存不会阻断重算，真实 token usage 会进入分析记录", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const data = { outline: ["第一章"] };
  const inputHash = await hashInput({
    contractVersion: "course-intelligence.v2",
    provider: "openai-compatible",
    baseUrl: "https://model.example/v1",
    model: "benchmark-model",
    kind: "cache-recovery",
    system: "return json",
    data: JSON.stringify(data),
  });
  await repository.saveAnalysisRun({
    id: "bad-cache",
    ownerId: "owner-model-test",
    kind: "cache-recovery",
    inputHash,
    provider: "openai-compatible",
    model: "benchmark-model",
    status: "success",
    outputJson: "not-json",
    error: "",
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 1,
    createdAt: new Date().toISOString(),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "{\"summary\":\"ok\"}" } }],
    usage: { prompt_tokens: 21, completion_tokens: 7 },
  }), { headers: { "content-type": "application/json" } });
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      apiKey: "test-key",
      model: "benchmark-model",
      baseUrl: "https://model.example/v1",
    });
    const result = await gateway.structured({
      ownerId: "owner-model-test",
      kind: "cache-recovery",
      system: "return json",
      data,
      schema: z.object({ summary: z.string() }),
    });
    assert.deepEqual(result, { summary: "ok" });
    const usage = await repository.getAnalysisUsageSince("owner-model-test", "2020-01-01T00:00:00.000Z");
    assert.equal(usage.tokens, 28);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
