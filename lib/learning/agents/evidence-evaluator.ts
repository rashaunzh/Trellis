// evidenceEvaluator — 规则实现
// 判断证据是否支持节点成长。规则版：检查内容长度、类型匹配、
// 是否覆盖节点目标关键词。未来可替换为 LLM 评估，输出结构不变。

import type {
  EvaluateEvidenceInput,
  EvidenceAssessment,
  EvidenceEvaluatorPort,
} from "./types.ts";

// 各节点目标中的关键信号词（规则版评估依据）
const NODE_SIGNAL_WORDS: Record<string, string[]> = {
  "ai-literacy.mechanism": ["训练", "概率", "幻觉", "泛化", "推理"],
  "ai-literacy.fit": ["问题", "成功", "失败", "人工", "边界", "非 ai"],
  "ai-literacy.context": ["资料", "引用", "格式", "边界", "无答案", "拒答"],
  "ai-literacy.architecture": ["rag", "检索", "工具", "agent", "直接生成", "架构"],
  "ai-literacy.evaluation": ["测试", "指标", "样例", "失败", "升级", "红线"],
  "ai-literacy.responsibility": ["隐私", "权限", "偏见", "版权", "风险", "回滚"],
  "ai-app-dev.prompting": ["任务", "指令", "格式", "输出", "提示"],
  "ai-app-dev.rag": ["检索", "切分", "引用", "文档", "无答案"],
  "ai-app-dev.tools": ["工具", "调用", "函数", "权限", "动作"],
  "ai-app-dev.eval-harness": ["测试集", "样例", "指标", "比较", "失败"],
  "ai-product.problem-def": ["用户", "问题", "价值", "成功标准"],
  "ai-product.capability-design": ["能力", "边界", "需求", "评测", "兜底"],
  "ai-product.eval-decision": ["评测", "决策", "上线", "回滚", "指标"],
};

const MIN_CONTENT_LENGTH = 80; // 证据本体最小长度（字符）
const MIN_COVERAGE_RATIO = 0.5; // 覆盖信号词比例

export class RuleEvidenceEvaluator implements EvidenceEvaluatorPort {
  async evaluateEvidence(input: EvaluateEvidenceInput): Promise<EvidenceAssessment> {
    const content = input.content.trim();
    const signals = NODE_SIGNAL_WORDS[input.nodeId] ?? [];
    const covered = signals.filter((word) => content.toLowerCase().includes(word.toLowerCase()));
    const coverage = signals.length === 0 ? 1 : covered.length / signals.length;

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

    const accepted = missing.length === 0;
    const suggestedLevel = accepted
      ? Math.min(input.targetLevel, coverage >= 0.8 ? 3 : 2)
      : Math.max(0, input.targetLevel - 1);

    return {
      evidenceId: input.evidenceId,
      verdict: accepted ? "accepted" : "needs_revision",
      confidence: accepted ? 0.7 : 0.5,
      reasons,
      missing,
      suggestedLevel,
      nextAction: accepted
        ? "proceed"
        : isSkipValidation
          ? "revise_and_resubmit"
          : coverage < 0.3
            ? "insert_prerequisite"
            : "revise_and_resubmit",
    };
  }
}

export default RuleEvidenceEvaluator;
