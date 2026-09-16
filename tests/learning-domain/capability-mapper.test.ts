// Capability Mapper 测试：goal + 课程/材料分析 → Domain / Capability / Signal / Evidence Requirement
// 验收场景：
//   1. AIPM 学习目标 → AI 产品/AI 学习相关 capability（复用现有内容包）
//   2. RAG/评估类材料 → RAG 评估相关 signals（目标 + 材料共同命中）
//   3. 非 AI 主题（英语口语）→ generic fallback capabilities（不崩）
//   4. 每个 capability 至少 2 个 signals
//   5. 每个 signal 都有 evidenceRequirement（可被 Evidence Review 消费）
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";
import { NODE_SIGNALS, DEFAULT_SIGNALS } from "../../lib/learning/domain/signals.ts";
import type { CapabilityMap, CapabilityMapperInput } from "../../lib/learning/agents/types.ts";

const mapper = createRuleAgents().capabilityMapper;

const LEVELS: string[] = ["foundation", "core", "advanced", "optional"];
const SOURCES: string[] = ["existing_content", "inferred"];

// ── 结构不变量：所有路径的输出都必须满足 ──────────────────
function assertCapabilityMapShape(map: CapabilityMap) {
  assert.ok(map.domain!.length > 0, "domain 不能为空");
  assert.ok(Array.isArray(map.capabilities) && map.capabilities.length > 0, "capabilities 不能为空");
  assert.ok(["existing_content", "generic_fallback"].includes(map.strategy!), "strategy 非法");
  assert.ok(map.rationale!.length > 0, "rationale 不能为空");
  const ids = new Set(map.capabilities.map((capability) => capability.id));
  assert.equal(ids.size, map.capabilities.length, "capability id 必须唯一");
  for (const capability of map.capabilities) {
    assert.ok(capability.id.length > 0);
    assert.ok(capability.title.length > 0);
    assert.ok(capability.description.length > 0);
    assert.ok(LEVELS.includes(capability.level!), `${capability.id} 的 level 非法：${capability.level}`);
    assert.ok(SOURCES.includes(capability.source!), `${capability.id} 的 source 非法：${capability.source}`);
    // 每个 capability 至少 2 个 signals（短语视图）
    assert.ok(
      capability.signals.length >= 2,
      `${capability.id}（${capability.title}）应有至少 2 个 signals，实际 ${capability.signals.length}`,
    );
    // 完整信号规格（Evidence Requirement）与短语视图一一对应
    assert.ok(
      Array.isArray(capability.signalSpecs) && capability.signalSpecs.length === capability.signals.length,
      `${capability.id} 的 signalSpecs 应与 signals 一一对应`,
    );
    // prerequisites 必须引用本图内的 capability id
    for (const prereq of capability.prerequisites!) {
      assert.ok(ids.has(prereq), `${capability.id} 的前置 ${prereq} 不在本能力图内`);
    }
    for (const signal of capability.signalSpecs!) {
      assert.ok(signal.id.length > 0);
      assert.ok(signal.label.length >= 2, `${signal.id} 的 label 不能太抽象：${signal.label}`);
      assert.ok(signal.description.length > 0);
      // 每个 signal 都有 evidenceRequirement，且以 label 开头（Evidence Review 短语匹配契约）
      assert.ok(
        signal.evidenceRequirement.length > 0 && signal.evidenceRequirement.startsWith(signal.label),
        `${signal.id} 缺少以 label 开头的 evidenceRequirement`,
      );
      assert.ok(signal.weight > 0 && signal.weight <= 1, `${signal.id} 的 weight 非法：${signal.weight}`);
      // 规格的 label 必须出现在短语视图 signals 中（两视图同源）
      assert.ok(capability.signals.includes(signal.label), `${signal.id} 的 label 应在 signals 短语视图中`);
    }
  }
}

// ── 场景 1：AIPM 学习目标 → AI 产品/AI 学习相关 capability ──
test("AIPM 学习目标映射到 AI 产品相关 capability（复用现有内容包）", () => {
  const map = mapper.mapCapabilities({
    goalAnalysis: { goal: "想成为 AI 产品经理", topicKeywords: ["AI", "产品", "经理"] },
    materials: [],
  });
  assert.equal(map.strategy, "existing_content");
  assert.ok(map.domain!.includes("AI"), `domain 应含 AI：${map.domain}`);
  const capIds = map.capabilities.map((capability) => capability.id);
  // AI 产品分支三个节点全部命中
  for (const id of ["ai-product.problem-def", "ai-product.capability-design", "ai-product.eval-decision"]) {
    assert.ok(capIds.includes(id), `能力图缺少 ${id}`);
  }
  // 前置闭合：产品分支入口的前置（AI 通识机制）补入图内
  assert.ok(capIds.includes("ai-literacy.mechanism"), "能力图应补入 ai-literacy.mechanism 前置");
  // 命中来源为现有内容包
  assert.ok(map.capabilities.every((capability) => capability.source === "existing_content"));
  // 信号标签全部来自内容包信号词汇（Evidence Review 已知短语）
  const vocabulary = new Set(Object.values(NODE_SIGNALS).flat());
  for (const capability of map.capabilities) {
    for (const label of capability.signals) {
      assert.ok(vocabulary.has(label), `信号「${label}」不在内容包信号词汇中`);
    }
  }
  assertCapabilityMapShape(map);
});

