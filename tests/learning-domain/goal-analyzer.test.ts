// Goal Analyzer（规则版）测试：目标解析 → GoalAnalysis
// Full Chain Phase 1：goalAnalyzer 输出 goal / domain / topicKeywords / depth /
// targetCapabilityIds；规则确定性，同输入同输出。
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";

test("「系统学习 AIPM」输出 topicKeywords / domain / depth", () => {
  const analysis = createRuleAgents().goalAnalyzer.analyzeGoal({ goal: "系统学习 AIPM" });
  assert.equal(analysis.goal, "系统学习 AIPM");
  assert.ok(analysis.topicKeywords!.length > 0, "应有主题关键词");
  assert.ok(analysis.topicKeywords!.includes("aipm"), "应派生 aipm 关键词");
  assert.equal(analysis.domain, "AIPM", "纯 ASCII 领域词应大写");
  assert.ok([1, 2, 3].includes(analysis.depth!), "depth 应为 1|2|3");
  assert.deepEqual(analysis.targetCapabilityIds, [], "目标能力 id 由服务层回填，analyzer 输出为空");
});

test("深度推断：了解/入门类目标 → 1", () => {
  const analysis = createRuleAgents().goalAnalyzer.analyzeGoal({ goal: "了解 AI 基础概念" });
  assert.equal(analysis.depth, 1);
});

test("深度推断：产出/应用类目标 → 3", () => {
  const analysis = createRuleAgents().goalAnalyzer.analyzeGoal({ goal: "学会做一个知识问答应用" });
  assert.equal(analysis.depth, 3);
});

test("深度推断：build_first 无深度动词 → 3，默认 → 2", () => {
  const build = createRuleAgents().goalAnalyzer.analyzeGoal({
    goal: "系统学习 AIPM",
    preference: "build_first",
  });
  assert.equal(build.depth, 3);
  const breadth = createRuleAgents().goalAnalyzer.analyzeGoal({ goal: "系统学习 AIPM" });
  assert.equal(breadth.depth, 2);
});

test("确定性：同输入同输出", () => {
  const agents = createRuleAgents();
  const input = { goal: "系统学习 AIPM", preference: "build_first" as const };
  assert.deepEqual(
    agents.goalAnalyzer.analyzeGoal(input),
    agents.goalAnalyzer.analyzeGoal(input),
  );
});

test("空目标不崩：空关键词、无领域、depth 兜底 2", () => {
  const analysis = createRuleAgents().goalAnalyzer.analyzeGoal({ goal: "   " });
  assert.deepEqual(analysis.topicKeywords, []);
  assert.equal(analysis.domain, undefined);
  assert.equal(analysis.depth, 2);
});
