// evidenceEvaluator — LLM 增强版
// 调用 LLM（用户自配的 API，service 注入）评估证据；未配置或调用失败时回退规则版。
// 输出结构与规则版完全一致（EvidenceAssessment），产品主流程无感知。

import type {
  EvaluateEvidenceInput,
  EvidenceAssessment,
  EvidenceEvaluatorPort,
} from "./types.ts";
import { RuleEvidenceEvaluator } from "./evidence-evaluator.ts";
import { chatCompletion, parseJSON } from "./llm-client.ts";

const SYSTEM_PROMPT = `你是 Trellis 学习系统的证据评估器。判断学习者提交的证据是否足以支持"节点成长"。
只输出 JSON（不要 markdown 代码块），结构：
{"verdict":"accepted|needs_revision","reasons":["..."],"missing":["..."],"suggestedLevel":0-3,"confidence":0-1,"nextAction":"proceed|revise_and_resubmit|insert_prerequisite"}
规则：证据要体现对节点的理解与边界意识，而不只是复述材料；跳学验证要求更高标准。`;

export class LLMEvidenceEvaluator implements EvidenceEvaluatorPort {
  private fallback = new RuleEvidenceEvaluator();

  async evaluateEvidence(
    input: EvaluateEvidenceInput,
    llm?: { baseUrl: string; apiKey: string; model: string },
  ): Promise<EvidenceAssessment> {
    if (!llm || !llm.baseUrl || !llm.apiKey) {
      return this.fallback.evaluateEvidence(input);
    }

    try {
      const nodeTitle = input.nodeTitle ?? input.nodeId;
      const userPrompt = `节点：${nodeTitle}
目标等级：${input.targetLevel}
是否跳学验证：${input.isSkipValidation ? "是（要求更高标准）" : "否"}
证据类型：${input.evidenceType ?? "未知"}
证据内容：
"""${input.content}"""

请评估这条证据是否支持该节点成长。`;
      const text = await chatCompletion(llm, [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);
      const parsed = parseJSON<Partial<EvidenceAssessment>>(text);
      if (parsed.verdict !== "accepted" && parsed.verdict !== "needs_revision") {
        throw new Error("LLM verdict 非法");
      }
      const base = await this.fallback.evaluateEvidence(input);
      return {
        ...base,
        evidenceId: input.evidenceId,
        verdict: parsed.verdict,
        confidence: parsed.confidence ?? 0.6,
        score: parsed.score ?? base.score,
        evidenceCard: parsed.evidenceCard ?? base.evidenceCard,
        signalReviews: parsed.signalReviews ?? base.signalReviews,
        dimensionScores: parsed.dimensionScores ?? base.dimensionScores,
        reasons: parsed.reasons ?? base.reasons,
        missing: parsed.missing ?? base.missing,
        rationale: parsed.rationale ?? base.rationale,
        credibilityNote: parsed.credibilityNote ?? base.credibilityNote,
        suggestedLevel: Math.min(input.targetLevel, parsed.suggestedLevel ?? base.suggestedLevel),
        nextAction: parsed.nextAction ?? "revise_and_resubmit",
      };
    } catch {
      // API 故障/超时/解析失败 → 回退规则版，保证闭环可用
      return this.fallback.evaluateEvidence(input);
    }
  }
}

export default LLMEvidenceEvaluator;
