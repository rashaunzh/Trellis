# Trellis V0.2 P0 工程任务计划

> 状态：规划中（尚未实现）
> 分支：`docs/trellis-v02-adaptive-learning-prd`
> 基线提交：`db94af0`（feat: add weekly replan flow）
> 依据：`docs/product/TRELLIS_V0.2_PRD.md` 第 14/15/17 节、2026-08-20 重排本周验收（32/32 通过）

## 目标

在现有学习编排闭环上补齐三个 P0 能力，使 MVP 能演示"可信的动态学习编排"的完整叙事——不只完成碎片活动，而是：**完成一次综合情境任务 → 用户确认或纠正掌握判断 → 延迟复测防止一次通过就永久掌握**。

三项 P0：

1. **综合情境任务正式流**：用户完成一次整合多个节点的真实任务，而不只是碎片活动。
2. **掌握确认**：系统评估通过后，用户确认/纠正"我是否真的掌握"，纠正可追溯。
3. **延迟复测**：已验证能力按间隔回访，复测失败降低熟练等级并生成补强活动。

## 非目标

- 不做每日排程、打卡、日历提醒（周推进模型不变）。
- 不做复杂心理画像或概率模型（PRD 14.2）。
- 不新增内嵌 agent runtime（仍走 planner / activityComposer / evidenceEvaluator / adjustmentAdvisor 四接口）。
- 不推翻现有"证据 accepted → 活动 completed → 节点 validated"主链路；掌握确认只挂在**节点验证事件**上，不挂每个活动。
- 不改内容层三条路线结构与节点前置关系。
- 本轮不实现综合任务模板库（synthesis template 内容包），用 planner 生成时写入量规的最小方案起步。

## 当前基线

（2026-08-20 重排本周轮验收，32/32 通过）

- 三视图：`/learn`（诊断→提案→周看板→活动抽屉→调整记录）、`/grow`（TreeMap 三色节点/相邻分支/节点详情/跳学）、`/workbench`（资源/工具/API 配置）。
- 闭环 API：`diagnostic / proposal/confirm / workspace / activities/[id]/start / activities/[id]/evidence / evidence/[id]/review / adjustments/[id]/confirm / adjustments/propose / nodes/[id]/skip / replan / reset / api-config`。
- 状态机：活动 5 态、证据 4 态、节点 3 态（`unstarted/growing/validated`）；节点事件 `beginLearning / evidenceAccepted / evidenceInvalidated`（`lib/learning/domain/state-machine.ts`）。
- 活动类型 3 种：`build_model / follow_demo / independent_practice`（`types.ts` ACTIVITY_TYPES）。
- 调整类型 3 种：`activity_replan / weekly_light / route_revision`，状态 `proposed/accepted/rejected/superseded`。
- 表结构：内容层 9 张（0004）+ 状态层 5 张（profiles 0005 / api_config 0006）；**drizzle `text(enum)` 在 SQLite 是纯 TEXT、无 CHECK 约束**——新增枚举值只需改 TS 定义，不产生迁移；新增列才需要迁移。
- 验证命令：`npm run test:domain`（42/42）、eslint 0 problems、`vinext build`、`node --test tests\*.test.mjs`（6/6）、`scripts/acceptance-replan.py`（32/32，Playwright）。
- 远程 D1 `trellis-v02-d1` 已创建（uuid `5490481c-…`）但 **num_tables=0，迁移从未应用**；本地 Miniflare D1 有完整状态。

## 数据模型改动

### 1. 综合情境任务：复用 activity，新增 subtype

**决策：复用 `LearningActivity` + 新增 `activityType = "synthesis_task"`（第 4 类活动引擎），不建新表。**

理由：活动状态机/存储/API/抽屉/周看板全部复用；`activity` 已含 `nodeId`（主节点）、`inputRefs`（资源列表）、`steps/expectedEvidence/evaluationCriteria`。独立对象需要新表 + 新状态机 + 新 API + 新 UI，是重复建设。

