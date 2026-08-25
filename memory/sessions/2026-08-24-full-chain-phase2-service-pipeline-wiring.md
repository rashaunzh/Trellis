# 2026-08-24 — Full Chain Phase 2：Service Pipeline Wiring

## 目标

把 Phase 1 的前半段智能链路（goalAnalyzer → courseAnalyzer → capabilityMapper →
adaptiveRoutePlanner）接入 application service，产物作为 `workspace.analysis`
transient 返回；**不切换默认 planner**，confirmProposal / replanCurrentWeek 仍走
legacy `planner.composeWeeklyPlan`，Evidence Review / Adjustment 不动。

## 决策

- **analysis 只在 runDiagnostic 响应上附带**（任务给的"最小稳定方案"选项 a）：
  `Workspace.analysis: LearningAnalysis | null`，getWorkspace 与其他端点返回 null。
  不落库、不做 schema 变更、不在 getWorkspace 重算（避免 materialIds/preference
  未持久化导致的瞬态漂移）。
- `LearningAnalysis` 契约落在 `agents/types.ts`：goalAnalysis（含回填的
  targetCapabilityIds）/ courseMaterials / capabilityMap / adaptivePlan /
  plannerMode: "legacy" / mode: "rule"。
- runDiagnostic 保持 legacy：`agents.planner.planLearningRoute` → profile.activeRouteId
  仍用 legacy proposal.routeId → nodeProgress 只初始化 legacy route 节点（绝不写
  cap.generic.*）；新增 `buildAnalysis()` 纯函数流水线，产物只进 workspace.analysis。
- generic fallback：analysis 可显示 generic capabilityMap（strategy
  generic_fallback / adaptivePlan.mode generic），但 activeRouteId 仍为 legacy
  ai-literacy，generic 能力 id 不进入 nodeProgress / activities / evidence。
- 任务描述中的 `analyzeCourseMaterials` 为笔误，实际使用 Phase 1 端口
  `courseAnalyzer.analyzeMaterials`。
- frontend.ts 仅同步客户端 Workspace 类型（analysis 字段 + type-only 导入），
  API client 与 UI 不动。

## 验证

- `npx tsc --noEmit --incremental false` → 0 错误。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` → 151/151
  （基线 142 + 新增 9：full-chain-integration.test.ts）。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` → 0 problems。
- 探针：goal "学 AI" → strategy existing_content（14 能力）/ adaptivePlan
  content_pack；"系统学习 AIPM" / "练习英语口语" → generic_fallback，activeRouteId
  仍 ai-literacy；materialIds=[res.gml-crash-course] → courseMaterials
  coveredCapabilityIds 含 ai-literacy.mechanism（resourceMappings 权威）。
- 独立审计子代理复核 8 条硬约束（schema/迁移/UI/legacy 默认/证据评审/调整/
  generic 泄漏/测试），结果见审计输出。

## 变更文件

- 修改：`lib/learning/application/learning-service.ts`（Workspace.analysis +
  runDiagnostic 附带 + buildAnalysis）、`lib/learning/frontend.ts`（客户端类型镜像）、
  `lib/learning/agents/types.ts`（LearningAnalysis + AdaptivePlan 类型导入）。
- 新增：`tests/learning-domain/full-chain-integration.test.ts`（9 用例）。

## 未做（Phase 3 及以后）

- 未切换默认 planner（plannerMode 恒 "legacy"，adaptive 仅预览）。
- 未持久化 analysis（materialIds/preference 仍未落库；如需跨刷新一致，Phase 3
  可考虑 learning_diagnostics 快照或新表）。
- 未改 schema / 迁移 / UI；generic 能力仍未接入证据评审闭环。
