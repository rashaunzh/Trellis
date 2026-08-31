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

test("主模型连续失败后使用备用模型，且不能绕过同一结构合同", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = String(request);
    calls.push(url);
    if (url.includes("primary.example")) return new Response("upstream failed", { status: 500 });
    return new Response(JSON.stringify({
      choices: [{ message: { content: "{\"summary\":\"fallback-ok\"}" } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      primary: { apiKey: "primary", model: "primary-model", baseUrl: "https://primary.example/v1", provider: "primary", slot: "primary" },
      fallback: { apiKey: "fallback", model: "fallback-model", baseUrl: "https://fallback.example/v1", provider: "fallback", slot: "fallback" },
    });
    const result = await gateway.structured({
      ownerId: "owner-fallback", kind: "fallback-test", system: "return json", data: {},
      schema: z.object({ summary: z.literal("fallback-ok") }),
    });
    assert.deepEqual(result, { summary: "fallback-ok" });
    assert.equal(calls.filter((url) => url.includes("primary.example")).length, 2);
    assert.equal(calls.filter((url) => url.includes("fallback.example")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
