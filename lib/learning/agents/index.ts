// V0.2 learning agents — 入口
// 提供四类接口 + 规则实现（可替换层）。
// 未来替换为内嵌自研 agent 时，替换 AgentRegistry 的组装即可。

import type { AgentRegistry, AgentContext } from "./types.ts";
import RulePlanner from "./planner.ts";
import RuleActivityComposer from "./activity-composer.ts";
import RuleEvidenceEvaluator from "./evidence-evaluator.ts";
import RuleAdjustmentAdvisor from "./adjustment-advisor.ts";

export * from "./types.ts";

export function createRuleAgents(): AgentRegistry {
  return {
    planner: new RulePlanner(),
    activityComposer: new RuleActivityComposer(),
    evidenceEvaluator: new RuleEvidenceEvaluator(),
    adjustmentAdvisor: new RuleAdjustmentAdvisor(),
  };
}

// 兼容入口：保留 AgentContext 类型导出
export type { AgentContext };
