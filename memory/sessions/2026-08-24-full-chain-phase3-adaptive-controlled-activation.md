# 2026-08-24 — Full Chain Phase 3：Adaptive Planner Controlled Activation

## 目标

审计并最小实现"受控 adaptive planner 接入"：新增 plannerMode（legacy 默认 /
adaptive_preview / adaptive_existing_content），仅允许 existing_content 命中的
能力图在 confirmProposal 中驱动周计划；generic fallback 永不进入正式闭环；
默认流程行为与 Phase 2 完全一致。

## 审计结论（10 问要点）

1. adaptivePlan 字段：route / orderedCapabilities / weeklyPlan / activities /
   rationale / mode；weeklyPlan.activities（AdaptiveWeekItem）与 activities
   （AdaptiveActivityDraft）一一对应。
2-4. 足以生成 LearningActivity：AdaptiveActivityDraft 已含全部内容字段
   （nodeId=capabilityId、activityType、estimatedMinutes、isCore（来自 week item）、
   expectedEvidence、evaluationCriteria、completionCriteria==evaluationCriteria、
   goal/steps/inputRefs/nextAdvice）；运行字段（ownerId/weeklyPlanId/status/
   isSkipValidation/sequence/id）由服务层经新 adapter（adapters.ts）补齐，不改
   adaptive-planner / activityComposer。
5. 不破坏 p0：p0 全部默认 legacy（不传 plannerMode）；retestNode/confirmMastery
   走独立路径；adaptive depth=2 链不含 quiz/reflection/integrated_task 只影响
   显式 opt-in 用户。
6. selfReport 高：adaptive 标记 satisfied → 保留路线但本周不排（后置）；
   ≥1 未达标 → 跳过 build_model/follow_demo 直接独立练习；与 legacy 的
   growing-仍排最前 语义不同。
7. weeklyMinutes 确实限制：targetCoreCount = min(8, max(2, floor(cap/60)))，
   committed ≤ capacity，可选不计承诺（测试 60 vs 300 验证）。
8. generic 不能进闭环：capability id 不在内容包 → reviewEvidence 404、
   D1 FK（activities/node_progress.node_id → learning_nodes）违约、
   nodeProgress 只初始化 legacy 节点。
9. existing_content 下 capability id = content pack nodeId 1:1（mapper 直接用
   node.id），证据评审/FK/nodeProgress 全兼容。
10. 状态机零改动：活动仍从 planned 开始走原生命周期；受影响仅活动生成来源
    （createAdaptiveActivities）+ rationale + 活动构成；nodeProgress/证据评审/
    补强/复测/跳学路径不受影响。

## 实现决策

- plannerMode 持久化：复用 V0.1 遗留表 learning_diagnostics（无 schema 变更），
  新增 LearningStore.getDiagnostic/saveDiagnostic（store/in-memory/d1 三处 +
  resetLearner 清理），快照存 goal/weeklyMinutes/selfReport/materials/
  {plannerMode, preference}；confirmProposal 据此按诊断时模式/输入重建计划
  （同时解决 Phase 2 的 preference/materials 漂移）。
- confirmProposal 受控路径：快照 plannerMode=adaptive_existing_content 且重建
  capabilityMap.strategy=existing_content 且 adaptivePlan 非空 → createAdaptiveActivities
  （adapters.ts 的 adaptiveDraftToActivity）；否则回退 legacy（rationale 标记"已回退
  legacy 编排"，不崩）。legacy 计划逻辑抽为 confirmLegacyWeeklyPlan（行为不变）。
- 三种模式：legacy（默认，行为与 Phase 2 逐字节一致）/ adaptive_preview（analysis
  预览，confirm 仍 legacy）/ adaptive_existing_content（existing 命中才驱动）。

## 验证

- `npx tsc --noEmit --incremental false` → 0 错误。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` → 159/159
  （基线 151 + 新增 8：full-chain-integration.test.ts Phase 3 用例）。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` → 0 problems。
- 探针：adaptive_existing_content+"学 AI" → confirm 5 活动（3 核心+2 可选，首个
  ai-app-dev.tools，criteria 信号参数化，rationale 含"内容包投影"）；
  generic+"练习英语口语" → 回退 legacy 且标记；默认 legacy 360 → 6 核心含
  integrated_task（不变）。

## 变更文件

- 修改：`lib/learning/application/learning-service.ts`（plannerMode 参数+快照持久化+
  confirmProposal 受控路径+confirmLegacyWeeklyPlan+createAdaptiveActivities）、
  `lib/learning/agents/types.ts`（PlannerMode + LearningAnalysis.plannerMode 类型）、
  `lib/learning/persistence/store.ts`（DiagnosticSnapshot+get/saveDiagnostic）、
  `lib/learning/persistence/in-memory.ts`、`lib/learning/persistence/d1.ts`、
  `tests/learning-domain/full-chain-integration.test.ts`（+8 用例）。
- 新增：`lib/learning/agents/adapters.ts`（adaptiveDraftToActivity）。

## 未做 / 边界

- 未切换默认 planner（adaptive 仅 opt-in）；未改 schema/migration/UI；
  未改 Evidence Review / Adjustment 算法；未删 legacy planner。
- generic 能力仍未进入正式闭环；replanCurrentWeek 仍恒 legacy。
- D1 的 learning_diagnostics SQL 按迁移 0002 列结构编写，本环境未对真实 D1 执行
  （测试用 in-memory）；部署前需在含 0002 的库上验证。
