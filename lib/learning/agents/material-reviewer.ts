// materialReviewer — 规则版资料质量 + 个人适配评审
// ponytail: 先用透明 rubric 覆盖常见课程判断，不接搜索/解析/LLM。

import type {
  CourseMaterialAnalysis,
  GoalAnalysis,
  MaterialReview,
  MaterialReviewerInput,
  MaterialReviewerPort,
  MaterialReviewScore,
  MaterialReviewVerdict,
} from "./types.ts";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textOf(material: CourseMaterialAnalysis): string {
  return `${material.title} ${material.description ?? ""}`.toLowerCase();
}

function includesAny(text: string, markers: string[]): boolean {
  return markers.some((marker) => text.includes(marker.toLowerCase()));
}

function hasPositiveMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => {
    const normalized = marker.toLowerCase();
    const index = text.indexOf(normalized);
    if (index < 0) return false;
    const prefix = text.slice(Math.max(0, index - 8), index);
    return !/(缺少|没有|无|不含|不足|少)/.test(prefix);
  });
}

function scoreMaterial(material: CourseMaterialAnalysis, goal: GoalAnalysis, weeksRemaining?: number): MaterialReviewScore {
  const text = textOf(material);
  const credibility = material.credibilityLevel ?? 2;
  const covered = material.coveredCapabilityIds ?? [];
  const keywords = material.topicKeywords ?? [];
  const sourceCredibility = clampScore(35 + credibility * 18);
  const structureClarity = clampScore(35 + (hasPositiveMarker(text, ["目录", "outline", "module", "lesson", "阶段", "路径"]) ? 35 : 0) + Math.min(20, keywords.length * 3));
  const practiceDensity = clampScore(25 + (hasPositiveMarker(text, ["练习", "practice", "作业", "任务", "lab", "notebook", "demo"]) ? 45 : 0));
  const assessmentClarity = clampScore(25 + (hasPositiveMarker(text, ["评估", "assessment", "rubric", "测验", "quiz", "标准", "答案"]) ? 45 : 0));
  const projectRelevance = clampScore(25 + (hasPositiveMarker(text, ["项目", "作品", "portfolio", "案例", "case", "产出", "报告"]) ? 45 : 0));
  const freshness = clampScore(55 + (includesAny(text, ["2025", "2026", "最新", "updated", "current"]) ? 25 : 0));
  const marketingRisk = clampScore(
    (includesAny(text, ["7天", "速成", "保 offer", "保offer", "轻松", "躺赚", "零基础月入", "快速转型"]) ? 70 : 20)
      + (credibility <= 1 ? 15 : 0),
  );
  const beginnerFit = clampScore(60 + (includesAny(text, ["入门", "beginner", "基础", "从零", "小白"]) ? 30 : 0) - (includesAny(text, ["高级", "advanced", "源码", "论文"]) ? 45 : 0));
  const goalKeywords = goal.topicKeywords ?? [];
  const goalHits = goalKeywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
  const goalFit = clampScore(35 + Math.min(35, goalHits * 12) + Math.min(25, covered.length * 8));
  const timeFit = clampScore(weeksRemaining !== undefined && weeksRemaining <= 2
    ? 45 + (projectRelevance >= 60 ? 25 : 0) + (practiceDensity >= 60 ? 15 : 0)
    : 65 + (structureClarity >= 60 ? 10 : 0));
  return {
    sourceCredibility,
    structureClarity,
    practiceDensity,
    assessmentClarity,
    projectRelevance,
    freshness,
    marketingRisk,
    beginnerFit,
    goalFit,
    timeFit,
  };
}

function average(values: number[]): number {
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function verdictFrom(scores: MaterialReviewScore): MaterialReviewVerdict {
  const quality = average([
    scores.sourceCredibility,
    scores.structureClarity,
    scores.practiceDensity,
    scores.assessmentClarity,
    scores.projectRelevance,
    scores.freshness,
  ]);
  const fit = average([scores.beginnerFit, scores.goalFit, scores.timeFit]);
  if (scores.marketingRisk >= 75 || scores.sourceCredibility < 45) return "not_recommended";
  if (quality >= 68 && fit >= 65 && scores.practiceDensity >= 55 && scores.assessmentClarity >= 55) return "core";
  if (quality >= 62 && (scores.practiceDensity < 50 || scores.assessmentClarity < 50 || scores.projectRelevance < 50)) return "reference";
  return fit >= 50 || quality >= 50 ? "supplement" : "not_recommended";
}

function reviewText(review: MaterialReview): string {
  const verdictText: Record<MaterialReviewVerdict, string> = {
    core: "可作为当前学习主线",
    reference: "适合作参考，但不宜单独作为主线",
    supplement: "可用但需要补充材料或练习",
    not_recommended: "当前阶段不建议使用",
  };
  return `${verdictText[review.verdict]}：质量 ${review.qualityScore}/100，个人适配 ${review.personalFitScore}/100。`;
}

export class RuleMaterialReviewer implements MaterialReviewerPort {
  reviewMaterials(input: MaterialReviewerInput): MaterialReview[] {
    return input.materials.map((material) => {
      const scores = scoreMaterial(material, input.goalAnalysis, input.weeksRemaining);
      const qualityScore = average([
        scores.sourceCredibility,
        scores.structureClarity,
        scores.practiceDensity,
        scores.assessmentClarity,
        scores.projectRelevance,
        scores.freshness,
      ]);
      const personalFitScore = average([scores.beginnerFit, scores.goalFit, scores.timeFit]);
      const verdict = verdictFrom(scores);
      const strengths: string[] = [];
      const risks: string[] = [];
      const missingAreas: string[] = [];
      if (scores.sourceCredibility >= 70) strengths.push("来源可信度较高");
      if (scores.structureClarity >= 65) strengths.push("结构较清晰");
      if (scores.goalFit >= 65) strengths.push("与当前目标相关");
      if (scores.practiceDensity < 50) missingAreas.push("缺少练习或可执行任务");
      if (scores.assessmentClarity < 50) missingAreas.push("缺少评估标准");
      if (scores.projectRelevance < 50) missingAreas.push("缺少阶段产出或项目连接");
      if (scores.marketingRisk >= 65) risks.push("存在过度承诺或营销风险");
      if (scores.beginnerFit < 50 && input.situation?.learnerLevel === "beginner") risks.push("对当前小白阶段偏难");
      const review: MaterialReview = {
        materialId: material.materialId,
        title: material.title,
        verdict,
        qualityScore,
        personalFitScore,
        scores,
        strengths,
        risks,
        missingAreas,
        rationale: "",
      };
      return { ...review, rationale: reviewText(review) };
    });
  }
}

export default RuleMaterialReviewer;