- `lib/learning/domain/types.ts`：`ACTIVITY_TYPES` 增加 `"synthesis_task"`。
- `db/schema.ts` `learning_activities` 新增列 `synthesis_scope text NOT NULL DEFAULT ''`（逗号分隔的 nodeIds，综合任务覆盖的节点；普通活动为空）。→ 迁移 `drizzle/0007`。
- 综合任务定位：周计划最后一个核心活动（周内综合）；planner 在"本周解锁节点 ≥2 或已有 ≥1 validated 节点"时排入 1 个；`isCore = true`。
- `inputRefs` 语义扩展：除 resourceId 外支持 `node:<nodeId>` 前缀引用节点材料（planner 写入，渲染时提示）。

**提交内容字段**：复用 `evidence`（content + externalUrl + evidenceType）。综合任务抽屉固定引导 `evidenceType = artifact | judgment`，提交结构建议三段式写入 content：结论 / 依据（引用到的节点概念）/ 边界与反例。MVP 阶段不新增结构化字段，前端引导 + 评估量规约束即可。

**评估量规**：不用单节点 criteria，planner 生成活动时写入跨节点量规到 `evaluationCriteria`（如：是否调动 ≥2 个 `synthesis_scope` 内节点概念；判断是否可复核；是否说明适用边界）。进阶方案（内容层 synthesis template 表）列为 P0 之后，不进最小集。

**结果展示**：复用抽屉评估结果区（reasons/missing/suggestedLevel）。综合任务 accepted 额外展示"能力画像已更新"提示。

**节点/能力画像影响**：综合任务证据 accepted → 主节点 `confidence` 提升（取 max）+ `supportingEvidenceIds` 追加；同时写入一条 `weekly_light` 调整记录（summary："综合任务显示你已能整合 X/Y，建议进入下一节点"）。不直接解锁新节点（解锁仍由证据驱动）。

### 2. 掌握确认：节点验证事件挂确认步骤，不新增表

**决策：证据 accepted 触发节点验证时，节点先进入 `pending_confirmation`；用户确认 → validated，用户纠正 → 保持 growing + 降级 + 补强。记录复用 `learning_adjustments`，不新增表。**

理由：调整记录本就是"路线变化均可追溯"的载体，UI 已有展示区；新增 mastery 表会重复前端展示与 ownerId 边界代码。PRD 验收第 9 条是"查看并确认或纠正一次量规评估"——挂在节点验证（growing→validated 的那一次评估）最符合语义，不要求每个活动都确认（避免推翻 42 个现有测试与现有闭环）。

- `lib/learning/domain/types.ts`：`NODE_STATUS` 增加 `"pending_confirmation"`（四色：待确认）；`ADJUSTMENT_TYPES` 增加 `"mastery_confirm"`。
- `db/schema.ts` `learning_node_progress` 新增列：`confirmation_status text NOT NULL DEFAULT 'none'`（`none | pending | confirmed | corrected`）、`confirmed_at text`。→ 迁移 `drizzle/0007`。
- 状态机（`state-machine.ts`）：新增节点事件 `{ type: "confirmMastery" }`（pending_confirmation → validated）、`{ type: "correctMastery" }`（pending_confirmation → growing）；`nodeEventOfEvidence` 在产生 validate 事件时改为返回 pending_confirmation 迁移（由调用方传入 `requiresConfirmation` 开关，默认**普通活动自动验证、综合任务/复测驱动才确认**——保持现有行为向后兼容）。
- 用户确认后的记录：写 `mastery_confirm` 调整记录（status=accepted，summary 含节点 + 证据 id 列表）。
- 用户否认/纠正后的调整建议：写 `mastery_confirm` 调整记录（status=rejected）+ `weekly_light` 补强建议（adjustmentAdvisor 增加 `userCorrection` 输入，输出生成复习/补强活动的 weekly_light 提案）；节点 confidence 降 1 级（下限 0）。

### 3. 延迟复测：节点元数据列 + 复测活动，不建日历

