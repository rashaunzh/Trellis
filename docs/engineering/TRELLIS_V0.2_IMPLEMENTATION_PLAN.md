# Trellis V0.2 实施计划

> 状态：已确认
> 日期：2026-08-14
> 目标：一天内跑通 MVP 最小闭环：诊断 → 学习地图 → 首周计划 → 学习活动 → 证据提交 → 节点成长状态变化 → 后续建议
> 产品结构固定：学习 / 成长 / 工作台；MVP 不做内嵌自研 agent，只保留四类接口（planner、activityComposer、evidenceEvaluator、adjustmentAdvisor）
> 架构依据：`docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`

## 执行顺序与检查点

每完成一个 checkpoint 停下来交给用户检查，确认后才进入下一阶段。

---

## Phase 0：文档与交接修复（本次）

**目标**：确保后续 agent 不再跑偏。

- [x] 确认当前分支、远程、工作树状态
- [x] 阅读 `AGENTS.md`、`memory/handoff/current.md`、`docs/product/TRELLIS_V0.2_PRD.md`
- [x] 修正过时交接：删除 D 盘唯一源说法、删除"四页面 MVP"旧描述；写明 GitHub 当前分支是唯一交付源
- [x] 归档两份旧提案（MVP_PRD_PROPOSAL、MVP_ARCHITECTURE_PROPOSAL → `docs/archive/2026-08-13-mvp-proposals/`）
- [x] 新增 `docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`（本仓库架构基线）
- [x] 新增 `docs/engineering/TRELLIS_V0.2_IMPLEMENTATION_PLAN.md`（本文件）

**检查点 0**：文档统一为"学习 / 成长 / 工作台"；agent 只保留接口；无旧四页面术语。

---

## Phase 1：领域模型与数据结构

**目标**：先定住工程骨架，不急着画 UI。

1. 学习地图内容模型：`route`、`node`、`edge`、`prerequisite`、`adjacent branch`、`resource mapping`、`tool mapping`
2. 用户学习状态模型：`weeklyPlan`、`learningActivity`、`evidence`、`nodeProgress`、`adjustmentRecord`
3. 节点状态固定三态：`unstarted` / `growing` / `validated`
4. 活动状态：`planned` / `in_progress` / `evidence_submitted` / `reviewed` / `completed`
5. 证据状态：`draft` / `submitted` / `accepted` / `needs_revision`
6. agent 接口（定义 + 规则实现）：
   - `planLearningRoute(input)`
   - `composeWeeklyPlan(input)`
   - `composeActivity(input)`
   - `evaluateEvidence(input)`
   - `suggestAdjustment(input)`

产出：`db/schema.ts` 新增 learning 域表 + Drizzle 迁移；`lib/learning/domain/` 类型与状态机；`lib/learning/agents/` 四接口 + mock 实现。

**检查点 1**：活动完成 ≠ 节点已验证；跳学后必须验证；周计划稳定不随机变化；路线变化有记录。

---

## Phase 2：后端 API 与读取模型

**目标**：前端只读一个稳定 workspace，不到处拼状态。

- `GET /api/learning/workspace` → 当前路线、相邻分支、本周计划、活动列表、节点状态、证据摘要、工作台资源映射、调整记录
- `POST /api/learning/diagnostic` → 目标 + 每周时间 + 材料 + 自评 → 初始画像 + 推荐路线 + 首周计划草案
- `POST /api/learning/proposal/confirm` → 轻确认路线和首周计划
- `POST /api/learning/activities/:id/start`
- `POST /api/learning/activities/:id/evidence`
- `POST /api/learning/evidence/:id/review`（规则或 AI 评估，用户可确认）
- `POST /api/learning/adjustments/:id/confirm`

**检查点 2**：API 围绕学习闭环而非页面；workspace 能恢复完整页面状态；刷新后计划/节点状态/证据不丢；agent 是可替换层。

---

## Phase 3：前端三大功能

**目标**：把第一眼体验改成 Trellis 真正的定位。

1. **学习页**（`/learn`，默认首页）：本周计划、当前阶段、2–4 个核心活动 + 0–2 可选、每活动关联节点/预计时间/学习动作/产出证据。不做今日活动、打卡日历、独立"继续学习"。
2. **成长页**（`/grow`）：同一张学习地图——当前路线、相邻分支、三色节点状态、节点详情、已提交证据、已验证成果、调整记录。学习地图与成长树是同一张图的两个层。
3. **工作台**（`/workbench`）：收集箱、用户材料、系统推荐资源、工具卡片、资源/工具与学习节点映射。每张卡片说明：这是什么、对应哪个节点、适合在哪个活动使用、为什么现在推荐。

**检查点 3**：无四页面导航；学习页能直接开始本周任务；成长页能看出"我在树上的哪里"；工作台有映射而非资源堆放。

---

## Phase 4：活动闭环

**目标**：MVP 最小可验证体验，至少 3 类活动：

1. **建立模型**：解释概念、画出关系、总结判断标准
2. **跟随示范**：看例子并解释为什么有效
3. **独立练习**：完成小产出（prompt、代码片段、产品判断、学习笔记）

每个活动必须包含：学习目标、对应节点、预计时间（默认 30 分钟 + n × 15 分钟）、输入材料、操作步骤、产出证据、评估标准、下一步建议。

**检查点 4**：活动围绕"知识 + 能力 + 工具 + 证据"，不是简单 Todo；能完成活动留下证据；能根据证据更新节点状态。

---

## Phase 5：测试与验收

1. **内容模型测试**：节点 ID 唯一；三条路线存在；前置关系合法；当前路线能找到相邻分支
2. **状态机测试**：活动完成不直接验证节点；证据 accepted 后才可能验证；跳学生成验证要求；周计划刷新不随机变化
3. **API 测试**：diagnostic 生成路线草案；confirm 后 workspace 读到计划；evidence 提交后 workspace 状态变化；adjustment 有记录
4. **浏览器验收**：新用户完成诊断 → 看到首周计划 → 开始活动 → 提交证据 → 成长图节点变色 → 刷新后状态保留
5. **构建**：`npm test`、`npm run build`

**检查点 5**：完整闭环跑通；核心规则有测试覆盖；build 通过；没有为演示写死的页面假数据。

---

## 交付与继续

- 当前分支 `docs/trellis-v02-adaptive-learning-prd` 是唯一交付源，所有工作推送到该分支。
- 每个 checkpoint 完成后提交并推送，用户检查通过后进入下一阶段。
- 结束会话前按 `AGENTS.md` 规则更新 `memory/handoff/current.md` 并写会话记录。
