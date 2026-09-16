// Course/Material Analyzer（规则版）测试：材料解析 → CourseMaterialAnalysis[]
// Full Chain Phase 1：courseAnalyzer 对内容包 materialId 输出 coveredCapabilityIds /
// topicKeywords；未命中 id 兜底不崩；规则确定性，同输入同输出。
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";

test("内容包 materialId 输出 coveredCapabilityIds / topicKeywords", () => {
  const materials = createRuleAgents().courseAnalyzer.analyzeMaterials({
    goalAnalysis: { goal: "系统学习 AIPM" },
    materialIds: ["res.gml-crash-course"],
  });
  assert.equal(materials.length, 1);
  const material = materials[0]!;
  assert.equal(material.materialId, "res.gml-crash-course");
  assert.equal(material.title, "Machine Learning Crash Course");
  assert.ok(material.topicKeywords!.length > 0, "应从资源标题/摘要派生主题关键词");
  assert.ok(
    material.coveredCapabilityIds!.includes("ai-literacy.mechanism"),
    "训练/推理/泛化材料应命中机制类能力",
  );
  assert.equal(material.sourceType, "official_docs");
  assert.equal(material.credibilityLevel, 5);
});

test("未命中 materialId 兜底：不崩、关键词来自 id、覆盖为空", () => {
  const materials = createRuleAgents().courseAnalyzer.analyzeMaterials({
    goalAnalysis: { goal: "系统学习 AIPM" },
    materialIds: ["custom-material-xyz"],
  });
  assert.equal(materials.length, 1);
  assert.equal(materials[0].title, "custom-material-xyz");
  assert.ok(materials[0].topicKeywords!.includes("custom-material-xyz"), "应从 id 派生关键词");
  assert.deepEqual(materials[0].coveredCapabilityIds, []);
});

test("空材料列表 → 空数组", () => {
  const materials = createRuleAgents().courseAnalyzer.analyzeMaterials({
    goalAnalysis: { goal: "系统学习 AIPM" },
    materialIds: [],
  });
  assert.deepEqual(materials, []);
});

test("确定性：同输入同输出", () => {
  const agents = createRuleAgents();
  const input = {
    goalAnalysis: { goal: "系统学习 AIPM" },
    materialIds: ["res.gml-crash-course", "res.openai-evals", "custom-x"],
  };
  assert.deepEqual(
    agents.courseAnalyzer.analyzeMaterials(input),
    agents.courseAnalyzer.analyzeMaterials(input),
  );
});
