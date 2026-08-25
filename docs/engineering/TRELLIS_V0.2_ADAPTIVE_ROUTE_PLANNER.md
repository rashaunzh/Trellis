# Trellis V0.2 自适应路线规划（AdaptiveRoutePlanner）审计与设计

> 状态：已确认方案 + 规则版 helper 已实现（未接入服务层）
> 日期：2026-08-24
> 范围：Route Planner / Activity Composer 前半段补齐（GoalAnalysis + CourseMaterialAnalysis + CapabilityMap → LearningRoute → WeeklyPlan → Activities → Evidence Requirements）
> 边界：不改 UI、不改 DB schema、不动 Evidence Review、不引入 LangGraph、不删除 RulePlanner（保留为 fallback）
> 前置文档：`docs/product/TRELLIS_V0.2_PRD.md`、`docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`、`memory/decisions/2026-08-12-v0.2-adaptive-learning.md`

## 1. 现状审计：Route Planner 与 Activity Composer 如何工作

### 1.1 RulePlanner（`lib/learning/agents/planner.ts`）

实现 `PlannerPort` 两个方法，全部为确定性规则：

**`planLearningRoute(input: DiagnosticInput): RouteProposal`**

1. 用硬编码 `ROUTE_SEQUENCE`（3 条路线：`ai-literacy` 6 节点 / `ai-app-dev` 4 节点 / `ai-product` 3 节点）计算各路线"已掌握率"（自评 ≥2 的节点占比）。
2. 选路线：`build_first` → 应用开发分支得分 ≥0.5 走分支否则通识；`breadth_first` → 最高分路线 ≥0.6 否则通识。
3. 节点序列 = `ROUTE_SEQUENCE[routeId]` 过滤掉自评 ≥2 的节点。
4. 初始画像（strengths/gaps/recommendedFirstNodeId）+ 相邻分支（`findAdjacentBranches`，读 related 边）+ 每路线一条**硬编码文案**的 rationale。

**`composeWeeklyPlan(input: WeeklyPlanInput): WeeklyPlanDraft`**

1. 候选 = 当前路线节点中：未 validated、未跳过、前置满足（`prerequisitesSatisfied` 读 prerequisite 边）；排序 = 状态（growing 优先）→ `ROUTE_SEQUENCE` 下标 → ID。
2. 活动链**硬编码 6 类**：build_model 45 / follow_demo 45 / independent_practice 90 / quiz 30 / reflection 30 / integrated_task 120，每类带硬编码 label 与 why。
3. 逐个节点按链选活动，遵守 `node.activityTemplates`，核心数上限 `min(8, max(2, ⌊容量/60⌋))`，承诺时长 ≤ 容量；再补 2 个可选活动（follow_demo + independent_practice 各 45，不计承诺）。
4. 输出核心/可选计数、totalMinutes、活动列表与固定模板 rationale。

### 1.2 RuleActivityComposer（`lib/learning/agents/activity-composer.ts`）

`composeActivity(input): ActivityDraft` 按 7 类活动（含 retest）switch 出固定模板：每类有固定 title/goal/steps/expectedEvidence/evaluationCriteria/nextAdvice 中文文案，仅以 `nodeTitle` 参数化；`estimatedMinutes` ≥30、15 分钟递增；`inputRefs` 直接透传 resourceIds。

**关键点：活动文案不感知能力信号**——`expectedEvidence`/`evaluationCriteria` 是"泛化模板"（如"解释覆盖机制与边界"），而节点信号（`node.signals`）只在后半段 Evidence Review 的 `capabilitySignals` 注入时才被使用。前半段（生成活动）与后半段（评审活动）对"能力"的引用是断开的。

### 1.3 服务层编排（`lib/learning/application/learning-service.ts`）

- `runDiagnostic` → `planner.planLearningRoute` → 存 profile（proposed）+ 初始化路线节点进度（自评 ≥2 → growing）。
- `confirmProposal` → `planner.composeWeeklyPlan`（seed=42）→ 存周计划（confirmed）→ `createActivitiesFromPlanDraft` 逐个 `activityComposer.composeActivity` 落活动。
- `replanCurrentWeek` 同样走 composeWeeklyPlan（seed=Date.now()），温和替换未产生证据的活动。
- `retestNode` / `skipNode` / 调整建议执行也直接调 composer。
- 内容包 `learningContentPack`（`lib/learning/domain/content.ts`）在服务层被**直接 import**，未走 `AgentContext.contentPack` 注入（`AgentContext` 类型存在但未使用）。

