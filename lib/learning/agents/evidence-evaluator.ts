// evidenceEvaluator — 规则实现
// 判断证据是否支持节点成长。规则版：检查内容长度、类型匹配、
// 是否覆盖节点目标关键词。未来可替换为 LLM 评估，输出结构不变。
// 能力信号数据（节点信号词表、兜底信号、能力信号目录）统一存放在
// lib/learning/domain/signals.ts，本文件只保留评分与判定逻辑。

import type {
  EvaluateEvidenceInput,
  EvidenceAssessment,
  EvidenceEvaluatorPort,
  ReviewDimensionScore,
  SignalReview,
} from "./types.ts";
import { extractEvidenceCard } from "./evidence-extractor.ts";
import { DEFAULT_SIGNALS, getReviewSignalsForNode } from "../domain/signals.ts";

const MIN_CONTENT_LENGTH = 80; // 证据本体最小长度（字符）
const MIN_COVERAGE_RATIO = 0.5; // 覆盖信号词比例

export class RuleEvidenceEvaluator implements EvidenceEvaluatorPort {
  async evaluateEvidence(input: EvaluateEvidenceInput): Promise<EvidenceAssessment> {
    const content = input.content.trim();
    const evidenceCard = extractEvidenceCard(input);
    const signals = resolveSignals(input);
    const signalReviews = buildSignalReviews(content, signals);
    const covered = signalReviews.filter((signal) => signal.status === "covered");
    const partialCount = signalReviews.filter((signal) => signal.status === "partial").length;
    const coverage = signals.length === 0 ? 1 : (covered.length + partialCount * 0.5) / signals.length;
    const signalCoverageScore = signals.length === 0
      ? 100
      : Math.round(coverage * 100);
    const dimensionScores = buildDimensionScores(input, signalCoverageScore);
    const score = weightedScore(dimensionScores);

    const reasons: string[] = [];
    const missing: string[] = [];

    if (content.length >= MIN_CONTENT_LENGTH) {
      reasons.push(`证据包含 ${content.length} 字，超过最小篇幅要求。`);
    } else {
      missing.push(`证据篇幅不足（${content.length} 字 < ${MIN_CONTENT_LENGTH} 字）。`);
    }

    if (coverage >= MIN_COVERAGE_RATIO) {
      reasons.push(`覆盖节点目标信号词 ${covered.length}/${signals.length}，达到最低覆盖要求。`);
    } else {
      missing.push(`未充分覆盖节点目标要点（${covered.length}/${signals.length}）。`);
    }

    const isSkipValidation = input.isSkipValidation;
    if (isSkipValidation) {
      // 跳学验证要求更高：必须达到 2/3 覆盖且篇幅充足
      const strictPass = content.length >= MIN_CONTENT_LENGTH * 1.5 && coverage >= 0.66;
      if (strictPass) {
        reasons.push("跳学验证证据达到严格标准（篇幅与覆盖均达标）。");
      } else {
        missing.push("跳学验证要求更高标准：需更充分解释以证明跳过常规活动的合理性。");
      }
    }

    for (const dimension of dimensionScores.filter((item) => item.score >= 70).slice(0, 3)) {
      reasons.push(`${dimension.label} ${dimension.score}/100：${dimension.rationale}`);
    }
    const missingSignals = signalReviews
      .filter((signal) => signal.status === "missing")
      .map((signal) => signal.label);
    const partialSignals = signalReviews
      .filter((signal) => signal.status === "partial")
      .map((signal) => signal.label);
    if (missingSignals.length > 0) {
      missing.push(`缺少能力信号：${missingSignals.slice(0, 4).join("、")}`);
    }
    if (partialSignals.length > 0) {
      missing.push(`部分信号需要补强：${partialSignals.slice(0, 3).join("、")}`);
    }

    const accepted = score >= (isSkipValidation ? 72 : 58) && content.length >= MIN_CONTENT_LENGTH;
    const suggestedLevel = accepted
      ? Math.min(input.targetLevel, score >= 85 ? 3 : 2)
      : Math.max(0, input.targetLevel - 1);

    return {
      evidenceId: input.evidenceId,
      verdict: accepted ? "accepted" : "needs_revision",
      confidence: Number(Math.max(0.35, Math.min(0.9, score / 100)).toFixed(2)),
      score,
      evidenceCard,
      signalReviews,
      dimensionScores,
      reasons,
      missing,
      rationale: accepted
        ? "当前材料已经形成可复核证据，能支持该能力节点的阶段性成长。"
        : "当前材料还不足以稳定证明该能力，需要补充缺失信号或更具体的可复核产出。",
      credibilityNote: input.externalUrl && content.length < MIN_CONTENT_LENGTH
        ? "MVP 阶段尚未真实解析外部链接，因此该评审是低可信度初评。"
        : input.externalUrl
          ? "材料包含外部链接和可读正文，可信度高于纯自述。"
          : "当前评审基于用户提交文本，后续可接入文件/网页解析提高可信度。",
      suggestedLevel,
      nextAction: accepted
        ? "proceed"
        : isSkipValidation
          ? "revise_and_resubmit"
          : signalCoverageScore < 35
            ? "insert_prerequisite"
            : "revise_and_resubmit",
    };
  }
}

