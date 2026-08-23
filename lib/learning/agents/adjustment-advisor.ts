// adjustmentAdvisor — 规则实现
// 根据证据评估结果与计划执行情况提出调整建议。规则版，输出结构化。

import type { AdjustmentAdvisorPort, AdjustmentInput, AdjustmentSuggestion } from "./types.ts";

export class RuleAdjustmentAdvisor implements AdjustmentAdvisorPort {
  suggestAdjustment(input: AdjustmentInput): AdjustmentSuggestion {
    // 1. 证据被退回 → 调整建议（按优先级：前置缺口 > 复测失败 > 重复失败 > 普通退回）
    if (input.evidenceVerdict === "needs_revision") {
      // 缺口文案：优先用 Evidence Review 的具体信号（无结构化信号时回退旧文案）
      const gapText = buildGapText(input);
      // 1a. 前置缺口（最高优先：先补基础再回来）
      if (input.prerequisiteGaps.length > 0) {
        return {
          adjustmentType: "activity_replan",
          reason: gapText
            ? `节点「${input.nodeTitle}」证据不足且暴露前置缺口。${gapText.reason}`
            : `节点「${input.nodeTitle}」证据不足且暴露前置缺口。`,
          summary: gapText
            ? `暂停当前节点，插入前置节点活动后再回来验证。${gapText.summary}`
            : `暂停当前节点，插入前置节点活动后再回来验证。`,
          actions: [
            {
              action: "insert_activity",
              targetNodeId: input.prerequisiteGaps[0],
              description: `插入前置节点活动：${input.prerequisiteGaps[0]}`,
            },
            {
              action: "revise",
              targetNodeId: input.nodeId,
              description: `修订「${input.nodeTitle}」证据后重新提交。`,
            },
          ],
          severity: "high",
        };
      }
      // 1b. 复测失败：能力被证伪，节点已降级回成长中
      if (input.isRetestFailure === true) {
        const gap = gapPhrase(input);
        return {
          adjustmentType: "activity_replan",
          reason: gap
            ? `节点「${input.nodeTitle}」复测未通过，已降级回成长中。${gap}。`
            : `节点「${input.nodeTitle}」复测未通过，已降级回成长中。`,
          summary: gap
            ? `复测未通过，节点已回到成长中。${gap}。建议补充练习并重新提交证据。`
            : `复测未通过，节点已回到成长中；建议补充练习并重新提交证据。`,
          actions: [
            {
              action: "insert_activity",
              targetNodeId: input.nodeId,
              description: "插入补强活动：复测未通过，重新积累证据后再验证。",
            },
            {
              action: "revise",
              targetNodeId: input.nodeId,
              description: "修订证据并重新提交。",
            },
          ],
          severity: "high",
        };
      }
      // 1c. 同一节点重复失败（≥2 次）：升级为 high，标注次数与反复缺失信号
      if ((input.failureCount ?? 0) >= 2) {
        const gap = gapPhrase(input);
        const repeated = repeatedSignals(input);
        const repeatedText = repeated.length > 0
          ? `反复缺失：${repeated.slice(0, 4).join("、")}。`
          : "";
        return {
          adjustmentType: "activity_replan",
          reason: `节点「${input.nodeTitle}」第 ${input.failureCount} 次未通过。${gap ? `${gap}。` : ""}${repeatedText}`,
          summary: `同一节点多次未通过（第 ${input.failureCount} 次），建议针对性补强后再提交。${repeatedText}`,
          actions: [
            {
              action: "insert_activity",
              targetNodeId: input.nodeId,
              description: `插入补强活动：第 ${input.failureCount} 次未通过，针对性补充练习。`,
            },
            {
              action: "revise",
              targetNodeId: input.nodeId,
              description: "按评估反馈修订证据并重新提交。",
            },
          ],
          severity: "high",
        };
      }
      // 1d. 普通退回
      return {
        adjustmentType: "activity_replan",
        reason: gapText
          ? gapText.reason
          : `节点「${input.nodeTitle}」的证据未达到评估标准。`,
        summary: gapText
          ? gapText.summary
          : `保持节点成长中，修订证据或增加一次独立练习后再提交。`,
        actions: [
          {
            action: "insert_activity",
            targetNodeId: input.nodeId,
            description: gapText
              ? `插入补强活动：${gapText.summary}`
              : `插入「${input.nodeTitle}」补强活动后再提交证据。`,
          },
          {
            action: "revise",
            targetNodeId: input.nodeId,
            description: `按评估反馈修订证据并重新提交。`,
          },
        ],
        // 证据退回是重要的可追踪调整事件（medium，而非 low）
        severity: "medium",
      };
    }

    // 2. 证据通过但周计划完成率低 → 轻量调整
    if (input.completionRate < 0.5) {
      return {
        adjustmentType: "weekly_light",
        reason: `周计划完成率 ${Math.round(input.completionRate * 100)}%，低于预期。`,
        summary: `本周剩余容量不足以完成全部活动，收缩为 1-2 个核心活动，不重排整周。`,
        actions: [
          {
            action: "continue",
            targetNodeId: input.nodeId,
            description: `保留当前核心活动，其余顺延到下周。`,
          },
        ],
        severity: "medium",
      };
    }

    // 3. 有跳过节点 → 提示验证要求（周计划半稳定：不主动重排）
    if (input.skippedNodeIds.length > 0) {
      return {
        adjustmentType: "weekly_light",
        reason: `检测到 ${input.skippedNodeIds.length} 个跳过节点。`,
        summary: `跳过节点保持待验证，不重排本周；安排验证活动提交证据。`,
        actions: input.skippedNodeIds.map((nodeId) => ({
          action: "insert_activity" as const,
          targetNodeId: nodeId,
          description: `为跳过节点 ${nodeId} 生成验证活动，必须提交证据。`,
        })),
        severity: "medium",
      };
    }

    // 4. 正常推进 → 继续
    return {
      adjustmentType: "weekly_light",
      reason: `节点「${input.nodeTitle}」证据通过，计划正常推进。`,
      summary: `继续当前路线，不改变周计划。`,
      actions: [
        {
          action: "continue",
          targetNodeId: input.nodeId,
          description: `进入下一个候选节点。`,
        },
      ],
      severity: "low",
    };
  }
}

