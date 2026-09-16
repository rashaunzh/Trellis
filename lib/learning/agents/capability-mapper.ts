// capabilityMapper — 规则实现（确定性）
// 管线前半段：goal + course/material analysis → Domain / Capability / Signal /
// Evidence Requirement 能力结构。规则（全部确定性，同输入同输出）：
//   1. 关键词匹配：goalAnalysis.topicKeywords + materials[].topicKeywords
//      （上游分析器未提供时从原文派生）对现有内容包节点打分。
//   2. 命中（score ≥ minMatchScore，默认 0.5）→ 复用 content.ts / signals.ts
//      的节点与信号（source: existing_content），并补入一级前置，保证能力图
//      可直接进入学习编排。
//   3. 未命中 → 生成 generic fallback capability map（source: inferred），
//      不崩；信号复用 DEFAULT_SIGNALS 词汇（Evidence Review 已认识）。
// 信号契约：label 必须能被 Evidence Review 消费——existing 路径直接复用
// NODE_SIGNALS 短语；fallback 路径复用 DEFAULT_SIGNALS + 领域短语；
// evidenceRequirement 一律以 label 开头并附操作性说明。

import { MODULES, learningContentPack } from "../domain/content.ts";
import { CAPABILITY_SIGNALS, DEFAULT_SIGNALS, NODE_SIGNALS } from "../domain/signals.ts";
import type { LearningContentPack, LearningNode } from "../domain/types.ts";
import type {
  Capability,
  CapabilityEdge,
  CapabilityLevel,
  CapabilityMapperInput,
  CapabilityMapperPort,
  CapabilityMap,
  CapabilitySignalSpec,
} from "./types.ts";

const DEFAULT_MIN_MATCH_SCORE = 0.5;
const GENERIC_DOMAIN = "通用学习";
// fallback 能力图版本（非内容包来源；版本号仅用于能力图版本化契约）
const FALLBACK_MAP_VERSION = "0.1.0";

// ── 关键词提取（上游分析器未提供 topicKeywords 时的兜底）──────────
const STOPWORDS = new Set([
  "学会", "学习", "掌握", "了解", "理解", "运用", "使用", "提升", "提高",
  "通过", "进行", "如何", "怎么", "什么", "能够", "希望", "想要", "成为",
  "做出", "做一个", "相关", "方面", "关于", "这个", "那个", "用于", "之后",
  "开始", "继续", "练习", "锻炼", "培养", "学习目标", "提升自己",
]);

