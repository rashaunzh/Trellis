// LLM Evidence Evaluator 回退契约测试
// 证明："LLM 增强失败时自动回退规则版"是真的。
// 用本地 loopback HTTP server 模拟 OpenAI 兼容接口（不联网、不调用真实 API）。
// 1. 无 llm / 无 key → 回退规则版
// 2. LLM 返回非法 JSON → 回退
// 3. LLM 返回非法 verdict → 回退
// 4. HTTP 非 2xx / 空 content → 回退
// 5. 回退结果完整（evidenceCard / signalReviews / dimensionScores 与规则版逐字段一致）
// 6. 合法响应时 LLM 字段生效（增强路径不破坏结构）
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

import { LLMEvidenceEvaluator } from "../../lib/learning/agents/llm-evidence-evaluator.ts";
import { RuleEvidenceEvaluator } from "../../lib/learning/agents/evidence-evaluator.ts";

const BASE_INPUT = {
  evidenceId: "llm-fallback-1",
  nodeId: "ai-literacy.mechanism",
  nodeTitle: "机制与边界",
  targetLevel: 2,
  evidenceType: "explanation" as const,
  content:
    "训练机制解释：语言模型从训练数据学统计规律而非存储事实，训练阶段调整参数，推理阶段逐词预测。" +
    "概率推理说明：输出按概率分布采样，流畅不等于正确。幻觉风险识别：幻觉来自概率采样与训练数据覆盖不足。" +
    "泛化边界说明：泛化依赖训练数据分布，超出分布会失败。",
  criteria: "",
  isSkipValidation: false,
};

/** 返回 OpenAI 兼容 chat/completions 响应体 */
function openAIResponse(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

const servers: Server[] = [];
test.after(() => {
  for (const server of servers) server.close();
});

async function startFakeLLM(
  handler: () => { status: number; body: unknown },
): Promise<{ baseUrl: string }> {
  const server = createServer((_req, res) => {
    const { status, body } = handler();
    res.writeHead(status, { "content-type": "application/json" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server 应监听随机端口");
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

const fallback = new RuleEvidenceEvaluator();
const evaluator = new LLMEvidenceEvaluator();
const llmConfig = { baseUrl: "", apiKey: "test-key", model: "test-model" };

test("无 llm 配置：直接回退规则版，输出逐字段一致", async () => {
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT);
  assert.deepEqual(actual, expected);
});

test("llm 缺 apiKey：回退规则版", async () => {
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, apiKey: "" });
  assert.deepEqual(actual, expected);
});

test("LLM 返回非法 JSON：回退规则版，结构完整", async () => {
  let scenario = () => ({ status: 200, body: openAIResponse("这完全不是 JSON") });
  const { baseUrl } = await startFakeLLM(() => scenario());
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  assert.deepEqual(actual, expected);
  scenario = () => ({ status: 200, body: openAIResponse("") }); // 防止未覆盖分支误用
});

test("LLM 返回非法 verdict：回退规则版", async () => {
  const { baseUrl } = await startFakeLLM(() => ({
    status: 200,
    body: openAIResponse('{"verdict":"maybe","confidence":0.9}'),
  }));
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  assert.deepEqual(actual, expected);
});

test("LLM HTTP 500：回退规则版", async () => {
  const { baseUrl } = await startFakeLLM(() => ({ status: 500, body: { error: "boom" } }));
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  assert.deepEqual(actual, expected);
});

test("LLM 返回空 content：回退规则版", async () => {
  const { baseUrl } = await startFakeLLM(() => ({
    status: 200,
    body: { choices: [{ message: { content: "" } }] },
  }));
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  assert.deepEqual(actual, expected);
});

test("回退结果包含 evidenceCard / signalReviews / dimensionScores", async () => {
  const { baseUrl } = await startFakeLLM(() => ({
    status: 200,
    body: openAIResponse("垃圾输入"),
  }));
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  const expected = await fallback.evaluateEvidence(BASE_INPUT);
  // 结构完整性：回退输出不是残缺对象
  assert.deepEqual(actual.evidenceCard, expected.evidenceCard);
  assert.deepEqual(actual.signalReviews, expected.signalReviews);
  assert.deepEqual(actual.dimensionScores, expected.dimensionScores);
  assert.ok(actual.evidenceCard.summary.length > 0);
  assert.ok(actual.signalReviews.length > 0);
  assert.ok(actual.dimensionScores.length === 7);
});

test("合法 LLM 响应：LLM 字段生效，结构字段回退到规则版", async () => {
  const { baseUrl } = await startFakeLLM(() => ({
    status: 200,
    body: openAIResponse('{"verdict":"accepted","confidence":0.9,"suggestedLevel":3}'),
  }));
  const base = await fallback.evaluateEvidence(BASE_INPUT);
  const actual = await evaluator.evaluateEvidence(BASE_INPUT, { ...llmConfig, baseUrl });
  assert.equal(actual.verdict, "accepted", "LLM 的 verdict 应生效");
  assert.equal(actual.confidence, 0.9, "LLM 的 confidence 应生效");
  // suggestedLevel 被 clamp 到 targetLevel 内（设计：LLM 不能给出超过目标等级的建议）
  assert.equal(actual.suggestedLevel, 2);
  // 未提供的结构字段回退规则版
  assert.deepEqual(actual.evidenceCard, base.evidenceCard);
  assert.deepEqual(actual.signalReviews, base.signalReviews);
  assert.deepEqual(actual.dimensionScores, base.dimensionScores);
});
