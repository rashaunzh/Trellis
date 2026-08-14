# 当前接力

更新时间：2026-08-14

## 当前目标

在 GitHub 仓库（`rashaunzh/AI-Learning-OS`）当前分支 `docs/trellis-v02-adaptive-learning-prd` 上推进 Trellis V0.2 MVP，目标一天内跑通最小闭环：

```text
诊断 → 学习地图 → 首周计划 → 学习活动 → 证据提交 → 节点成长状态变化 → 后续建议
```

## 已确认的产品与工程基线（用户 2026-08-14 确认）

- 产品结构固定为**学习 / 成长 / 工作台**三个一级功能；不再做旧的四页面结构（继续学习、学习路径、复习评估、资源库）。提交 `78ca0f1` 的错误四平级界面前向重构为新结构。
- **MVP 不做内嵌自研 agent runtime**，只保留四类接口：`planner`（planLearningRoute / composeWeeklyPlan）、`activityComposer`（composeActivity）、`evidenceEvaluator`（evaluateEvidence）、`adjustmentAdvisor`（suggestAdjustment）。输出必须落结构化 schema，首版可用规则 + mock AI 输出，未来整体替换不改产品主流程。
- 节点状态三态：`unstarted` / `growing` / `validated`；活动完成不直接验证节点，证据 accepted 后才可能验证。
- 周计划半稳定，刷新不随机变化；路线变化必须留调整记录。
- 执行顺序：文档/架构 → 领域模型/API → 前端 → 测试，每阶段（checkpoint）停给用户检查。

## 交付源（重要）

- **GitHub 当前分支 `docs/trellis-v02-adaptive-learning-prd` 是唯一交付源**，所有工作在该分支提交并推送。
- 本地工作副本位于 `D:\02-Production\01-Trellis`，仅作为该 GitHub 分支的工作区，不再作为独立"当前源"。
- 会话开始前拉取最新，结束后推送；发生冲突时停止，不得覆盖另一台设备的工作。

## 当前进度

- [x] Phase 0 完成：仓库确认、交接修复、归档旧提案、新增架构文档与实施计划。
  - `docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`（架构基线）
  - `docs/engineering/TRELLIS_V0.2_IMPLEMENTATION_PLAN.md`（实施计划与检查点）
  - 旧提案已归档至 `docs/archive/v0.2-drafts/`（2026-08-13 远端清理提交已建，本次统一指向该目录）
- [x] Phase 1 完成（提交 `9b28434`，等待 Checkpoint 1 检查）：
  - `db/schema.ts`：13 张 learning 域表（内容层 routes/nodes/edges/branches/resources/tools + 状态层 weekly_plans/activities/evidence/node_progress/adjustments），状态独立列不塞大 JSON，ownerId 边界
  - `drizzle/0004_kind_boomerang.sql`：迁移已生成
  - `lib/learning/domain/`：types（枚举+领域类型）、state-machine（活动/证据/节点三套状态机 + 跳学规则）、content（三条路线内容包 + 校验 + 相邻分支/前置查询）
  - `lib/learning/agents/`：四接口（planner/activityComposer/evidenceEvaluator/adjustmentAdvisor）契约 + 规则实现（确定性周计划、结构化输出）
  - `tests/learning-domain/`：30 个测试全过（内容模型 8 + 状态机 12 + agent 10），`npm run test:domain` 可跑
  - `tsconfig.json`：allowImportingTsExtensions（Node 原生跑 TS 测试）
- [ ] Phase 2：后端 API 与读取模型（检查点 2）
- [ ] Phase 3：前端三大功能（检查点 3）
- [ ] Phase 4：活动闭环（检查点 4）
- [ ] Phase 5：测试与验收（检查点 5）

## 已知环境问题（Phase 1 遗留）

- `npm run build` 在 Git Bash 下报 `D:\d\02-Production\01-Trellis\dist\.openai\hosting.json` ENOENT——疑似 MSYS 路径转换问题（/d/02-Production → D:\d\...），与本次代码无关，Phase 5 前需要解决或确认既有构建方式。

## 可复用的既有资产（来自 78ca0f1 及后续提交）

- AI 通识内容包 1.1.0：六项能力，含前置、核心问题、学习结果、关键概念、情境练习和一手来源。
- 新版流程基础：初始诊断、确定性评分、路径提案、拒绝重做、用户确认、首周编排和学习状态恢复。
- 本地迁移 `drizzle/0003_lonely_blink.sql` 和 `learning_mvp_states` 状态表。
- Node 22.23.2 下 lint、构建及 6 项测试通过。

## 尚未完成 / 开放问题

- Phase 1–5 全部未开始，等待用户检查 Checkpoint 0。
- 错误实现尚未撤销或重做；保留其中可复用的诊断、提案、内容包和持久化能力，前台需要前向替换。
- 浏览器自动化 CLI 当前不可用，需用户实际查看桌面/移动端视觉与交互。
- 综合任务正式提交、AI 六维评分、用户确认掌握和延迟复测自动调度不在本次 MVP 范围（按 V0.2 实施计划，本次只跑最小闭环）。
- 用户提供的两份 Excel 仍只作为参考材料名称保存，尚未完成内容差异审计。
- 生产迁移和部署继续另行确认。

## 精确下一步

1. 用户检查 Checkpoint 0（文档统一为三功能结构、agent 只留接口、无旧四页面术语、无 D 盘唯一源说法）。
2. 通过后开始 Phase 1：`db/schema.ts` 新增 learning 域表 + `lib/learning/domain/` + `lib/learning/agents/` 四接口，完成后停下等检查。
