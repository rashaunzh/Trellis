import { z } from "zod";
import type { DomainGraph } from "./course-intelligence.ts";

export const contentSourceTypeSchema = z.enum(["course", "article", "video", "github", "huggingface", "post", "note"]);
export const contentSourceStatusSchema = z.enum(["inbox", "processing", "needs_review", "confirmed", "rejected"]);
export const contentSourceTrustSchema = z.enum(["unknown", "low", "medium", "high"]);
export const contentFragmentStatusSchema = z.enum(["candidate", "confirmed", "rejected"]);

export const contentSourceSchema = z.object({
  id: z.string().min(1), ownerId: z.string().nullable(), type: contentSourceTypeSchema,
  title: z.string().min(1), canonicalUrl: z.string().nullable(), rawContent: z.string().nullable(),
  status: contentSourceStatusSchema, sourceTrust: contentSourceTrustSchema,
  createdAt: z.string(), updatedAt: z.string(),
});
export const contentFragmentSchema = z.object({
  id: z.string().min(1), sourceId: z.string().min(1), analysisVersion: z.number().int().positive(),
  title: z.string().min(1), summary: z.string(),
  locator: z.object({ url: z.string().nullable(), label: z.string(), timestamp: z.string().nullable() }),
  capabilityNodeIds: z.array(z.string()), prerequisiteNodeIds: z.array(z.string()),
  evidenceRequirements: z.array(z.string()), confidence: z.number().min(0).max(1),
  status: contentFragmentStatusSchema,
  sourceQuote: z.string().optional(),
});
export const sourceReviewSchema = z.object({
  summary: z.string().min(1).max(1000),
  suitability: z.string().min(1).max(1000),
  questions: z.array(z.string().max(500)).max(10),
  findings: z.array(z.object({
    kind: z.enum(["claim", "prerequisite", "scope"]),
    quote: z.string().min(4).max(500), explanation: z.string().min(1).max(1000),
  })).max(12),
  fragments: z.array(z.object({
    title: z.string().min(1).max(200), summary: z.string().min(1).max(1000),
    quote: z.string().min(4).max(500), capabilityNodeIds: z.array(z.string()).max(4),
    evidenceRequirements: z.array(z.string().max(500)).min(1).max(4),
  })).min(1).max(12),
});
export const contentAnalysisSchema = z.object({
  id: z.string().min(1), sourceId: z.string().min(1), version: z.number().int().positive(),
  mode: z.enum(["rule", "model"]), status: z.enum(["success", "needs_review", "failed"]),
  fragments: z.array(contentFragmentSchema), unresolvedQuestions: z.array(z.string()),
  confidence: z.number().min(0).max(1), rationale: z.string(), createdAt: z.string(),
  readingScope: z.enum(["metadata_only", "provided_text"]).optional(),
  limitations: z.array(z.string()).optional(),
  review: sourceReviewSchema.omit({ fragments: true }).extend({ goal: z.string().nullable() }).optional(),
  modelRequestId: z.string().optional(),
});

export type ContentSource = z.infer<typeof contentSourceSchema>;
export type ContentFragment = z.infer<typeof contentFragmentSchema>;
export type ContentAnalysis = z.infer<typeof contentAnalysisSchema>;

export function groundSourceReview(value: z.infer<typeof sourceReviewSchema>, text: string, graph: DomainGraph) {
  const issues: string[] = [];
  for (const item of [...value.findings, ...value.fragments]) {
    if (!text.includes(item.quote)) issues.push("判断引用不在实际提供文本内");
  }
  for (const fragment of value.fragments) {
    if (fragment.capabilityNodeIds.some(id => !graph.nodes.some(node => node.id === id))) issues.push("未知能力节点");
  }
  return { passed: issues.length === 0, issues };
}

export function inferSourceType(url: string, content: string): ContentSource["type"] {
  const value = url.toLowerCase();
  if (value.includes("github.com/")) return "github";
  if (value.includes("huggingface.co/")) return "huggingface";
  if (/youtube.com|youtu.be|vimeo.com/.test(value)) return "video";
  if (content.trim()) return "note";
  return "article";
}

