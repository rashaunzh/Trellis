import type {
  EvaluateEvidenceInput,
  EvidenceArtifactType,
  EvidenceCard,
  EvidenceReadability,
} from "./types.ts";

const URL_EXTENSIONS: Array<[RegExp, EvidenceArtifactType]> = [
  [/\.(pdf)(?:$|[?#])/i, "doc"],
  [/\.(docx?|md|txt)(?:$|[?#])/i, "doc"],
  [/\.(csv|xlsx?|gsheet)(?:$|[?#])/i, "table"],
  [/\.(tsx?|jsx?|py|ipynb|json)(?:$|[?#])/i, "code"],
];

export function extractEvidenceCard(input: EvaluateEvidenceInput): EvidenceCard {
  const content = input.content.trim();
  const artifactUrl = input.externalUrl?.trim() ?? "";
  const artifactType = inferArtifactType(input.evidenceType, artifactUrl, content);
  const sourceReadability = inferReadability(content, artifactUrl);

  return {
    title: `${input.nodeTitle} 的学习证据`,
    artifactUrl,
    artifactType,
    summary: summarizeEvidence(content, artifactType, sourceReadability),
    extractedItems: extractItems(content, input.criteria),
    sourceReadability,
  };
}

function inferArtifactType(
  evidenceType: EvaluateEvidenceInput["evidenceType"],
  artifactUrl: string,
  content: string,
): EvidenceArtifactType {
  if (evidenceType === "code") return "code";
  if (evidenceType === "external" && artifactUrl) {
    for (const [pattern, type] of URL_EXTENSIONS) {
      if (pattern.test(artifactUrl)) return type;
    }
    return "webpage";
  }
  if (/```|function |const |import |SELECT |class /i.test(content)) return "code";
  if (/\|.+\||标准答案|测试问题|失败类型|引用/.test(content)) return "table";
  return content ? "text" : "unknown";
}

function inferReadability(content: string, artifactUrl: string): EvidenceReadability {
  if (content.length >= 120) return "readable";
  if (content.length >= 30) return "partial";
  return artifactUrl ? "unknown" : "partial";
}

function summarizeEvidence(
  content: string,
  artifactType: EvidenceArtifactType,
  readability: EvidenceReadability,
): string {
  if (readability === "unknown") {
    return `用户提交了一个${artifactTypeLabel(artifactType)}链接，但 MVP 尚未真实解析外部材料。`;
  }
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= 120) return clean || "用户提交了一份待评审材料。";
  return `${clean.slice(0, 116)}...`;
}

function extractItems(content: string, criteria: string): string[] {
  const items = new Set<string>();
  const checks: Array<[RegExp, string]> = [
    [/概念|机制|原理|为什么|解释/, "包含概念或机制解释"],
    [/边界|适用|不适用|失败|风险/, "包含边界或失败条件判断"],
    [/关系图|结构|前置|相邻|依赖/, "包含关系或结构分析"],
    [/测试|问题|样例|标准答案|指标|引用/, "包含测试或评估设计"],
    [/结论|建议|改进|取舍|决策/, "包含结论或产品判断"],
    [/代码|prompt|demo|实现|运行/, "包含可复核产出"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(content) || pattern.test(criteria)) items.add(label);
  }
  if (items.size === 0 && content.trim()) items.add("包含一段用户提交的学习材料");
  return Array.from(items);
}

function artifactTypeLabel(type: EvidenceArtifactType): string {
  const labels: Record<EvidenceArtifactType, string> = {
    text: "文本",
    webpage: "网页",
    doc: "文档",
    code: "代码",
    table: "表格",
    unknown: "未知类型",
  };
  return labels[type];
}