### 1.4 写死位置清单

| 位置 | 文件 | 说明 |
|---|---|---|
| 路线节点序列 | `agents/planner.ts` `ROUTE_SEQUENCE` | 3 条路线的顺序硬编码，**不读边关系**；改内容包边不会自动改序列 |
| 路线选择阈值与分支 | `agents/planner.ts` `planLearningRoute` | 0.5/0.6 阈值、build_first 分支逻辑、每路线 rationale 文案 |
| 周活动链 | `agents/planner.ts` `composeWeeklyPlan` | 6 类活动 + 时长 + label/why 全部硬编码 |
| 可选活动 | `agents/planner.ts` | 固定 follow_demo + independent_practice 各 45 |
| 内容包种子数据 | `domain/content.ts` | routes/nodes/edges/branches/resources/mappings 全部静态常量（版本化只读） |
| 能力信号数据 | `domain/signals.ts` | NODE_SIGNALS / CAPABILITY_SIGNALS / DEFAULT_SIGNALS（产品数据层，有意解耦） |
| 活动模板文案 | `agents/activity-composer.ts` | 7 类活动中文文案固定，不读 signals |
| 服务层内容包引用 | `application/learning-service.ts` | 直接 `import learningContentPack`，未走 AgentContext 注入 |

## 2. 目标：前半段补齐后的数据流

```text
GoalAnalysis ─┐
CourseMaterialAnalysis ─┼→ CapabilityMap → AdaptiveRoutePlanner → route / orderedCapabilities
              └──────────┘        │                             → weeklyPlan
                                  │                             → activities（带 expectedEvidence + completionCriteria）
                                  │                             → rationale / mode
                                  └──── RulePlanner（fallback，无 CapabilityMap 时走旧路径）
```

## 3. CapabilityMap 驱动：Route Planner 如何生成各项产物

输入变为 CapabilityMap 后，Route Planner 的生成规则（规则版已实现，见 §9）：

### 3.1 routeNodes

- 起点 = `GoalAnalysis.targetCapabilityIds`（空 = 覆盖全图）；**前置闭包**：沿 prerequisite 入边反向 BFS，把目标的前置链全部纳入（保证"为了目标必须先学 X"）。
- 每个 routeNode = capabilityId / title / description / targetLevel / isMilestone / signals / sourceRefs / **prerequisiteIds**（prerequisite 入边）/ **supportingIds**（supports 入边）/ satisfied 标记。
- 顺序 = 前置图拓扑排序（Kahn）：`breadth_first` 按声明顺序取（跨模块广度展开）；`build_first` 按"解锁依赖数最多优先"取（先打地基再上产出）。确定性，同输入同输出。

### 3.2 prerequisites

- 直接来自 CapabilityMap 边：`prerequisiteIds` = 该能力 prerequisite 入边的源；`supportingIds` = supports 入边的源（深化/相邻方向，不进强制前置）。
- 周计划候选判定沿用现有语义："前置已满足（satisfied 或节点 validated）才能排入本周"——与现有 `prerequisitesSatisfied` 规则一致，只是数据源换成能力图边。

### 3.3 weeklyPlan

- 候选 = orderedCapabilities 中：非 satisfied、前置已满足的能力。
- 活动链按**目标深度**缩放：深度 1（理解）→ [建立模型, 阅读示范]；深度 2（应用）→ + 独立练习；深度 3（迁移）→ + 情境应用。
- 按容量确定性填充：核心数上限 `min(8, max(2, ⌊容量/60⌋))`，承诺 ≤ 容量，可选 2 个不计承诺（语义与 RulePlanner 对齐）；极小容量（<45 分钟）兜底 1 个合法活动。
- `selfReport ≥ 目标等级`（或节点 validated）→ satisfied：不进本周、标记后置；`selfReport ≥1 未达标` → 跳过建立模型/示范，直接从独立练习开始。

### 3.4 activities

- 每个周计划条目 → 信号化活动草稿（见 §6）；`inputRefs` = `CourseMaterialAnalysis` 中覆盖该能力的材料 ID（去重）。

### 3.5 completionCriteria

- 节点级：`证据覆盖全部能力信号（capability.signals）且达到目标等级（min(targetLevel, 目标深度)）`。
- 活动级：与 evaluationCriteria 同源（"产出满足能力目标；独立完成；覆盖信号 X、Y；自评与证据一致"），编排层可直接消费。

