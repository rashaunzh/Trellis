# 2026-08-27：NextStagePlan 正式活动化

## 背景

用户确认先接 Mastra Studio/CLI，再继续产品闭环。本轮回到产品闭环：把 `NextStagePlan` 的三个模块转成正式学习活动，而不是只停留在读模型展示。

## 本轮完成

- `confirmAdjustment()` 采纳作品级 `route_revision` 后，会调用 `createNextStageActivities()`。
- `createNextStageActivities()` 基于已采纳的 `NextStagePlan` 生成三个正式活动：
  - `下一阶段：作品包装`
  - `下一阶段：评测深化`
  - `下一阶段：项目讲述`
- 三个活动挂在当前周计划，均为 core activity，继承原作品 evidence / mastery confirmation 语义。
- 活动继续复用 Trellis 现有活动与证据闭环：planned -> start -> evidence -> review。
- `/learn` 的 Next Stage 面板会显示“已生成 3 个正式活动 / 进入本周看板”。
- 普通手动 `route_revision` 仍保持原行为，不生成下一阶段活动。
- 更新作品级目标文档与 Mastra runbook。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- focused tests：`portfolio-orchestration.test.ts` + `api-loop.test.ts` 33/33 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- runtime API 仍正常：steps=10，HITL=5。

## 当前边界

- 下一阶段活动当前生成在当前周计划中，不新增阶段版本表。
- 三个活动是正式活动，但还没有单独的 NextStage API 或多轮作品版本管理。
- 证据评审仍按现有 evaluator 和状态机走，未新增作品包装专用评审器。

## 准确下一步

1. 做浏览器截图级验收，确认下一阶段面板和三条活动在 `/learn` 上可读。
2. 如果继续产品闭环：为三个下一阶段活动补更专门的 evidence rubric。
3. 如果继续工程展示：启动 Mastra Studio 并截图 workflow graph。
