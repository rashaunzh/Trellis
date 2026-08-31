# 2026-08-27：Next Stage Adoption Runtime

## 背景

用户要求实现上一轮计划：采纳作品闭环产生的 `route_revision proposed` 后，不再只是把调整建议标记为 accepted，而是进入可见的下一阶段行动视图。

## 本轮完成

- 新增 `lib/learning/agents/next-stage-planner.ts`：
  - `NextStagePlan`
  - `isPortfolioNextStageAdjustment`
  - `buildPortfolioNextStagePlan`
- `LearningApplicationService.getWorkspace()` 现在会从已采纳的作品级 `route_revision` 聚合生成 `nextStagePlan`。
- `confirmAdjustment()` 在采纳作品级下一阶段建议时，会把 summary 标记为“已进入作品集包装阶段”。
- `LearningQualityMonitor` 新增 `nextStagePlanExists`，用于展示闭环是否已经进入下一阶段。
- `/learn` 阶段作品闭环区新增 Next Stage 行动视图：
  - AI PM 作品集包装阶段；
  - 作品包装；
  - 评测深化；
  - 项目讲述；
  - 继承原作品 accepted hard evidence 和 mastery confirmation。
- 普通手动 `route_revision` 保持原行为，不生成 NextStagePlan。
- 更新作品级产品文档、Mastra runbook 和核心架构文档。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `npm run demo:mastra` 通过。
- 本地 HTTP：
  - `GET /learn` 200。
  - `GET /api/learning/quality` 200。
  - `GET /api/learning/memory` 200。
  - `POST /api/learning/eval` 200，10/10。

## 当前边界

- `NextStagePlan` 是聚合读模型，不新增 DB 表。
- 本轮不做多阶段版本管理，不做多轮作品迭代。
- 本轮不接 Mastra Studio、不接 MCP、不做外部工具生态。

## 准确下一步

1. 做浏览器截图级验收，确认采纳下一阶段后 `/learn` 的新面板在桌面/移动端不重叠。
2. 若要继续补厚工程展示，下一步可接 Mastra Studio 或做 workflow trace UI。
3. 若要继续补产品闭环，下一步可把 NextStagePlan 的三个模块转成正式活动。
