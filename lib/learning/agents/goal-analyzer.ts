// goalAnalyzer — 规则实现（确定性）
// 管线最前端：把用户的一句话目标解析为 GoalAnalysis（goal / domain / topicKeywords /
// depth / targetCapabilityIds）。规则全部确定性，同输入同输出。
// 未来替换为 LLM 实现时只替换 GoalAnalyzerPort 的实现，契约不变。

import { deriveKeywordsFromText } from "./capability-mapper.ts";
import type {
  GoalAnalysis,
  GoalAnalyzerInput,
  GoalAnalyzerPort,
  GoalTargetDepth,
} from "./types.ts";

// 深度推断：目标文本中的动词/意图词 → 1 理解 / 2 应用 / 3 迁移。
// 产出/迁移类动词优先（先看 3），再看理解类；两者皆无时按偏好兜底。
const DEPTH3_MARKERS = [
  "做一个", "做出", "开发", "实现", "交付", "上线", "搭建",
  "作品", "项目", "产品", "应用", "迁移",
];
const DEPTH1_MARKERS = [
  "了解", "认识", "理解", "入门", "概览", "基础", "是什么", "知道", "熟悉",
];

function inferDepth(goal: string, preference: GoalAnalyzerInput["preference"]): GoalTargetDepth {
  if (DEPTH3_MARKERS.some((marker) => goal.includes(marker))) return 3;
  if (DEPTH1_MARKERS.some((marker) => goal.includes(marker))) return 1;
  if (preference === "build_first") return 3;
  return 2;
}

// 领域推断：取最长的主题词（同长按字典序取先）；纯 ASCII 词大写（aipm → AIPM），确定性。
function inferDomain(keywords: string[]): string | undefined {
  if (keywords.length === 0) return undefined;
  const domain = [...keywords].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  )[0];
  return /^[a-z0-9]+$/.test(domain) ? domain.toUpperCase() : domain;
}

export class RuleGoalAnalyzer implements GoalAnalyzerPort {
  analyzeGoal(input: GoalAnalyzerInput): GoalAnalysis {
    const goal = input.goal.trim();
    const topicKeywords = deriveKeywordsFromText(goal);
    return {
      goal,
      domain: inferDomain(topicKeywords),
      topicKeywords,
      depth: inferDepth(goal, input.preference),
      // 目标能力 id 由服务层在 capabilityMapper 之后回填；此处缺省覆盖整图
      targetCapabilityIds: [],
    };
  }
}

export default RuleGoalAnalyzer;