// 缺口信号短语（不含前缀文案），供复测失败/重复失败分支拼入 reason/summary。
function gapPhrase(input: AdjustmentInput): string {
  const parts: string[] = [];
  const missing = (input.missingSignals ?? []).filter(Boolean);
  const partial = (input.partialSignals ?? []).filter(Boolean);
  if (missing.length > 0) parts.push(`缺少能力信号：${missing.slice(0, 4).join("、")}`);
  if (partial.length > 0) parts.push(`部分信号需补强：${partial.slice(0, 3).join("、")}`);
  return parts.join("；");
}

// 本轮缺失信号 ∩ 上一轮缺失信号：判定"反复缺失同一能力信号"。
function repeatedSignals(input: AdjustmentInput): string[] {
  const missing = (input.missingSignals ?? []).filter(Boolean);
  const last = (input.lastMissingSignals ?? []).filter(Boolean);
  return missing.filter((label) => last.includes(label));
}

// 由 Evidence Review 缺口生成建议文案；无结构化信号时返回 null（调用方回退旧文案）。
// 优先级：missingSignals > partialSignals > reviewRationale。
function buildGapText(input: AdjustmentInput): { reason: string; summary: string } | null {
  const missing = (input.missingSignals ?? []).filter(Boolean);
  const partial = (input.partialSignals ?? []).filter(Boolean);
  const rationale = input.reviewRationale?.trim() ?? "";

  const parts: string[] = [];
  if (missing.length > 0) parts.push(`缺少能力信号：${missing.slice(0, 4).join("、")}`);
  if (partial.length > 0) parts.push(`部分信号需补强：${partial.slice(0, 3).join("、")}`);

  if (missing.length === 0 && partial.length === 0 && !rationale) return null;

  const reason =
    parts.length > 0
      ? `节点「${input.nodeTitle}」的证据未达到评估标准。${parts.join("；")}。`
      : `节点「${input.nodeTitle}」的证据未达到评估标准。${rationale}`;
  const summary =
    missing.length > 0
      ? `当前证据缺少：${missing.slice(0, 4).join("、")}。建议针对缺口补充可复核证据后重新提交。`
      : partial.length > 0
        ? `当前证据有部分信号需要补强：${partial.slice(0, 3).join("、")}。建议补强后再提交。`
        : `建议按评审反馈补充材料后重新提交。`;
  return { reason, summary };
}

export default RuleAdjustmentAdvisor;
