# Trellis V0.2 架构：学习编排内核

> 状态：已确认基线
> 日期：2026-08-14
> 前置文档：`docs/product/TRELLIS_V0.2_PRD.md`（产品基线）、`docs/archive/2026-08-13-mvp-proposals/TRELLIS_MVP_ARCHITECTURE_PROPOSAL.md`（历史提案）
> 兼容边界：V0.1 生产数据和 API 保留为兼容层，新学习内核独立运行

## 1. 架构目标

Trellis V0.2 MVP 是一个**学习编排系统**，一天内跑通最小闭环：

```text
目标/材料输入 → 诊断 → 学习地图 → 首周计划 → 学习活动 → 证据提交 → 节点成长状态变化 → 后续建议
```

架构服务于一个问题：**系统如何依据真实证据，可靠地决定学习者的下一步，并把这一步编排成每周真正能参与的学习活动。**

## 2. 产品结构（固定）

前台只有三个一级功能，不再做四个平级页面（继续学习 / 学习路径 / 复习评估 / 资源库 全部废弃）：

| 一级功能 | 回答的问题 | 核心对象 |
|---|---|---|
| 学习 | 这周推进什么、为什么、投入多少、产出什么证据 | 本周计划 + 2–4 个活动 |
| 成长 | 我在树上哪里、已验证了什么 | 统一成长地图（路线 + 节点状态 + 证据 + 调整记录） |
| 工作台 | 手上有什么材料、工具，映射到哪个节点 | Inbox + 用户材料 + 推荐资源 + 工具卡片 |

学习地图和个人成长树是**同一张图的两个层**（领域结构 + 个人进度），不分成两个功能。

## 3. Agent 边界（MVP 关键决策）

**MVP 不建设内嵌自研 agent runtime。** 只保留四类接口，作为可替换层：

| 接口 | 职责 | 输入 | 输出 |
|---|---|---|---|
| `planner.planLearningRoute` | 根据目标、时间、材料、自评生成路线 | 诊断结果 + 学习地图 + 约束 | 路线提案（含相邻分支与理由） |
| `planner.composeWeeklyPlan` | 在稳定路线上编排本周活动 | 路线 + 节点状态 + 周容量 | 周计划（核心/可选 + 预计时间） |
| `activityComposer.composeActivity` | 把节点拆成具体学习活动 | 节点 + 阶段 + 材料 + 时间容器 | 活动（目标/输入/步骤/证据要求） |
| `evidenceEvaluator.evaluateEvidence` | 判断证据是否支持节点成长 | 证据 + 节点目标 + 量规 | 评估（结论/置信度/依据/建议） |
| `adjustmentAdvisor.suggestAdjustment` | 提出路径或计划调整建议 | 证据评估 + 计划执行情况 + 路线 | 调整建议（类型/原因/目标变化） |

约束：

1. **所有 agent 输出必须落结构化 schema**（JSON），不能只是一段自然语言。
2. 首版实现可以是本地规则 + mock AI 输出，也可以调用现有 LLM 接口；不引入复杂 agent 框架。
3. agent 接口是**可替换层**：未来从外部调用/规则服务替换成内嵌自研 agent 时，只替换接口实现，不改产品主流程。
4. agent 无正式状态写权限：所有写操作先落到"候选/提案"，用户确认后才生效（提案 → 审阅 → 确认）。
5. 无模型密钥时，核心流程通过规则实现继续运行（确定性内核不受影响）。

## 4. 领域模型

### 4.1 内容层（学习地图，版本化、只读）

| 对象 | 作用 |
|---|---|
| `route` | 一条学习路线（如 AI 应用开发），有版本 |
| `node` | 地图节点（能力/主题），稳定 ID + 标准名称 + 别名 + 个人显示名 |
| `edge` | 节点间关系（前置 prerequisite / 支持 supports / 关联 related） |
| `branch` | 分支（相邻分支、可选分支、条件分支） |
| `resourceMapping` | 资源与节点的映射（来源、可信等级、用途） |
| `toolMapping` | 工具与节点的映射（工具、用途、适用活动） |

### 4.2 学习者状态层（可写）

| 对象 | 作用 |
|---|---|
| `weeklyPlan` | 某周计划：容量、核心活动、可选活动、状态 |
| `learningActivity` | 一次可执行的学习活动（节点、目标、输入、步骤、证据要求、状态） |
| `evidence` | 用户提交的证据（内容或安全链接、目标、状态） |
| `nodeProgress` | 节点上的个人成长状态（三态 + 置信度 + 支持证据） |
| `adjustmentRecord` | 路径/计划调整记录（原因、类型、确认状态、影响） |

### 4.3 状态机（固定）

**节点状态（三态，成长页主视觉）：**

