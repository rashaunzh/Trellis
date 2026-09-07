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

test("grounding 失败进入人工评审，不调用备用模型", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    calls.push(String(request));
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"targetNodeIds":["invented.node"]}' } }],
      usage: { prompt_tokens: 4, completion_tokens: 3 },
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      primary: { apiKey: "primary", model: "primary-model", baseUrl: "https://primary.example/v1", provider: "qwen", slot: "primary" },
      fallback: { apiKey: "fallback", model: "fallback-model", baseUrl: "https://fallback.example/v1", provider: "glm", slot: "fallback" },
    });
    const result = await gateway.structuredDetailed({
      ownerId: "owner-grounding", kind: "learning_intent.v1", system: "return json", data: {},
      schema: z.object({ targetNodeIds: z.array(z.string()) }),
      grounding: (value) => value.targetNodeIds.every((id) => id === "known.node")
        ? { passed: true, issues: [] }
        : { passed: false, issues: ["unknown_node_id"] },
    });
    assert.equal(result.resolution, "needs_review");
    assert.equal(result.value, null);
    assert.equal(calls.filter((url) => url.includes("fallback.example")).length, 0);
    assert.equal(result.attempts[0]?.failureClass, "grounding");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("双模型技术失败返回 baseline，并保留完整 attempt trace", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", { status: 429 });
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      primary: { apiKey: "primary", model: "primary-model", baseUrl: "https://primary.example/v1", provider: "qwen", slot: "primary" },
      fallback: { apiKey: "fallback", model: "fallback-model", baseUrl: "https://fallback.example/v1", provider: "glm", slot: "fallback" },
    });
    const result = await gateway.structuredDetailed({
      ownerId: "owner-baseline", kind: "course_outline.v1", system: "return json", data: {},
      schema: z.object({ title: z.string() }), context: { workflowRunId: "workflow.1", decisionId: "decision.1" },
    });
    assert.equal(result.resolution, "baseline");
    assert.equal(result.attempts.length, 4);
    assert.ok(result.attempts.every((attempt) => attempt.failureClass === "rate_limit"));
    const traces = await repository.listAnalysisRuns({ requestId: result.requestId });
    assert.equal(traces.length, 4);
    assert.ok(traces.every((trace) => trace.workflowRunId === "workflow.1" && trace.decisionId === "decision.1"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("非 json_schema provider 会收到字段合同与 provider 专属参数", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_request, init) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"ok","targetNodeIds":["ai.foundation"]}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 4 },
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      primary: {
        apiKey: "primary", model: "qwen-model", baseUrl: "https://qwen.example/v1",
        provider: "qwen", slot: "primary", structuredOutput: "json_object",
      },
      fallback: null,
    });
    const result = await gateway.structured({
      ownerId: "owner-contract", kind: "learning_intent.v1", system: "理解学习目标", data: {},
      schema: z.object({ summary: z.string(), targetNodeIds: z.array(z.string()) }),
    });
    assert.deepEqual(result, { summary: "ok", targetNodeIds: ["ai.foundation"] });
    const body = requests[0] as {
      enable_thinking?: boolean;
      response_format?: { type?: string };
      messages?: Array<{ role?: string; content?: string }>;
    };
    assert.equal(body.enable_thinking, false);
    assert.equal(body.response_format?.type, "json_object");
    assert.match(body.messages?.[0]?.content ?? "", /targetNodeIds/);
    assert.match(body.messages?.[0]?.content ?? "", /JSON Schema/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GLM adapter 发送低推理强度参数", async () => {
  const repository = new InMemoryCourseIntelligenceRepository();
  let requestBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_request, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"ok"}' } }],
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const gateway = new CourseIntelligenceModelGateway(repository, {
      primary: {
        apiKey: "primary", model: "glm-model", baseUrl: "https://glm.example/v1",
        provider: "glm", slot: "primary", structuredOutput: "prompt_json",
      },
      fallback: null,
    });
    await gateway.structured({
      ownerId: "owner-glm", kind: "course_outline.v1", system: "提取课程目录", data: {},
      schema: z.object({ summary: z.string() }),
    });
    assert.equal(requestBody.reasoning_effort, "low");
    assert.equal("response_format" in requestBody, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
