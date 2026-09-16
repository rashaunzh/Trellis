// courseAnalyzer — 规则实现（确定性）
// 管线第二段：把用户已有材料 id 解析为 CourseMaterialAnalysis[]。
// 规则版：命中内容包资源（learningContentPack.resources）时复用其 title/summary，
// 派生主题关键词；coveredCapabilityIds = 资源映射节点（resourceMappings，权威）
// ∪ 关键词命中（兜底，供未映射/未知材料使用）。未命中资源时用 materialId
// 本身派生关键词兜底，保证不崩。
// 未来替换为 LLM 实现（解析课程结构/偏科检查）时只替换
// CourseMaterialAnalyzerPort 的实现，契约不变。

import { deriveKeywordsFromText } from "./capability-mapper.ts";
import { learningContentPack } from "../domain/content.ts";
import type { LearningContentPack, LearningNode } from "../domain/types.ts";
import type {
  CourseMaterialAnalysis,
  CourseMaterialAnalyzerInput,
  CourseMaterialAnalyzerPort,
} from "./types.ts";

// 覆盖判定：关键词对节点语料做子串命中，命中 ≥ 2 个关键词视为材料覆盖该能力。
// 不用命中率阈值：材料标题/摘要派生关键词较多时比率会稀释（如机制类材料命中
// 训练/推理/泛化/机制/解释 5 词但比率不足 0.5）。绝对值规则对"覆盖与否"更稳。
const MIN_KEYWORD_HITS = 2;

/** 节点匹配语料（与 capabilityMapper 同源：标题/英文标题/描述/成果/信号/路线/模块） */
function nodeCorpus(node: LearningNode, pack: LearningContentPack): string {
  const route = pack.routes.find((r) => r.id === node.routeId);
  return [
    node.title,
    node.titleEn,
    node.description,
    ...(node.outcomes ?? []),
    ...(node.signals ?? []),
    route?.title ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** 覆盖能力推断：关键词对节点语料做子串命中，命中 ≥ MIN_KEYWORD_HITS 的能力进入 coveredCapabilityIds（确定性） */
function matchCapabilityIds(keywords: string[], pack: LearningContentPack): string[] {
  if (keywords.length === 0) return [];
  return pack.nodes
    .map((node) => ({
      id: node.id,
      hits: keywords.filter((keyword) => nodeCorpus(node, pack).includes(keyword)).length,
    }))
    .filter((item) => item.hits >= MIN_KEYWORD_HITS)
    .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id))
    .map((item) => item.id);
}

export class RuleCourseMaterialAnalyzer implements CourseMaterialAnalyzerPort {
  analyzeMaterials(input: CourseMaterialAnalyzerInput): CourseMaterialAnalysis[] {
    const pack = input.contentPack ?? learningContentPack;
    return input.materialIds.map((materialId) => {
      const resource = pack.resources.find((r) => r.id === materialId);
      if (resource) {
        const topicKeywords = deriveKeywordsFromText(`${resource.title} ${resource.summary}`);
        return {
          materialId,
          title: resource.title,
          description: resource.summary,
          topicKeywords,
          // 覆盖 = 资源映射节点（resourceMappings，权威）∪ 关键词命中（兜底）
          coveredCapabilityIds: [
            ...new Set([
              ...pack.resourceMappings.filter((m) => m.resourceId === materialId).map((m) => m.nodeId),
              ...matchCapabilityIds(topicKeywords, pack),
            ]),
          ],
          sourceType: resource.sourceType,
          credibilityLevel: resource.credibilityLevel,
          url: resource.url,
        };
      }
      // 未命中：用 materialId 派生关键词兜底（可能为空），不崩
      const topicKeywords = deriveKeywordsFromText(materialId);
      return {
        materialId,
        title: materialId,
        topicKeywords,
        coveredCapabilityIds: matchCapabilityIds(topicKeywords, pack),
      };
    });
  }
}

export default RuleCourseMaterialAnalyzer;