export function analyzeContentSource(source: ContentSource, graph: DomainGraph, version = 1): ContentAnalysis {
  const sections = source.rawContent?.trim().split(/\n(?=#{1,6}\s)/).filter(Boolean).slice(0, 20) ?? [];
  if (sections.length > 1) {
    const parts = sections.map(section => analyzeContentSource({ ...source, title: section.split("\n")[0]!.replace(/^#+\s*/, ""), rawContent: section }, graph, version));
    return contentAnalysisSchema.parse({
      ...parts[0], id: `${source.id}:analysis:${version}`, sourceId: source.id,
      fragments: parts.flatMap((part, index) => part.fragments.map(fragment => ({ ...fragment, id: `${source.id}:fragment:${version}:${index + 1}`, locator: { ...fragment.locator, label: `用户提供文本 · ${fragment.title}` } }))),
      unresolvedQuestions: [...new Set(parts.flatMap(part => part.unresolvedQuestions))],
      rationale: "按用户提供文本的标题拆分，关键词映射仅作候选；未独立验证内容正确性。",
    });
  }
  const text = `${source.title} ${source.rawContent ?? ""}`.toLowerCase();
  const ranked = graph.nodes.map((node) => {
    const terms = `${node.title} ${node.description} ${node.outcomes.join(" ")}`.toLowerCase().split(/[\s、，：:()（）/\-_]+/).filter((item) => item.length > 1);
    const score = terms.filter((term) => text.includes(term)).length;
    return { node, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
  const top = source.rawContent?.trim() ? ranked.slice(0, 3) : [];
  const confidence = top.length ? Math.min(0.85, 0.35 + top[0]!.score * 0.1) : 0.2;
  const hasLocator = Boolean(source.canonicalUrl && source.rawContent);
  const fragment: ContentFragment = {
    id: `${source.id}:fragment:${version}:1`, sourceId: source.id, analysisVersion: version,
    title: source.title, summary: source.rawContent?.trim().slice(0, 240) || "来源尚未提供正文或目录，等待补充后再拆解。",
    locator: { url: source.canonicalUrl, label: hasLocator ? "用户提供来源" : "仅有来源主页，无法精确定位", timestamp: null },
    capabilityNodeIds: top.map((item) => item.node.id),
    prerequisiteNodeIds: top.flatMap((item) => item.node.prerequisiteNodeIds).filter((id, index, ids) => ids.indexOf(id) === index),
    evidenceRequirements: top[0] ? [
      `能解释“${top[0].node.title}”的关键概念。`,
      ...top[0].node.outcomes.slice(0, 1),
    ] : ["能用自己的话解释本片段，并在一个新场景中做出判断。"],
    confidence, status: "candidate",
  };
  const unresolvedQuestions = top.length ? (hasLocator ? [] : ["来源没有提供可验证的章节、页码或时间戳。"]) : ["无法从当前内容可靠映射能力节点，请补充目录、正文或人工选择节点。"];
  return contentAnalysisSchema.parse({
    id: `${source.id}:analysis:${version}`, sourceId: source.id, version, mode: "rule",
    status: "needs_review", fragments: [fragment], unresolvedQuestions,
    readingScope: source.rawContent?.trim() ? "provided_text" : "metadata_only",
    limitations: ["仅分析用户提供内容，未抓取网页、观看视频或核验全部课程。", "关键词匹配不是可信度或适配性评分；确认片段也不代表事实核验完成。", ...( /包就业|保证.*收入|稳赚|百分百|100%/.test(source.rawContent ?? "") ? ["包含保证性宣传，需核验具体承诺与证据，不能据此直接定性为骗局。"] : [])],
    confidence, rationale: top.length ? "根据标题、正文和已发布能力图做初步映射，仍需用户确认。" : "内容不足以做可靠映射，暂不进入学习路线。",
    createdAt: new Date().toISOString(),
  });
}