// ── 场景 2：RAG/评估类材料 → RAG 评估相关 signals ──
test("RAG/评估类材料映射到 RAG 评估相关 signals（目标+材料共同命中）", () => {
  const map = mapper.mapCapabilities({
    goalAnalysis: { goal: "学习 RAG 应用的评估方法", topicKeywords: ["RAG"] },
    materials: [
      {
        materialId: "m-rag-eval",
        title: "RAG 评测实践",
        description: "为 RAG 应用搭建评测集并比较版本",
        topicKeywords: ["评测"],
      },
    ],
  });
  assert.equal(map.strategy, "existing_content");
  const ragCap = map.capabilities.find((capability) => capability.id === "ai-app-dev.rag");
  const evalCap = map.capabilities.find((capability) => capability.id === "ai-app-dev.eval-harness");
  assert.ok(ragCap, "应包含 RAG 能力节点");
  assert.ok(evalCap, "应包含最小评测集能力节点");
  const labels = new Set([...(ragCap?.signals ?? []), ...(evalCap?.signals ?? [])]);
  // RAG 评估相关信号（Evidence Review 词汇：测试问题设计/标准答案定义/测试集设计/失败类型分类）
  for (const expected of ["测试问题设计", "标准答案定义", "测试集设计", "失败类型分类"]) {
    assert.ok(labels.has(expected), `缺少 RAG 评估信号：${expected}`);
  }
  // 命中审计记录了两个节点的得分
  const matchedIds = map.matchedContent!.map((item) => item.nodeId);
  assert.ok(matchedIds.includes("ai-app-dev.rag"));
  assert.ok(matchedIds.includes("ai-app-dev.eval-harness"));
  assertCapabilityMapShape(map);
});

// ── 场景 3：非 AI 主题 → generic fallback ──
test("非 AI 主题（英语口语）返回 generic fallback capabilities，不崩", () => {
  const map = mapper.mapCapabilities({
    goalAnalysis: { goal: "提升英语口语表达能力", topicKeywords: ["英语口语"] },
    materials: [],
  });
  assert.equal(map.strategy, "generic_fallback");
  assert.ok(map.capabilities.every((capability) => capability.source === "inferred"));
  assert.deepEqual(map.matchedContent, []);
  // 四层齐全：foundation / core / advanced / optional
  const levels = map.capabilities.map((capability) => capability.level);
  for (const level of ["foundation", "core", "advanced", "optional"] as const) {
    assert.ok(levels.includes(level), `fallback 缺少 ${level} 层级`);
  }
  // 领域来自目标关键词
  assert.ok(map.domain!.includes("英语口语"), `domain 应含英语口语：${map.domain}`);
  // 信号可被 Evidence Review 消费：基础词汇来自 DEFAULT_SIGNALS，另有领域短语信号
  const labels = map.capabilities.flatMap((capability) => capability.signals);
  assert.ok(
    labels.some((label) => DEFAULT_SIGNALS.includes(label)),
    "fallback 信号应包含 Evidence Review 已认识的 DEFAULT_SIGNALS 词汇",
  );
  assert.ok(labels.includes("英语口语实践"), "领域明确时应追加领域短语信号");
  assertCapabilityMapShape(map);
});

// ── 场景 4 & 5：信号数量与 evidenceRequirement 不变量（两条路径都满足）──
test("每个 capability 至少 2 个 signals，每个 signal 都有 evidenceRequirement", () => {
  const inputs: CapabilityMapperInput[] = [
    { goalAnalysis: { goal: "学会用 AI 做知识问答应用", topicKeywords: ["AI", "RAG"] }, materials: [] },
    {
      goalAnalysis: { goal: "练习英语口语", topicKeywords: [] },
      materials: [{ materialId: "m1", title: "口语对话课程", description: "场景对话练习", topicKeywords: [] }],
    },
  ];
  for (const input of inputs) {
    assertCapabilityMapShape(mapper.mapCapabilities(input));
  }
});

test("mapCapabilities 确定性：相同输入产生相同输出", () => {
  const input: CapabilityMapperInput = {
    goalAnalysis: { goal: "学习 RAG 应用的评估方法", topicKeywords: ["RAG"] },
    materials: [{ materialId: "m1", title: "RAG 评测", description: "评测集", topicKeywords: ["评测"] }],
  };
  assert.deepEqual(mapper.mapCapabilities(input), mapper.mapCapabilities(input));
});

test("topicKeywords 为空时从目标原文派生关键词（防御性兜底）", () => {
  const map = mapper.mapCapabilities({
    goalAnalysis: { goal: "学习 RAG 检索增强生成", topicKeywords: [] },
    materials: [],
  });
  assert.equal(map.strategy, "existing_content");
  assert.ok(
    map.capabilities.some((capability) => capability.id === "ai-app-dev.rag"),
    "应从目标原文派生 RAG 关键词并命中 ai-app-dev.rag",
  );
  assertCapabilityMapShape(map);
});

test("关键词完全不命中时回退 generic（minMatchScore 阈值生效）", () => {
  const map = mapper.mapCapabilities({
    goalAnalysis: { goal: "学习木工雕刻", topicKeywords: ["木工", "雕刻"] },
    materials: [],
    minMatchScore: 0.5,
  });
  assert.equal(map.strategy, "generic_fallback");
  assertCapabilityMapShape(map);
});
