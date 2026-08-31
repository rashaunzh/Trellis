# 2026-08-29 Trellis 日用 2.0 三周闭环

## 背景

用户确认“日用 2.0：5-6 轮功能完善计划”，目标从作品级展示转向自己可以连续几周真实使用。执行范围优先覆盖周切换、计划历史、周复盘归档、用户材料进入活动、证据修订、三周端到端验收和文档同步。

## 已完成

- `workspace` 支持 `weekKey` 参数；不传保持默认当前周。
- 新增 `weeklyPlanHistory` 读模型，汇总每周活动数、完成数、accepted evidence 数、当前/未来标记和复盘状态。
- 新增 `learning_week_reviews` 存储、D1/InMemory store 方法、D1 migration `drizzle/0012_week_reviews.sql` 和 `db/schema.ts` 表定义。
- `/api/learning/week-review` 支持指定 `weekKey`，可只归档/更新复盘，也可基于复盘生成下一周计划。
- 生成下周计划后返回新周 workspace；旧周证据、活动状态和作品版本保留。
- 用户资源映射节点后会进入当前和后续同节点活动，覆盖首周计划、作品任务、补强活动、跳学验证、复测和下一阶段活动等生成路径。
- `/learn` 增加计划历史切换器、周复盘归档/生成下周按钮；活动抽屉展示系统资源和用户资源；质量/eval/Mastra runtime 折叠为“系统状态”。
- `/workbench` 展示用户资源是否已进入本周活动或等待后续编排。
- 新增 `npm run acceptance:three-week-loop`，覆盖诊断、首周计划、用户材料映射、短证据退回、修订通过、周复盘归档、第 2/3 周生成、周历史读取和浏览器渲染。
- 新增产品状态文档 `docs/product/TRELLIS_DAILY_USABLE_2_0.md`。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `npm run lint` 通过。
- `npm run build` 通过；仅有依赖 `gray-matter` direct eval 与 Vinext 路由分类提示。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过：196/196。
- `node --test tests/*.test.mjs` 通过：6/6。
- `npm run acceptance:three-week-loop` 通过，并保存：
  - `docs/acceptance-three-week-learn.png`
  - `docs/acceptance-three-week-review-history.png`
  - `docs/acceptance-three-week-artifact-loop.png`

## 参考判断

- `mattpocock/skills` 适合作为 Trellis 后续“学习技能包/复盘技能/证据评审技能”的设计参考：共享语言、小型可组合工作流、TDD 和诊断反馈回路。
- `tt-a1i/archify` 适合工程架构、工作流、数据流和生命周期图；面向产品功能架构和用户旅程的图，仍建议用 draw.io 表达。

## 开放问题

- 跨周 action API（start/evidence/review）能写入正确活动，但部分响应仍默认返回当前自然周 workspace；前端可通过 `weekKey` 读取规避，后续应统一返回活动所属周 workspace。
- `currentWeekKey`/`nextWeekKey` 仍是简化周键逻辑，后续可靠性轮次可改成完整 ISO 周处理。
- `db/schema.ts` 中 `learningActivities.activityType` enum 仍是旧三类，SQLite 不强制但类型表达落后；后续可单独整理。
- 远程 D1 若要部署，需要应用 `0012_week_reviews.sql`。

## 下一步

1. 把跨周 action API 响应统一成活动所属周 workspace，并补 API 测试。
2. 做第 4 轮 Evidence Review 修订体验细化：按概念/示范/实践/作品/复测/反思展示不同评审重点。
3. 用 draw.io 画产品功能架构和用户旅程；用 Archify 画工程运行时/数据流图。