/** 从自由文本派生候选关键词（确定性；仅用于 topicKeywords 缺失时的兜底） */
export function deriveKeywordsFromText(text: string): string[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .split(/[\s,，。;；、:：()（）"'“”/|!！?？]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (isStopword(token)) continue;
    if (/^[\d\W]+$/.test(token)) continue; // 纯数字/符号
    result.push(token);
  }
  return result;
}

/** 停用词判定：精确命中，或以停用词开头且只多出少量后缀（如"学会用"） */
function isStopword(token: string): boolean {
  if (STOPWORDS.has(token)) return true;
  for (const stop of STOPWORDS) {
    if (token.startsWith(stop) && token.length - stop.length <= 2) return true;
  }
  return false;
}

// ── 关键词集合与节点打分 ──────────────────────────────
function buildKeywordSet(input: CapabilityMapperInput): string[] {
  const keywords = new Set<string>();
  const add = (keyword: string) => {
    const normalized = keyword.trim().toLowerCase();
    if (normalized.length >= 2) keywords.add(normalized);
  };
  const goalKeywords = input.goalAnalysis.topicKeywords ?? [];
  for (const keyword of goalKeywords) add(keyword);
  if (goalKeywords.length === 0) {
    for (const keyword of deriveKeywordsFromText(input.goalAnalysis.goal)) add(keyword);
  }
  for (const material of input.materials) {
    const materialKeywords = material.topicKeywords ?? [];
    for (const keyword of materialKeywords) add(keyword);
    if (materialKeywords.length === 0) {
      for (const keyword of deriveKeywordsFromText(`${material.title} ${material.description ?? ""}`)) add(keyword);
    }
  }
  return Array.from(keywords);
}

/** 节点匹配语料：标题/英文标题/描述/成果/信号/路线标题/模块名 */
function nodeCorpus(node: LearningNode, pack: LearningContentPack): string {
  const route = pack.routes.find((r) => r.id === node.routeId);
  const moduleInfo = MODULES.find((m) => m.id === node.moduleId);
  return [
    node.title,
    node.titleEn,
    node.description,
    ...(node.outcomes ?? []),
    ...(node.signals ?? []),
    route?.title ?? "",
    moduleInfo?.name ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** 节点命中分 = 命中的关键词数 / 关键词总数（无关键词时 0） */
function scoreNode(node: LearningNode, keywords: string[], pack: LearningContentPack): number {
  if (keywords.length === 0) return 0;
  const corpus = nodeCorpus(node, pack);
  const matched = keywords.filter((keyword) => corpus.includes(keyword));
  return matched.length / keywords.length;
}

// ── 信号构造 ──────────────────────────────────────────
const SIGNAL_HINTS: Record<string, string> = {
  概念解释: "用自己的话解释核心概念、机制与术语",
  边界判断: "说明该方法/能力适用与不适用的边界，能识别失败场景",
  可复核产出: "给出可复核的成果（示例、文档、代码、作品或判定记录）",
  自我校验: "说明如何检查结果正确性、局限与后续改进",
};

function signalHint(label: string): string {
  return SIGNAL_HINTS[label] ?? "围绕该短语给出具体、可复核的内容";
}

/** existing 路径：节点信号 → CapabilitySignalSpec（目录信号带权重 1，补充信号 0.6） */
function buildSignalSpecs(node: LearningNode): CapabilitySignalSpec[] {
  const labels = node.signals.length > 0 ? node.signals : (NODE_SIGNALS[node.id] ?? []);
  return labels.map((label, index) => {
    const catalog = CAPABILITY_SIGNALS.find((signal) => signal.label === label);
    if (catalog) {
      return {
        id: catalog.id,
        label,
        description: catalog.description,
        evidenceRequirement: `${label}：${catalog.description}`,
        weight: 1,
      };
    }
    return {
      id: `sig.${node.id}.${index + 1}`,
      label,
      description: `证据需体现「${label}」（节点「${node.title}」要求的能力表现）：${signalHint(label)}，给出具体内容而非泛泛而谈。`,
      evidenceRequirement: `${label}：${signalHint(label)}，材料中需出现与该短语直接对应的具体内容。`,
      weight: 0.6,
    };
  });
}

/** fallback 路径：通用信号 → CapabilitySignalSpec（均带权重 1） */
function buildFallbackSignalSpec(capabilityId: string, label: string, index: number): CapabilitySignalSpec {
  const hint = signalHint(label);
  return {
    id: `sig.${capabilityId}.${index + 1}`,
    label,
    description: `证据需体现「${label}」：${hint}，并给出具体内容而非泛泛而谈。`,
    evidenceRequirement: `${label}：${hint}，材料中需出现与该短语直接对应的具体内容。`,
    weight: 1,
  };
}

// ── existing_content 路径 ─────────────────────────────
/** 层级映射（确定性）：无前置 → foundation；高目标关键里程碑 → advanced；其余 core */
function existingLevel(node: LearningNode, pack: LearningContentPack): CapabilityLevel {
  const prereqCount = pack.edges.filter(
    (edge) => edge.relationType === "prerequisite" && edge.targetNodeId === node.id,
  ).length;
  if (prereqCount === 0) return "foundation";
  if (node.targetLevel >= 3 && node.isKeyMilestone) return "advanced";
  return "core";
}

function buildExistingContentMap(
  input: CapabilityMapperInput,
  pack: LearningContentPack,
  matched: Array<{ node: LearningNode; score: number }>,
): CapabilityMap {
  const matchedIds = new Set(matched.map((item) => item.node.id));
  const prereqEdges = pack.edges.filter((edge) => edge.relationType === "prerequisite");
  // 一级前置闭合：为每个命中节点补入直接前置，保证能力图可学习
  const selectedIds = new Set(matchedIds);
  for (const nodeId of matchedIds) {
    for (const edge of prereqEdges) {
      if (edge.targetNodeId === nodeId) selectedIds.add(edge.sourceNodeId);
    }
  }
  // 输出顺序：命中节点按得分降序（同分按 id），补入的前置按 id
  const closureNodes = pack.nodes
    .filter((node) => !matchedIds.has(node.id) && selectedIds.has(node.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ordered = [...matched.map((item) => item.node), ...closureNodes];

  const capabilities: Capability[] = ordered.map((node) => {
    const prerequisites = prereqEdges
      .filter((edge) => edge.targetNodeId === node.id)
      .map((edge) => edge.sourceNodeId)
      .filter((id) => selectedIds.has(id));
    const specs = buildSignalSpecs(node);
    return {
      id: node.id,
      title: node.title,
      description: node.description,
      level: existingLevel(node, pack),
      source: "existing_content",
      prerequisites,
      signals: specs.map((signal) => signal.label),
      signalSpecs: specs,
      targetLevel: node.targetLevel,
      isMilestone: node.isKeyMilestone,
    };
  });

  const domain = pack.routes.find((route) => route.id === ordered[0]?.routeId)?.title ?? "AI";
  const matchedContent = matched.map((item) => ({
    nodeId: item.node.id,
    score: Number(item.score.toFixed(2)),
  }));
  const rationale =
    `命中现有内容包节点 ${matchedContent.length} 个` +
    `（${matchedContent.map((m) => `${m.nodeId} ${Math.round(m.score * 100)}%`).join("、")}），` +
    `复用 content.ts / signals.ts 的节点与信号，并补入一级前置（共 ${capabilities.length} 个能力），` +
    `信号标签与 Evidence Review 词汇同源，可直接进入证据评审。`;

  return {
    version: pack.version,
    source: "content_pack",
    domain,
    capabilities,
    edges: buildExistingEdges(pack, selectedIds),
    strategy: "existing_content",
    matchedContent,
    rationale,
  };
}

// ── existing 路径边：内容包边中两端都在能力图内的子集 ──
function buildExistingEdges(pack: LearningContentPack, selectedIds: Set<string>): CapabilityEdge[] {
  return pack.edges
    .filter((edge) => selectedIds.has(edge.sourceNodeId) && selectedIds.has(edge.targetNodeId))
    .map((edge) => ({ from: edge.sourceNodeId, to: edge.targetNodeId, relationType: edge.relationType }));
}

// ── fallback 路径边：由每个能力的前置引用生成 prerequisite 边 ──
function buildFallbackEdges(capabilities: Capability[]): CapabilityEdge[] {
  const edges: CapabilityEdge[] = [];
  for (const capability of capabilities) {
    for (const prereq of capability.prerequisites ?? []) {
      edges.push({ from: prereq, to: capability.id, relationType: "prerequisite" });
    }
  }
  return edges;
}

// ── 层级 → 建议熟练等级（fallback 路径；planner 消费 targetLevel）──
function levelToTargetLevel(level: CapabilityLevel): number {
  switch (level) {
    case "foundation":
      return 1;
    case "core":
      return 2;
    case "advanced":
      return 3;
    case "optional":
      return 2;
  }
}

// ── generic_fallback 路径 ─────────────────────────────
function buildGenericFallback(input: CapabilityMapperInput): CapabilityMap {
  const domain = input.goalAnalysis.domain?.trim()
    || input.goalAnalysis.topicKeywords?.[0]
    || GENERIC_DOMAIN;
  const domainSpecific = domain !== GENERIC_DOMAIN;
  const definitions: Array<{
    id: string;
    title: string;
    description: string;
    level: CapabilityLevel;
    prerequisites: string[];
    labels: string[];
  }> = [
    {
      id: "cap.generic.foundation",
      title: `${domain}基础概念与边界`,
      description: `建立「${domain}」的核心概念、术语与能力边界，为后续应用打底。`,
      level: "foundation",
      prerequisites: [],
      labels: ["概念解释", "边界判断"],
    },
    {
      id: "cap.generic.core",
      title: `${domain}核心应用`,
      description: `在真实任务中运用「${domain}」的核心方法，产出可复核的成果。`,
      level: "core",
      prerequisites: ["cap.generic.foundation"],
      labels: ["可复核产出", "概念解释", "自我校验"],
    },
    {
      id: "cap.generic.advanced",
      title: `${domain}综合迁移`,
      description: `把「${domain}」迁移到新场景，独立判断边界并校验结果。`,
      level: "advanced",
      prerequisites: ["cap.generic.foundation", "cap.generic.core"],
      labels: ["自我校验", "边界判断", "可复核产出"],
    },
    {
      id: "cap.generic.optional",
      title: `${domain}拓展探索`,
      description: `围绕「${domain}」的相邻话题做拓展探索，学有余力时进行。`,
      level: "optional",
      prerequisites: ["cap.generic.core"],
      labels: ["概念解释", "可复核产出"],
    },
  ];

  const capabilities: Capability[] = definitions.map((definition) => {
    // 领域明确时追加一个领域短语信号（如「英语口语实践」），保持信号具体可消费
    const labels = domainSpecific ? [...definition.labels, `${domain}实践`] : definition.labels;
    const specs = labels.map((label, index) => buildFallbackSignalSpec(definition.id, label, index));
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      level: definition.level,
      source: "inferred",
      prerequisites: definition.prerequisites,
      signals: labels,
      signalSpecs: specs,
      targetLevel: levelToTargetLevel(definition.level),
      isMilestone: definition.level === "advanced",
    };
  });

  const rationale =
    `未命中现有内容包（领域「${domain}」不在 AI/AIPM 内容包内），生成通用能力图：` +
    `信号复用 Evidence Review 已认识的 DEFAULT_SIGNALS 词汇（${DEFAULT_SIGNALS.join(" / ")}）` +
    `${domainSpecific ? `，并补充领域短语「${domain}实践」` : ""}，保证可直接进入证据评审。`;

  return {
    version: FALLBACK_MAP_VERSION,
    source: "generic",
    domain,
    capabilities,
    edges: buildFallbackEdges(capabilities),
    strategy: "generic_fallback",
    matchedContent: [],
    rationale,
  };
}

// ── 规则实现 ──────────────────────────────────────────
export class RuleCapabilityMapper implements CapabilityMapperPort {
  mapCapabilities(input: CapabilityMapperInput): CapabilityMap {
    const pack = input.contentPack ?? learningContentPack;
    const minMatchScore = input.minMatchScore ?? DEFAULT_MIN_MATCH_SCORE;
    const keywords = buildKeywordSet(input);
    const matched = pack.nodes
      .map((node) => ({ node, score: scoreNode(node, keywords, pack) }))
      .filter((item) => keywords.length > 0 && item.score >= minMatchScore)
      .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
    if (matched.length === 0) return buildGenericFallback(input);
    return buildExistingContentMap(input, pack, matched);
  }
}

export default RuleCapabilityMapper;
