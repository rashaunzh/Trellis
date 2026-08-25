// Learning Decision Policy（规则版）测试：学习处境 → 下一步学习决策
// 覆盖"动态学习伙伴"的最小决策场景，不接 UI/schema/runtime。
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";

const policy = createRuleAgents().learningDecisionPolicy;

test("目标模糊：先 clarify_goal，不直接排路线", () => {
  const decision = policy.decideNextMove({ goalText: "想学 AI" });
  assert.equal(decision.situation.currentStage, "orientation");
  assert.equal(decision.primaryNeed, "clarify_goal");
  assert.equal(decision.recommendedMode, "explain");
  assert.equal(decision.evidencePolicy, "soft_signal");
  assert.ok(decision.toolCalls.includes("goalAnalyzer"));
  assert.ok(decision.reason.includes("目标"));
});

test("资料不可靠：先 review_material，而不是盲目当主线", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并在 14 天内产出一个作品集项目",
    courseMaterials: [{
      materialId: "course.marketing",
      title: "7 天成为 AI 产品经理训练营",
      description: "承诺快速转型，但缺少项目和评估标准。",
      credibilityLevel: 1,
      coveredCapabilityIds: [],
    }],
    capabilityMap: {
      version: "generic-v1",
      source: "generic",
      strategy: "generic_fallback",
      capabilities: [],
      edges: [],
    },
  });
  assert.equal(decision.primaryNeed, "review_material");
  assert.equal(decision.recommendedMode, "rubric_review");
  assert.equal(decision.evidencePolicy, "soft_signal");
  assert.ok(decision.toolCalls.includes("courseAnalyzer"));
  assert.ok(decision.expectedOutcome.includes("core/reference/supplement/not_recommended"));
});

test("MaterialReview 为 not_recommended：DecisionPolicy 优先 route_correction", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并在 14 天内产出一个作品集项目",
    materialReviews: [{
      materialId: "course.bad",
      title: "7 天速成 AI PM",
      verdict: "not_recommended",
      qualityScore: 30,
      personalFitScore: 25,
      scores: {
        sourceCredibility: 35,
        structureClarity: 30,
        practiceDensity: 20,
        assessmentClarity: 20,
        projectRelevance: 20,
        freshness: 55,
        marketingRisk: 90,
        beginnerFit: 40,
        goalFit: 35,
        timeFit: 30,
      },
      strengths: [],
      risks: ["存在过度承诺或营销风险"],
      missingAreas: ["缺少评估标准"],
      rationale: "当前阶段不建议使用：质量 30/100，个人适配 25/100。",
    }],
  });
  assert.equal(decision.primaryNeed, "route_correction");
  assert.equal(decision.recommendedMode, "rubric_review");
  assert.ok(decision.toolCalls.includes("materialReviewer"));
});

test("MaterialReview 为 supplement：DecisionPolicy 优先 review_material", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并在 14 天内产出一个作品集项目",
    materialReviews: [{
      materialId: "course.supplement",
      title: "AIPM 入门概念课",
      verdict: "supplement",
      qualityScore: 55,
      personalFitScore: 50,
      scores: {
        sourceCredibility: 55,
        structureClarity: 70,
        practiceDensity: 30,
        assessmentClarity: 30,
        projectRelevance: 25,
        freshness: 55,
        marketingRisk: 20,
        beginnerFit: 75,
        goalFit: 55,
        timeFit: 35,
      },
      strengths: ["结构较清晰"],
      risks: [],
      missingAreas: ["缺少阶段产出或项目连接"],
      rationale: "可用但需要补充材料或练习：质量 55/100，个人适配 50/100。",
    }],
  });
  assert.equal(decision.primaryNeed, "review_material");
  assert.equal(decision.evidencePolicy, "soft_signal");
  assert.ok(decision.nextAction.includes("补齐"));
});

test("小白基础阶段：优先 build_understanding，用软信号观察理解", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并能解释 AI 产品的基本判断逻辑",
    goalAnalysis: { goal: "系统学习 AIPM", depth: 1, topicKeywords: ["aipm"] },
    courseMaterials: [{
      materialId: "res.good",
      title: "AI PM 入门材料",
      coveredCapabilityIds: ["ai-literacy.mechanism"],
      credibilityLevel: 3,
    }],
    capabilityLevelById: { "ai-literacy.mechanism": 0 },
    hasRoute: true,
  });
  assert.equal(decision.situation.learnerLevel, "beginner");
  assert.equal(decision.primaryNeed, "build_understanding");
  assert.equal(decision.recommendedMode, "feynman");
  assert.equal(decision.evidencePolicy, "soft_signal");
  assert.ok(decision.nextAction.includes("解释"));
});