**决策：`learning_node_progress` 增加复测元数据；复测作为 `activityType = "retest"` 的活动出现，走现有活动闭环；呈现靠 workspace 聚合时计算 `dueReviews`，不做日历提醒。**

- `lib/learning/domain/types.ts`：`ACTIVITY_TYPES` 增加 `"retest"`。
- `db/schema.ts` `learning_node_progress` 新增列：`review_interval_days integer NOT NULL DEFAULT 14`、`next_review_at text`、`review_count integer NOT NULL DEFAULT 0`。→ 迁移 `drizzle/0007`。
- **候选**：`validated` 节点且 `next_review_at` 到期（或 `lastValidatedAt + interval` 已过）。
- **出现时机**：不靠日历。`getWorkspace` 聚合时计算 `dueReviews: [{ nodeId, nodeTitle, daysSinceValidated, nextReviewAt }]`。
- **呈现**（无日历提醒时）：
  - `/learn`：周看板顶部"复测提醒"卡（黄色描边，不计入核心承诺），点击 → `POST /api/learning/nodes/:id/retest` 生成 retest 活动并打开抽屉。
  - `/grow`：已验证节点 badge"待复测"。
- **复测失败**：证据 `needs_revision` 或评估 accepted 但用户纠正 → 节点走 `evidenceInvalidated` 事件回 `growing`、`confidence` 降 1（下限 0）、`review_count + 1`、写 `weekly_light` 调整记录（补强活动）；复测通过 → `review_count + 1`、`next_review_at` 顺延一个间隔（间隔可随通过次数翻倍：14 → 28 → 56，写入 profile 或 content 层，MVP 先固定翻倍规则）。

## API 改动

新增 2 个端点，其余复用现有闭环：

| 端点 | 语义 | 状态机 |
|---|---|---|
| `POST /api/learning/nodes/:id/confirm-mastery` | body `{ decision: "confirmed" \| "corrected", note?: string }`；确认 → validated + 写 mastery_confirm(accepted)；纠正 → growing + confidence 降级 + 写 mastery_confirm(rejected) + weekly_light 补强 | `confirmMastery` / `correctMastery` |
| `POST /api/learning/nodes/:id/retest` | 为到期节点生成 retest 活动（复用 activityComposer），返回 workspace | 活动 planned → 闭环 |

聚合改动：

- `GET /api/learning/workspace` 响应增加 `dueReviews: DueReview[]`（到期复测节点）；`nodeProgress` 项增加 `confirmationStatus / nextReviewAt / reviewCount` 字段（读模型透出）。
- 综合任务**不需要新 API**：活动闭环 + evidence 提交流全部复用现有接口；仅前端按 `activityType === "synthesis_task"` 渲染差异。

## 前端改动

- `/learn`（`app/learn/page.tsx`）：
  - 周看板支持 `synthesis_task` 卡片（徽标"综合任务"，实心核心样式，抽屉提示"整合节点：X、Y"）。
  - 顶部"复测提醒"卡（有 `dueReviews` 时显示；点击生成复测活动）。
  - 抽屉：综合任务时证据类型引导为 artifact/judgment + 三段式 placeholder；评估通过后若节点 `pending_confirmation`，显示"去成长页确认掌握"提示。
- `/grow`（`app/grow/page.tsx`）：
  - 节点四色：`pending_confirmation` 新增颜色（琥珀色）+ 图例。
  - 已验证节点 badge"待复测"（`nextReviewAt` 到期时）。
  - 节点详情区：`confirmationStatus === "pending"` 时显示"确认掌握 / 纠正"两个按钮（调 confirm-mastery）。
  - TreeMap `NODE_STATUS_TEXT` 补 pending_confirmation 文案。
- 工作台不动。

## 测试计划

领域测试（`tests/learning-domain/`）：

