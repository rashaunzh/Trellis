# 2026-08-27：Next Stage Rubric 与浏览器验收

## 背景

用户要求继续做浏览器验收，并补齐下一阶段正式活动的 rubric。上一轮已把 `NextStagePlan` 的作品包装、评测深化、项目讲述三个模块转成正式学习活动；本轮目标是让这些活动不仅可执行，还能以作品级标准被评审和截图展示。

## 本轮完成

- `NextStagePlan.modules` 新增 `rubric` 字段。
- 三个下一阶段模块分别补齐作品级 rubric：
  - 作品包装：读者可理解性、domain engine / Mastra workflow 边界、Learning Situation-first 与 Evidence Review 截图证据。
  - 评测深化：eval 覆盖面、失败/回退案例、产品质量/学习质量/runtime fallback 指标区分。
  - 项目讲述：10-15 分钟讲清问题洞察、核心机制、动态 demo、eval 结果和边界。
- `createNextStageActivities()` 将 rubric 写入正式活动的 `steps`、`expectedEvidence` 和 `evaluationCriteria`。
- `/learn` 的 Next Stage 模块卡片展示 rubric；本周看板中的三条下一阶段活动也继承同一套评审标准。
- 新增无依赖浏览器验收脚本 `scripts/acceptance-next-stage-rubric.mjs`，并在 `package.json` 暴露为 `npm run acceptance:next-stage`。
- 浏览器验收脚本会准备固定 demo 状态，打开 `/learn` 检查 Next Stage 面板、3 个正式活动、rubric 文案、framework overlay 和浏览器异常，并保存截图 `docs/learn-next-stage-rubric.png`。
- 更新作品级产品文档与 Mastra workflow runbook。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `npm run acceptance:next-stage` 通过。
- 截图人工检查通过：`docs/learn-next-stage-rubric.png` 中 Next Stage、rubric、质量面板、本周正式活动均可读，无明显重叠。

## 当前边界

- Rubric 目前通过活动字段进入 Evidence Review 语境，但规则 evaluator 仍主要基于能力信号/文本覆盖评分；尚未做“作品包装专用 evaluator”。
- 下一阶段活动仍挂当前周计划，不新增阶段版本表。
- 浏览器验收使用本机 Chrome/Edge headless + CDP；不依赖 Playwright。

## 准确下一步

1. 如果继续产品闭环：让 Evidence Review 对下一阶段 rubric 做更明确的维度评分。
2. 如果继续工程展示：启动 Mastra Studio 或补 workflow trace 截图，增强 runtime 可视化。
3. 如果继续作品交付：整理 README / 技术亮点 / demo script，使 `docs/learn-next-stage-rubric.png` 成为作品集截图之一。
