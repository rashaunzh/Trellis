# 2026-08-24 — Full Chain Phase 1：类型统一与 agent 注册

## 目标

实现完整学习链路 Phase 1：统一 `agents/types.ts` 与 `adaptive-types.ts` 中重复冲突的
GoalAnalysis / CourseMaterialAnalysis / CapabilityMap 类型；新增 GoalAnalyzerPort /
CourseMaterialAnalyzerPort 与规则实现；注册 goalAnalyzer / courseAnalyzer /
adaptiveRoutePlanner。默认链路保持 legacy planner，不改变
runDiagnostic / confirmProposal 外部行为。

## 决策

- 统一契约落在 `lib/learning/agents/types.ts`：`GoalAnalysis`（depth 由
  `CapabilityLevel` 改为 `GoalTargetDepth = 1|2|3`）、`CourseMaterialAnalysis`
  （sourceUrl → url）、`Capability`（`signals` 统一为短语 `string[]`，完整规格移至
  `signalSpecs?: CapabilitySignalSpec[]`；新增 targetLevel / isMilestone / activityTemplates /
  sourceRefs）、`CapabilityMap`（新增 version / source / edges；strategy / matchedContent /
  rationale / domain 保持）。`adaptive-types.ts` 改为 re-export，不再维护第二套同名类型。
- `signals` 选短语视图的原因：Evidence Review 的 `capabilitySignals` 与 adaptive planner
  消费的都是 label；规格对象是 mapper 的富产物，作为 `signalSpecs` 保留（Evidence
  Requirement 契约不丢）。
- capability-mapper 输出补齐 targetLevel / isMilestone / signals（短语）/ signalSpecs /
  version / source / edges（existing 路径取内容包边子集，fallback 由 prerequisites 生成）。
- adaptive-planner 对可选字段兜底：targetCapabilityIds / depth / coveredCapabilityIds。
- courseAnalyzer 的 coveredCapabilityIds = resourceMappings 映射节点（权威）∪ 关键词命中
  （≥2 词，兜底）；未命中资源用 materialId 派生关键词，不崩。
- goalAnalyzer 深度规则：产出/应用动词 → 3；了解/入门 → 1；build_first → 3；默认 2。

## 验证

- `npx tsc --noEmit --incremental false` → 0 错误。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` → 142/142
  （基线 129 + 新增 13：goal-analyzer 6、course-analyzer 4、agents.test.ts registry/契约 3）。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` → 0 problems。
- 注：`npm run test:domain` 默认隔离模式在此沙箱环境因子进程 spawn EPERM 不可用，
  非代码问题；以 `--test-isolation=none` 为准（与仓库设计文档同口径）。
- createRuleAgents() 八端口齐全；goalAnalyzer("系统学习 AIPM") →
  { domain: "AIPM", topicKeywords: ["aipm"], depth: 2 }；
  courseAnalyzer(res.gml-crash-course) → coveredCapabilityIds: ["ai-literacy.mechanism"]。

## 变更文件

- 修改：`lib/learning/agents/types.ts`（统一契约 + 新 port + 注册表）、
  `lib/learning/agents/adaptive-types.ts`（re-export 统一契约）、
  `lib/learning/agents/capability-mapper.ts`（输出形状适配）、
  `lib/learning/agents/adaptive-planner.ts`（可选字段兜底）、
  `lib/learning/agents/index.ts`（注册三个新 agent）、
  `tests/learning-domain/agents.test.ts`（契约断言更新 + registry 测试）、
  `tests/learning-domain/capability-mapper.test.ts`（契约断言适配新 Capability 形状）。
- 新增：`lib/learning/agents/goal-analyzer.ts`、`lib/learning/agents/course-analyzer.ts`、
  `tests/learning-domain/goal-analyzer.test.ts`、`tests/learning-domain/course-analyzer.test.ts`。

## 未做（Phase 2 及以后）

- 服务层接线：runDiagnostic 流水线、plannerMode 门控、workspace.analysis 瞬态字段。
- adaptive planner 默认化（明确不做，保持 legacy）。
- schema / 迁移 / UI / Evidence Review / Adjustment 算法零改动。
