// Material Reviewer（规则版）测试：资料质量 + 个人适配
import test from "node:test";
import assert from "node:assert/strict";

import { createRuleAgents } from "../../lib/learning/agents/index.ts";

const reviewer = createRuleAgents().materialReviewer;

test("权威/结构清晰/有练习/有项目的资料 → core", () => {
  const [review] = reviewer.reviewMaterials({
    goalAnalysis: { goal: "系统学习 AIPM，并产出一个 AI 产品评测项目", topicKeywords: ["aipm", "ai"] },
    weeksRemaining: 4,
    materials: [{
      materialId: "res.core",
      title: "2026 AI PM project practice lesson outline",
      description: "官方 updated lesson，包含目录、阶段、practice lab、quiz assessment、项目案例、portfolio 报告。",
      topicKeywords: ["ai", "aipm", "project"],
      coveredCapabilityIds: ["ai-product.eval", "ai-app-dev.rag"],
      credibilityLevel: 3,
    }],
  });
  assert.equal(review.verdict, "core");
  assert.ok(review.qualityScore >= 68);
  assert.ok(review.personalFitScore >= 65);
  assert.ok(review.strengths.includes("来源可信度较高"));
});

test("影响力大但练习少的资料 → reference", () => {
  const [review] = reviewer.reviewMaterials({
    goalAnalysis: { goal: "系统学习 AIPM，并完成作品集项目", topicKeywords: ["aipm"] },
    materials: [{
      materialId: "res.reference",
      title: "2026 AIPM overview module lesson",
      description: "高可信公开课，结构清晰，包含目录和阶段概览，但主要是概念讲解，没有练习、作业、评估标准或项目产出。",
      topicKeywords: ["aipm", "overview"],
      coveredCapabilityIds: ["ai-literacy.mechanism"],
      credibilityLevel: 3,
    }],
  });
  assert.equal(review.verdict, "reference");
  assert.ok(review.missingAreas.includes("缺少练习或可执行任务"));
});

test("课程适合入门但不适合 14 天作品集目标 → supplement", () => {
  const [review] = reviewer.reviewMaterials({
    goalAnalysis: { goal: "系统学习 AIPM，并在 14 天内产出作品集项目", topicKeywords: ["aipm"] },
    weeksRemaining: 2,
    materials: [{
      materialId: "res.supplement",
      title: "AIPM beginner basics lesson",
      description: "入门基础材料，适合小白理解概念，有目录和阶段说明，但缺少项目、portfolio、评估标准和实战练习。",
      topicKeywords: ["aipm", "beginner"],
      coveredCapabilityIds: ["ai-literacy.mechanism"],
      credibilityLevel: 2,
    }],
  });
  assert.equal(review.verdict, "supplement");
  assert.ok(review.scores.projectRelevance < 50);
  assert.ok(review.missingAreas.includes("缺少阶段产出或项目连接"));
});

test("过度承诺、低可信、无评估标准的资料 → not_recommended", () => {
  const [review] = reviewer.reviewMaterials({
    goalAnalysis: { goal: "系统学习 AIPM", topicKeywords: ["aipm"] },
    materials: [{
      materialId: "res.bad",
      title: "7天速成 AI 产品经理 保 offer 训练营",
      description: "轻松快速转型，零基础月入提升，无目录、无作业、无评估标准。",
      topicKeywords: ["aipm"],
      coveredCapabilityIds: [],
      credibilityLevel: 1,
    }],
  });
  assert.equal(review.verdict, "not_recommended");
  assert.ok(review.risks.includes("存在过度承诺或营销风险"));
});

test("小白用户遇到高难资料 → beginnerFit 降低", () => {
  const [review] = reviewer.reviewMaterials({
    goalAnalysis: { goal: "了解 AI 基础", depth: 1, topicKeywords: ["ai"] },
    situation: { learnerLevel: "beginner", timePressure: "medium", currentStage: "foundation" },
    materials: [{
      materialId: "res.advanced",
      title: "AI advanced paper source code seminar",
      description: "高级论文和源码研讨，包含少量 project case，但对小白不友好。",
      topicKeywords: ["ai", "advanced"],
      coveredCapabilityIds: ["ai-literacy.mechanism"],
      credibilityLevel: 3,
    }],
  });
  assert.ok(review.scores.beginnerFit < 50);
  assert.ok(review.risks.includes("对当前小白阶段偏难"));
});