### 3.6 expectedEvidence

- 由活动类型 × 能力信号参数化：建立模型 → "概念解释覆盖信号 A、B + 关系图 + 失效条件"；独立练习 → "独立产出体现信号 A、B"；情境应用 → "完整产出 + 对照信号的自评"。与 Evidence Review 的 `capabilitySignals` 语义一致，前后段首次对齐。

## 4. AdaptiveRoutePlanner 最小契约

实现于 `lib/learning/agents/adaptive-types.ts`：

**输入**

| 字段 | 类型 | 说明 |
|---|---|---|
| `goalAnalysis` | `{ goal, targetCapabilityIds, depth: 1\|2\|3, context? }` | 目标解析产物 |
| `capabilityMap` | `{ version, source?, capabilities[], edges[] }` | 通用能力图 |
| `weeklyMinutes` | `number` | 每周容量 |
| `preference` | `"breadth_first" \| "build_first"` | 与现有 DiagnosticInput 一致 |
| `selfReport` | `Record<string, number>` | capabilityId → 0-3 |
| `nodeStatusById?` | `Record<string, NodeStatus>` | 接入服务层后由 NodeProgress 推导 |
| `materials?` | `CourseMaterialAnalysis[]` | 课程材料分析 |

**输出** `AdaptivePlan`

| 字段 | 说明 |
|---|---|
| `route` | routeId（`adaptive-<hash(目标+顺序)>` 确定性）/ nodeIds / nodes / edges 子集 |
| `orderedCapabilities` | 学习顺序的能力节点（含 satisfied 标记） |
| `weeklyPlan` | weekKey / 核心·可选计数 / totalMinutes ≤ 容量 / 活动条目 / rationale |
| `activities` | 完整活动草稿（expectedEvidence + completionCriteria 齐备） |
| `rationale` | 路线选择 + 周编排理由 |
| `mode` | `"content_pack"`（消费现有内容包投影）\| `"generic"`（通用能力图） |

接口 `AdaptivePlannerPort.plan(input): AdaptivePlan`；规则实现 `RuleAdaptiveRoutePlanner`（纯函数、确定性）。

## 5. 与现有内容包兼容（RulePlanner fallback）

1. **RulePlanner 不删不改**：`createRuleAgents()` 保持原样，现有 115 个领域测试零回归（本轮 129/129 含新增 14 个）。
2. **投影桥 `toCapabilityMap(pack)`**：把 `learningContentPack` 单向投影为 CapabilityMap（nodes→capabilities、edges→capabilityEdges、signals 原样、sourceRefs/activityTemplates 保留、`source: "content_pack"`）。内容包仍是单一数据源，投影零复制语义（对象引用共享）。
3. **双模式并存**：自适应规划器在 content_pack 模式下消费投影，输出与 RulePlanner 同构的周计划语义；未来服务层接入时：有 CapabilityMap（含投影或 AI 生成）→ 走 AdaptivePlannerPort；否则 → 走 RulePlanner。`mode` 字段让调用方能区分与审计。
4. **能力图校验 `validateCapabilityMap`**：重复 ID / 空 signals / targetLevel 越界 / 边引用不存在 / 前置环 → 抛错，与 `validateContentPack` 同级，防静默坏数据。
5. **接线点（后续单独接入，不在本轮）**：`learning-service.ts` 的 `runDiagnostic`/`confirmProposal` 增加 planner 选择逻辑；API 与 DB schema 不变，workspace 读模型不变。

## 6. Activity Composer 从能力信号生成活动

规则版 `composeAdaptiveActivity(input)`（`adaptive-planner.ts`）实现五阶段，`expectedEvidence` / `completionCriteria` / `evaluationCriteria` / 步骤均由 `capability.signals` 参数化：

| 阶段 | 活动类型 | 能力信号如何进入 |
|---|---|---|
| 建立模型 | `build_model` | 解释须覆盖信号列表；证据 = "概念解释覆盖信号 A、B + 关系图 + 失效条件"；量规逐信号判定 |
| 阅读示范 | `follow_demo` | 拆解须指出"示例如何体现信号"；证据 = 拆解 + 有效性解释（对应信号）+ 局限 |
| 独立练习 | `independent_practice` | 产出须覆盖信号；`isSkipValidation` → "跳学验证："前缀；`focusSignals` → "补强练习："前缀并聚焦缺失信号 |
| 情境应用 | `integrated_task` | 场景须调动 ≥2 个能力（`integrateCapabilityIds`），自评逐信号核对 |
| 复测/补强 | `retest` / 补强独立练习 | retest 三题（概念/边界/应用）对照信号自评；复测失败/证据退回后服务层用 `focusSignals` 生成补强活动 |