function resolveSignals(input: EvaluateEvidenceInput): string[] {
  // capabilitySignals 由内容模型注入（content.ts 的 node.signals，与
  // signals.ts 的 NODE_SIGNALS 同源）；直接调用未注入时回退到
  // 信号数据模块的节点信号，保证两路读取的数据一致。
  const nodeSignals = input.capabilitySignals ?? getReviewSignalsForNode(input.nodeId);
  const criteriaSignals = input.criteria
    .split(/[；;，,。\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, 4);
  return Array.from(new Set([...nodeSignals, ...criteriaSignals, ...DEFAULT_SIGNALS])).slice(0, 9);
}

function buildSignalReviews(content: string, signals: string[]): SignalReview[] {
  const normalized = content.toLowerCase();
  return signals.map((label, index) => {
    const tokens = signalTokens(label);
    const hitCount = tokens.length
      ? tokens.filter((token) => normalized.includes(token)).length
      : normalized.includes(label.toLowerCase()) ? 1 : 0;
    const directHit = normalized.includes(label.toLowerCase());
    const status = directHit || hitCount >= Math.max(1, Math.ceil(tokens.length * 0.5))
      ? "covered"
      : hitCount >= Math.min(2, tokens.length)
        ? "partial"
        : "missing";
    return {
      signalId: `signal-${index + 1}`,
      label,
      status,
      reason: status === "covered"
        ? "材料中出现了清晰对应内容。"
        : status === "partial"
          ? "材料有相关表述，但还不够完整。"
          : "材料中未识别到该信号。",
      evidenceRefs: status === "missing" ? [] : [excerpt(content, tokens[0] ?? label)],
    };
  });
}

function signalTokens(label: string): string[] {
  const parts = label
    .toLowerCase()
    .split(/[\s/·、，,；;。()（）]+/)
    .filter((token) => token.length >= 2);
  const tokens = new Set<string>();

  for (const part of parts) {
    tokens.add(part);
    if (/^[\u4e00-\u9fa5]+$/.test(part) && part.length >= 4) {
      for (let i = 0; i < part.length - 1; i += 2) {
        tokens.add(part.slice(i, i + 2));
      }
    }
  }

  return Array.from(tokens).filter((token) => token.length >= 2);
}

function buildDimensionScores(input: EvaluateEvidenceInput, signalCoverage: number): ReviewDimensionScore[] {
  const content = input.content.trim();
  const hasUrl = Boolean(input.externalUrl?.trim());
  const parseability = content.length >= MIN_CONTENT_LENGTH ? 90 : hasUrl ? 45 : 35;
  const criteriaTerms = input.criteria.split(/[；;，,。\n]/).filter((part) => part.trim().length >= 3);
  const criteriaHits = criteriaTerms.filter((term) => content.includes(term.trim())).length;
  const rawCriteriaCompleteness = criteriaTerms.length === 0
    ? 65
    : Math.min(100, Math.round((criteriaHits / criteriaTerms.length) * 80 + (content.length >= MIN_CONTENT_LENGTH ? 20 : 0)));
  const criteriaCompleteness = content.length >= MIN_CONTENT_LENGTH
    ? Math.max(rawCriteriaCompleteness, 65)
    : rawCriteriaCompleteness;
  const contentQuality = content.length >= MIN_CONTENT_LENGTH
    ? Math.max(70, Math.min(100, Math.round(content.length / 1.5)))
    : Math.min(100, Math.round(content.length / 3));
  const credibility = hasUrl && content.length < MIN_CONTENT_LENGTH ? 45 : hasUrl ? 80 : 65;
  const capabilityProof = Math.min(100, Math.round(signalCoverage * 0.7 + (content.length >= MIN_CONTENT_LENGTH ? 30 : 10)));
  const nextStepClarity = /下一步|建议|改进|补充|复盘|失败|边界/.test(content) ? 85 : 55;

  return [
    dimension("parseability", "材料可解析性", parseability, "根据正文长度和外部链接可读性估计。"),
    dimension("criteriaCompleteness", "完成标准完整性", criteriaCompleteness, "根据活动评估标准在材料中的覆盖情况估计。"),
    dimension("signalCoverage", "信号覆盖度", signalCoverage, "根据节点能力信号在证据中的覆盖情况估计。"),
    dimension("contentQuality", "内容质量", contentQuality, "根据具体程度、篇幅和可复核表达估计。"),
    dimension("credibility", "证据可信度", credibility, "根据是否有链接、正文是否可读和材料类型估计。"),
    dimension("capabilityProof", "能力证明强度", capabilityProof, "根据覆盖信号和独立产出强度估计。"),
    dimension("nextStepClarity", "下一步明确性", nextStepClarity, "根据材料是否暴露缺口或提出后续行动估计。"),
  ];
}

function dimension(
  id: ReviewDimensionScore["id"],
  label: string,
  score: number,
  rationale: string,
): ReviewDimensionScore {
  return { id, label, score: Math.max(0, Math.min(100, Math.round(score))), rationale };
}

function weightedScore(dimensions: ReviewDimensionScore[]): number {
  const weights: Record<ReviewDimensionScore["id"], number> = {
    parseability: 0.15,
    criteriaCompleteness: 0.2,
    signalCoverage: 0.25,
    contentQuality: 0.15,
    credibility: 0.1,
    capabilityProof: 0.1,
    nextStepClarity: 0.05,
  };
  return Math.round(dimensions.reduce((sum, item) => sum + item.score * weights[item.id], 0));
}

function excerpt(content: string, token: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  const index = token ? clean.toLowerCase().indexOf(token.toLowerCase()) : -1;
  if (index < 0) return clean.slice(0, 80);
  return clean.slice(Math.max(0, index - 24), Math.min(clean.length, index + 56));
}

export default RuleEvidenceEvaluator;
