# 当前接力

更新时间：2026-08-14

## 当前目标

在 GitHub 仓库（`rashaunzh/AI-Learning-OS`）当前分支 `docs/trellis-v02-adaptive-learning-prd` 上推进 Trellis V0.2 MVP，目标一天内跑通最小闭环：

```text
诊断 → 学习地图 → 首周计划 → 学习活动 → 证据提交 → 节点成长状态变化 → 后续建议
```

## 已确认的产品与工程基线（用户 2026-08-14 确认）

- 产品结构固定为**学习 / 成长 / 工作台**三个一级功能；不再做旧的四页面结构（继续学习、学习路径、复习评估、资源库）。
- **MVP 不做内嵌自研 agent runtime**，只保留四类接口：`planner`（planLearningRoute / composeWeeklyPlan）、`activityComposer`（composeActivity）、`evidenceEvaluator`（evaluateEvidence）、`adjustmentAdvisor`（suggestAdjustment）。输出必须落结构化 schema，首版可用规则 + mock AI 实现，未来整体替换不改主流程。
- 节点状态三态：`unstarted` / `growing` / `validated`；活动完成不直接验证节点，证据 accepted 后才可能验证。
- 周计划半稳定，刷新不随机变化；路线变化必须留调整记录。
- 执行顺序：文档/架构 → 领域模型/API → 前端 → 测试，每阶段（checkpoint）停给用户检查。

## 交付源（重要）

- **GitHub 当前分支 `docs/trellis-v02-adaptive-learning-prd` 是唯一交付源**，所有工作在该分支提交并推送。
- 本地工作副本位于 `D:\02-Production\01-Trellis`，仅作为该 GitHub 分支的工作区，不再作为独立"当前源"。
- 会话开始前拉取最新，结束后推送；发生冲突时停止，不得覆盖。

## 当前进度

- [x] Phase 0 完成：仓库确认、交接修复、归档旧提案、新增架构文档与实施计划。
  - `docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`（架构基线）
  - `docs/engineering/TRELLIS_V0.2_IMPLEMENTATION_PLAN.md`（实施计划与检查点）
  - 旧提案已归档至 `docs/archive/2026-08-13-mvp-proposals/`
- [ ] Phase 1：领域模型与数据结构（检查点 1）
- [ ] Phase 2：后端 API 与读取模型（检查点 2）
- [ ] Phase 3：前端三大功能（检查点 3）
- [ ] Phase 4：活动闭环（检查点 4）
- [ ] Phase 5：测试与验收（检查点 5）

## 尚未完成 / 开放问题

- Phase 1–5 全部未开始，等待用户检查 Checkpoint 0。
- 现有 `app/learn`、`app/api/learning/*` 是 78ca0f1 提交的旧实现（用户已否定），V0.2 按新架构重做；V0.1 兼容层（records/weekly_reviews 等）保留不动。
- 旧的两份提案文档（已归档）不再作为活跃参考。

## 精确下一步

1. 用户检查 Checkpoint 0（文档统一为三功能结构、agent 只留接口、无旧四页面术语）。
2. 通过后开始 Phase 1：`db/schema.ts` 新增 learning 域表 + `lib/learning/domain/` + `lib/learning/agents/` 四接口，完成后停下等检查。