test("看了很多但没有 hard evidence：转向 produce_artifact", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并产出一个 AI 产品评测作品",
    courseMaterials: [{
      materialId: "res.good",
      title: "AI 产品评测材料",
      coveredCapabilityIds: ["ai-product.eval"],
      credibilityLevel: 3,
    }],
    capabilityLevelById: { "ai-product.eval": 2 },
    hasRoute: true,
    hasActiveActivities: true,
    recentSoftSignalCount: 4,
    recentHardEvidenceCount: 0,
  });
  assert.equal(decision.primaryNeed, "produce_artifact");
  assert.equal(decision.recommendedMode, "project_build");
  assert.equal(decision.evidencePolicy, "hard_evidence");
  assert.ok(decision.expectedOutcome.includes("hard evidence"));
});

test("证据失败：进入 review_and_repair，先修复缺口", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 RAG 评估，并完成一个测试表",
    latestReviewVerdict: "needs_revision",
    missingSignals: ["标准答案定义", "引用命中判断"],
    repeatedGaps: ["标准答案定义"],
    capabilityLevelById: { "ai-app-dev.rag": 2 },
    recentHardEvidenceCount: 1,
  });
  assert.equal(decision.situation.currentStage, "review_and_repair");
  assert.equal(decision.primaryNeed, "repair_gap");
  assert.equal(decision.evidencePolicy, "hard_evidence");
  assert.equal(decision.tolerance.canReorder, false);
  assert.ok(decision.toolCalls.includes("adjustmentAdvisor"));
});

test("复习到期：进入 consolidation，安排 spaced_review", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并持续巩固核心概念",
    dueReviewCount: 2,
    capabilityLevelById: { "ai-literacy.mechanism": 3 },
    recentHardEvidenceCount: 1,
  });
  assert.equal(decision.situation.currentStage, "consolidation");
  assert.equal(decision.primaryNeed, "spaced_review");
  assert.equal(decision.recommendedMode, "spaced_review");
  assert.ok(decision.signalTypes.includes("behavior_signal"));
});

test("周期临近且已有产出：进入 portfolio_packaging", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并在本周整理作品集案例",
    weeksRemaining: 1,
    capabilityLevelById: { "ai-product.eval": 2 },
    recentHardEvidenceCount: 2,
  });
  assert.equal(decision.situation.currentStage, "portfolio_packaging");
  assert.equal(decision.primaryNeed, "package_portfolio");
  assert.equal(decision.recommendedMode, "portfolio_packaging");
  assert.equal(decision.evidencePolicy, "hard_evidence");
});

test("连续未完成：优先 motivation_support，降低范围", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 Python，并能做一个小工具",
    completionRate: 0.2,
    skippedActivities: 3,
    capabilityLevelById: { "generic.python.basics": 1 },
  });
  assert.equal(decision.situation.motivationState, "blocked");
  assert.equal(decision.primaryNeed, "motivation_support");
  assert.equal(decision.recommendedMode, "guided_practice");
  assert.equal(decision.evidencePolicy, "behavior_signal");
  assert.ok(decision.reason.includes("连续未完成"));
});

test("稳定推进：无高优先级风险时进入 practice_skill", () => {
  const decision = policy.decideNextMove({
    goalText: "系统学习 AIPM，并能独立完成一个 AI 产品分析报告",
    courseMaterials: [{
      materialId: "res.good",
      title: "AI 产品分析材料",
      coveredCapabilityIds: ["ai-product.eval"],
      credibilityLevel: 3,
    }],
    capabilityLevelById: { "ai-product.eval": 2 },
    completionRate: 0.9,
    recentHardEvidenceCount: 1,
    hasRoute: true,
  });
  assert.equal(decision.primaryNeed, "practice_skill");
  assert.equal(decision.recommendedMode, "independent_practice");
  assert.ok(decision.confidence >= 0 && decision.confidence <= 1);
});