兼容性：既有 `ComposeActivityInput` 与 RuleActivityComposer **不动**；新组合器是独立入口，未来可替换/增强。

## 7. 最小测试清单（已实现于 `tests/learning-domain/adaptive-planner.test.ts`，14 用例）

1. 用现有 AI 内容包生成路线不破坏旧行为：`RulePlanner` 原样可用（fallback 回归断言）+ `toCapabilityMap` 投影完整（节点/边/信号数量一致）+ content_pack 模式生成路线与 ≥1 周活动。
2. generic CapabilityMap（公开演讲能力图）生成路线与 ≥1 周活动（去领域化验证）。
3. 所有活动草稿带非空 `expectedEvidence` / `completionCriteria` / `evaluationCriteria` / ≥3 步 / 时长 ≥30。
4. `weeklyMinutes` 限制：60 vs 240 分钟 → 核心活动数与总活动数更少，承诺 ≤ 容量。
5. `selfReport` 高：达标（≥ targetLevel）不进周计划（satisfied 标记 + 后置）；有基础（≥1 未达标）跳过 build_model/follow_demo 直接独立练习。
6. 前置未满足的能力不进首周（audience 可排，structure/delivery/qa 不可排）。
7. 确定性：同输入同输出（deepEqual，含 seed）。
8. `build_first`：路线 = 目标 + 前置闭包，无关能力（storytelling）不进路线。
9. 能力图校验：重复 ID、前置环抛错。
10. 五阶段组合器由信号参数化；补强（focusSignals）与跳学验证独立标记；情境应用整合计数。
11. 课程材料分析 → 活动 `inputRefs`（覆盖材料进入、无关材料不进入）。

## 8. 已交付实现

| 文件 | 内容 |
|---|---|
| `lib/learning/agents/adaptive-types.ts` | GoalAnalysis / CourseMaterialAnalysis / Capability / CapabilityMap / AdaptivePlan / AdaptivePlannerPort / ComposeAdaptiveActivityInput 契约 |
| `lib/learning/agents/adaptive-planner.ts` | `toCapabilityMap` 投影、`validateCapabilityMap`、`RuleAdaptiveRoutePlanner`（路线/周计划/活动）、`composeAdaptiveActivity`（五阶段信号化）、`isoWeekKey`/`fnv1a`/`normalizeMinutes` 工具 |
| `tests/learning-domain/adaptive-planner.test.ts` | 上述最小测试清单 14 用例 |

验证：`node --test --test-isolation=none "tests/learning-domain/*.test.ts"` → 129/129 通过（新增 14）；`npx tsc --noEmit` → 0 错误；`npx eslint`（新增 3 文件）→ 0 problems。

未改动：`planner.ts`、`activity-composer.ts`、`learning-service.ts`、`content.ts`、`signals.ts`、`state-machine.ts`、任何 schema 与前端。

## 9. 后续接入点（下一阶段，非本轮）

1. **服务层接线**：`runDiagnostic` 中根据是否存在 CapabilityMap（GoalAnalysis 产物）选择 `AdaptivePlannerPort` 或 `RulePlanner`；`confirmProposal`/`replanCurrentWeek` 复用同一选择结果；`createActivitiesFromPlanDraft` 可切换为信号化组合器（或保留既有 composer，二者契约兼容）。
2. **AI 替换点**：未来 AI 实现只替换 `AdaptivePlannerPort.plan` 的实现；`GoalAnalysis`/`CourseMaterialAnalysis` 的 AI 生成器另行定义（同样走"提案 → 审阅 → 确认"）。
3. **路线版本化**：`AdaptiveRoute.version` 继承 CapabilityMap 版本；主路径/核心能力变化仍须用户确认（符合决策 2026-08-12 第 12 条与 PRD"长期路径版本化"）。
4. **能力画像**：PRD 4.5"能力画像"可从 `orderedCapabilities` + `satisfied` + 证据聚合派生，本轮不实现。
