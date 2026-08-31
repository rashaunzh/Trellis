# 2026-08-27：Mastra Workflow 可运行化与作品级演示闭环

## 本次目标

让 Trellis 的 Agentic Learning Companion 不只停留在页面展示，而是能通过 Mastra workflow runtime 跑出固定 trace，并补齐作品集演示脚本和工程 runbook。

## 已完成

- 确认本仓库当前安装的是 `@mastra/core@1.62.0`，没有本地 Mastra CLI / Studio bin。
- `lib/learning/agents/mastra-workflow.ts` 新增：
  - `WorkflowPayload` export；
  - `trellisPortfolioDemoInput`；
  - `runTrellisMastraWorkflowDemo()`。
- 新增 `scripts/trellis-mastra-demo.mjs`。
- `package.json` 新增 `npm run demo:mastra`。
- 新增工程 runbook：`docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`。
- 新增作品集讲稿：`docs/product/TRELLIS_PORTFOLIO_DEMO_SCRIPT.md`。
- 更新作品级目标文档，明确：
  - UI demo surface 已完成；
  - Mastra workflow demo 可运行；
  - Studio CLI 尚未接入；
  - artifact loop 尚未正式沉入活动链。
- `tests/learning-domain/portfolio-orchestration.test.ts` 新增真实 workflow demo 测试。

## 验证

- `npm run demo:mastra` 通过，输出 5 步 workflowTrace、2 个 HITL steps、8 周 stagePath、4 次 dynamic adjustments、`fallbackMode=rule`。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 183/183 通过。
- `npx tsc --noEmit --incremental false` 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `http://127.0.0.1:5174/learn` 返回 200。
- `/api/learning/eval` 返回 5/5 通过，avgScore 0.88。

## 边界

- 本轮不宣称 Mastra Studio 已完成，因为仓库没有 CLI / Studio bin。
- 本轮不改正式学习数据流。
- Artifact loop 仍是下一轮风险更高的正式链路工作。

## 下一步建议

下一轮做 Artifact Loop 正式活动链：让 StagePath 的 Week 3/5 作品目标真正生成 integrated_task，作品 evidence 进入评审、掌握确认和 quality monitor。
