# 2026-08-27：Mastra Runtime API 与 UI 展示

## 背景

用户要求下一步做 Mastra runtime。此前 Trellis 已有 `trellisLearningSituationWorkflow` 和 `npm run demo:mastra`，但运行入口仍偏命令行，`/learn` 不能直接展示 runtime trace。

## 本轮完成

- 在 `lib/learning/agents/mastra-workflow.ts` 中新增 `trellisMastraRuntime`：
  - 使用 `new Mastra({ workflows: { trellisLearningSituationWorkflow } })` 注册 workflow；
  - `runTrellisMastraWorkflowDemo()` 改为通过 `trellisMastraRuntime.getWorkflow(...).createRun()` 运行。
- 新增 `app/api/learning/mastra-runtime/route.ts`：
  - `GET` 返回 runtime 注册状态、workflow id、step count、HITL count 和 Studio 边界；
  - `POST` 运行固定作品级 workflow demo，返回 runId、traceId、workflowTrace、hitlSteps、stagePath、dynamicSimulation、qualitySummary。
- `/learn` 的作品级质量面板新增“运行 Mastra runtime”按钮，并展示：
  - runId / traceId；
  - 10-step workflow trace；
  - 5 个 HITL 节点；
  - fallbackMode；
  - StagePath 周期。
- 更新 Mastra runbook 和作品级目标文档，明确当前是 runtime/API/UI 可运行，不宣称 Studio 完成。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- focused tests：`portfolio-orchestration.test.ts` + `core-architecture.test.ts` 14/14 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `GET /api/learning/mastra-runtime` 200，`hitlCount=5`，`stepCount=10`。
- `POST /api/learning/mastra-runtime` 200，`status=success`，`steps=10`，`hitl=5`，`fallback=rule`。

## 当前边界

- 当前没有 Mastra CLI / Studio bin；Studio 截图仍未完成。
- Runtime demo 使用固定作品级 payload，不写正式学习状态。
- 正式状态仍由 Trellis service / D1 控制，Mastra runtime 负责工作流展示与可运行 trace。

## 准确下一步

1. 做浏览器截图级验收，确认 `/learn` runtime trace 面板在桌面/移动端可读。
2. 若继续补 Mastra：安装/接入 Mastra CLI 或 Studio server，拿到真正 workflow graph 截图。
3. 若继续补产品：把 NextStagePlan 三个模块转成正式活动。