1. 综合任务：planner 在满足条件时排入 1 个 synthesis_task（核心）；synthesis 证据 accepted → 主节点 confidence 提升 + weekly_light 记录；不满足条件不排入。
2. 掌握确认：requiresConfirmation 节点证据 accepted → 节点 pending_confirmation（**不** validated）；confirm → validated；correct → growing + confidence 降级 + mastery_confirm(rejected) + 补强建议；普通活动仍自动 validated（回归断言）。
3. 延迟复测：到期计算（`dueReviews` 只含到期节点）；retest 活动创建走闭环；复测失败 → 节点回 growing + confidence 降级 + review_count + 1 + weekly_light；复测通过 → next_review_at 顺延 + review_count + 1。
4. 回归：现有 42 个测试全绿（重点：`evidence accepted → node validated` 断言在默认开关下不变）。

API/集成：

- 新增端点幂等、ownerId 范围、非法状态 4xx。
- `node --test tests\*.test.mjs` 6/6 保持。

浏览器验收：

- `scripts/acceptance-replan.py` 扩展或新增 `scripts/acceptance-p0.py`：诊断 → 完成活动 → 综合任务 → 确认掌握 → 复测闭环 → 重排保留，全链路断言 + 截图。

验证命令（Windows 原生命令，规避 WSL 找不到 node）：

```powershell
npm run test:domain
.\node_modules\.bin\eslint.cmd <改动文件> --ignore-pattern dist --ignore-pattern .next
.\node_modules\.bin\vinext.cmd build
node --test tests\*.test.mjs
/c/Program Files/Python314/python.exe scripts/acceptance-p0.py
```

## 实施顺序

每步独立可验证，按序推进：

1. **数据模型**：`types.ts` 枚举扩展 + `db/schema.ts` 新列 + `npm run db:generate`（0007 迁移）+ 本地 D1 应用迁移。验证：`test:domain` 回归 42/42。
2. **综合情境任务**：planner 排入规则 + 活动类型渲染 + 抽屉引导 + 评估后画像提示。验证：领域测试 + 浏览器走通一次综合任务。
3. **掌握确认**：节点 pending_confirmation + confirm-mastery API + 成长页交互 + adjustmentAdvisor 补强。验证：领域测试 + 浏览器确认/纠正两分支。
4. **延迟复测**：dueReviews 聚合 + retest API + 学习页提醒卡 + 成长页 badge + 复测失败降级。验证：领域测试 + 浏览器复测闭环。
5. **收口**：全量回归（test:domain / eslint / build / .mjs / 浏览器 P0 脚本）+ 更新 memory（handoff + session）+ 显式 `git add` + push + 双克隆同步（D 盘 + C 盘 trellis-cleanup）。

## Checkpoint

- **CP-A（第 1 步完成）**：0007 迁移本地应用成功；42/42 回归通过；build 通过。→ 停，用户检查。
- **CP-B（第 2 步完成）**：浏览器完成"诊断 → 完成 2 活动 → 综合任务 → accepted → 画像提示"；截图证据齐全。→ 停，用户检查。
- **CP-C（第 3 步完成）**：浏览器完成"确认掌握 → 节点 validated"与"纠正 → 降级 + 补强建议"两分支；调整记录可追溯。→ 停，用户检查。
- **CP-D（第 4 步完成）**：浏览器完成"复测提醒 → retest 活动 → 失败降级/通过顺延"；全量回归全绿；提交推送 + 双克隆同步。→ 停，用户验收。
- 每个 Checkpoint 由用户在本地浏览器复核截图与交互后放行，不连续开跑。

## 附：部署前 checklist（第二任务产出，见会话记录）

远程 D1 `trellis-v02-d1` 已存在（uuid `5490481c-c5a9-4423-8906-6a0d0e6e278f`），**num_tables=0 需先应用迁移**；`DATABASE_ID` 环境变量需在 build 时注入真实 uuid；`dist/server/wrangler.json` 当前为 placeholder（`00000000-…`）；`.openai/hosting.json` 已有 project_id 可复用。详见 2026-08-20 会话记录"部署前检查"。
