// V0.2 learning agents — 入口
// 提供八类接口 + 规则实现（可替换层）：
//   goalAnalyzer → courseAnalyzer → capabilityMapper → adaptiveRoutePlanner
//   → planner → activityComposer → evidenceEvaluator → adjustmentAdvisor
// 前半段（goalAnalyzer/courseAnalyzer/capabilityMapper/adaptiveRoutePlanner）已接入
// 服务层 runDiagnostic 的 transient analysis（Full Chain Phase 2），但默认链路仍走
// legacy planner：runDiagnostic/confirmProposal 外部行为不变，adaptive 仅作预览。
// 未来替换为内嵌自研 agent 时，替换 AgentRegistry 的组装即可。

import type { AgentRegistry, AgentContext } from "./types.ts";
import RulePlanner from "./planner.ts";
import RuleActivityComposer from "./activity-composer.ts";
import LLMEvidenceEvaluator from "./llm-evidence-evaluator.ts";
import RuleAdjustmentAdvisor from "./adjustment-advisor.ts";
import RuleCapabilityMapper from "./capability-mapper.ts";
import RuleGoalAnalyzer from "./goal-analyzer.ts";
import RuleCourseMaterialAnalyzer from "./course-analyzer.ts";
import { RuleAdaptiveRoutePlanner } from "./adaptive-planner.ts";
import RuleLearningDecisionPolicy from "./learning-decision-policy.ts";

export * from "./types.ts";

export function createRuleAgents(): AgentRegistry {
  return {
    goalAnalyzer: new RuleGoalAnalyzer(),
    courseAnalyzer: new RuleCourseMaterialAnalyzer(),
    capabilityMapper: new RuleCapabilityMapper(),
    planner: new RulePlanner(),
    activityComposer: new RuleActivityComposer(),
    // evidenceEvaluator：LLM 增强版（配置了 DEEPSEEK_* 环境变量时调用模型，
    // 否则回退规则版）。输出结构一致，产品主流程无感知。
    evidenceEvaluator: new LLMEvidenceEvaluator(),
    adjustmentAdvisor: new RuleAdjustmentAdvisor(),
    adaptiveRoutePlanner: new RuleAdaptiveRoutePlanner(),
    learningDecisionPolicy: new RuleLearningDecisionPolicy(),
  };
}

// 兼容入口：保留 AgentContext 类型导出
export type { AgentContext };
