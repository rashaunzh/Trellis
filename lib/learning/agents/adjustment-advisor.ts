// adjustmentAdvisor — 规则实现
// 根据证据评估结果与计划执行情况提出调整建议。规则版，输出结构化。

import type { AdjustmentAdvisorPort, AdjustmentInput, AdjustmentSuggestion } from "./types.ts";

export class RuleAdjustmentAdvisor implements AdjustmentAdvisorPort {
  suggestAdjustment(input: AdjustmentInput): AdjustmentSuggestion {
    // 1. 证据被退回 → 轻量调整：补复习/修订活动
    if (input.evidenceVerdict === "needs_revision") {
      if (input.prerequisiteGaps.length > 0) {
        return {
          adjustmentType: "activity_replan",
          reason: `节点「${input.nodeTitle}」证据不足且暴露前置缺口。`,
          summary: `暂停当前节点，插入前置节点活动后再回来验证。`,
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
      return {
        adjustmentType: "activity_replan",
        reason: `节点「${input.nodeTitle}」的证据未达到评估标准。`,
        summary: `保持节点成长中，修订证据或增加一次独立练习后再提交。`,
        actions: [
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

export default RuleAdjustmentAdvisor;
