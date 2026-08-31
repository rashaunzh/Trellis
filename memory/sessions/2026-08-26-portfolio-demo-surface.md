# 2026-08-26：作品级 Demo Surface

## 本次目标

把第一切片已完成的作品级后端能力露到 `/learn`，让 Trellis 看起来不再只是普通学习计划工具，而是 Learning Situation-first 的动态学习伙伴。

## 已完成

- `/learn` 入口文案改为 Learning Situation-first：先识别目标、资料、能力、容量、精力、行为风险和证据质量，再规划阶段路径。
- 诊断提案页新增处境详情：目标清晰度、资料状态、能力状态、时间容量、精力状态、行为模式、证据质量、时间压力、active risks、nextBestMove。
- 诊断提案页展示完整 8 周 `StagePath`：阶段目标、里程碑数量、最终作品、每周目标和证据要求。
- 诊断提案页展示前三周 `DynamicSprintSimulation`：触发事件、调整前后、是否需要确认、trace。
- 已确认学习页新增作品级质量面板：`/api/learning/quality` 指标和 `/api/learning/eval` 按钮。
- `lib/learning/frontend.ts` 新增 `fetchLearningQuality()` 与 `runPortfolioEval()`。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 182/182 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- 本地 dev server：`http://127.0.0.1:5174/learn` 返回 200。
- API 验证：
  - diagnostic 返回 `primaryNeed=review_material`、8 周阶段路径、4 次动态调整、最终作品 `AI Agent 产品 PRD 或 AI 产品案例拆解报告`。
  - eval 返回 `passRate=1`、`passed=5/5`、`avgScore=0.88`。
  - quality 返回可读指标，当前 demo owner 有 1 个资料错配，fallbackMode 为 true。

## 未完成

- 浏览器 MCP 未连接，Chrome DevTools 未开 debug 端口，因此没有完成真实截图级视觉验收。
- Mastra Studio 运行指南和 artifact loop 正式活动链尚未做。

## 下一步建议

下一轮做 Mastra Studio / workflow 可视化与 demo script：把当前 workflow 运行方式、HITL 节点、fallback 边界写清楚，并准备 10-15 分钟作品集讲解脚本。