```text
unstarted（未点亮）→ growing（成长中）→ validated（已验证）
```

- `unstarted`：未学习，或只有接触记录而没有能力证据
- `growing`：正在理解、模仿或练习，表现尚不稳定
- `validated`：已有符合节点目标的独立表现证据

**活动状态：**

```text
planned → in_progress → evidence_submitted → reviewed → completed
                                     ↘ needs_revision → in_progress
```

**证据状态：**

```text
draft → submitted → accepted
                 ↘ needs_revision → resubmitted
```

**关键规则：**

1. 活动完成（`completed`）**不直接**把节点置为 `validated`。节点状态由 `evidenceEvaluator` 评估后按规则迁移。
2. 证据 `accepted` 后才可能验证节点；`needs_revision` 不改变节点状态。
3. 允许跳学（跳过活动/节点），但跳过后节点进入待验证状态，必须通过证据验证，暴露缺口时再插入前置活动。
4. 周计划**半稳定**：普通完成只更新状态，不重新编排整个星期；只有明显过难/过易/前置不足/现实时间变化才提出轻量调整。刷新页面不产生随机变化（确定性编排）。
5. 路线变化必须产生 `adjustmentRecord`，用户确认后才生效，可追溯、可拒绝。

## 5. API 边界

API 围绕**学习闭环**设计，不是围绕页面或数据表。核心是面向页面的读模型 `workspace`：前端只读一个稳定 workspace，不到处拼状态。

```text
GET  /api/learning/workspace           → 当前路线、相邻分支、本周计划、活动列表、节点状态、证据摘要、工作台资源映射、调整记录
POST /api/learning/diagnostic          → 目标 + 每周时间 + 材料 + 自评 → 初始画像 + 推荐路线 + 首周计划草案
POST /api/learning/proposal/confirm    → 用户确认路线和首周计划
POST /api/learning/activities/:id/start → 开始活动
POST /api/learning/activities/:id/evidence → 提交证据
POST /api/learning/evidence/:id/review → 规则或 AI 评估证据，用户可确认
POST /api/learning/adjustments/:id/confirm → 确认路径调整建议
```

写接口要求：

- 带 `ownerId` 范围；
- 幂等（重复提交不产生重复效果）；
- 验证当前状态是否合法（状态机约束）；
- 写业务对象与审计记录在同一事务；
- AI 结构化输出先校验再进入候选记录；
- 返回新的 workspace 读模型或其版本号。

## 6. 代码边界

沿用仓库现有结构（`app/` 保持根目录、`lib/` 放业务逻辑、`db/` 放 schema）：

```text
app/
  learn/                    # 学习页（默认首页）
  grow/                     # 成长页（统一成长地图）
  workbench/                # 工作台页
  api/learning/             # 面向闭环的接口
lib/learning/
  domain/                   # 状态机、规则、领域类型
  application/              # 用例服务（编排闭环）
  content/                  # 学习地图内容读取与校验
  agents/                   # 四类 agent 接口 + 规则/mock 实现（可替换层）
  persistence/              # 数据访问
db/
  schema.ts                 # V0.1 兼容表保留；新增 learning 域表
drizzle/                    # 迁移
tests/
  learning-domain/          # 内容模型 + 状态机
  learning-api/             # API 场景
  learning-e2e/             # 浏览器完整闭环
```

新增表（Drizzle/SQLite）示意：`learning_routes`、`learning_nodes`、`learning_edges`、`learning_branches`、`learning_resources`、`learning_tools`（内容层）；`learning_weekly_plans`、`learning_activities`、`learning_evidence`、`learning_node_progress`、`learning_adjustments`（状态层）。内容层表可复用现有 `learningDiagnostics` 的 ownerId 边界模式。

## 7. 与 V0.1 的关系

- V0.1 的 `records`、`weekly_reviews`、四主线数据**不迁移、不删除、不伪装成新学习状态**，继续作为兼容层保留。
- 新学习内核使用独立表与 API 运行。
- 后续迁移通过显式适配层进行，不在 MVP 范围内。

## 8. 架构验收门槛

1. 前台是学习/成长/工作台三个一级功能，无四页面导航。
2. 学习页能直接开始本周任务（workspace 由服务端返回，不由前端临时拼装）。
3. 成长页能看出"我在树上的哪里"（同图双层：领域结构 + 个人进度）。
4. 活动完成、证据、评估、节点验证是不同状态。
5. agent 是接口层，输出落结构化 schema，可整体替换不破主流程。
6. 刷新和重启后，地图、计划、证据和依据不丢失。
7. 路线调整可追溯、可拒绝。
8. 旧 V0.1 数据不被清空、覆盖或伪装成新学习状态。
