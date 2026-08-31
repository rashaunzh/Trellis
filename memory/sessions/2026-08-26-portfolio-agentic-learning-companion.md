---
id: session-2026-08-26-portfolio-agentic-learning-companion
status: completed
created_at: 2026-08-26
scope: product/engineering
---

# 作品级 Agentic Learning Companion 第一切片

## 背景

用户确认 Trellis 作品目标不能只是小 MVP 或几块积木，而要达到甚至超过 EchoMind 参考项目的工程完整度，同时体现更强产品原创：Learning Situation-first dynamic learning adaptation。

## 已完成

- 安装 `@mastra/core`，并显式安装 `zod` 用于 Mastra workflow schema。
- 新增真实 Mastra workflow：`trellisLearningSituationWorkflow`，使用 `createWorkflow/createStep` 包装核心链路。
- 扩展 `LearningSituation`：
  - `capacityState`
  - `energyState`
  - `behaviorPattern`
  - `evidenceQuality`
  - `nextBestMove`
- 新增阶段路径模块：
  - `StagePath`
  - 8 周 AI PM 转型启动阶段路径
  - 最终成果：AI Agent 产品 PRD 或 AI 产品案例拆解报告
- 新增前三周动态模拟：
  - 资料错配
  - 容量下降
  - 精力低
  - 证据失败
  - 作品推进
- 新增学习质量监控读模型：
  - 计划完成率
  - 证据通过率
  - 资料误配
  - 反复缺口
  - fallback
- 新增作品级 eval report：
  - situation decision
  - material fit
  - stage path
  - dynamic adjustment
  - artifact loop
- 新增 API：
  - `GET /api/learning/quality`
  - `POST /api/learning/eval`
- 新增产品文档：`docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`

## 验证

- `npx tsc --noEmit --incremental false`：通过
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：182/182 通过

## 下一步

1. 跑 eslint。
2. 把 `/learn` 前端展示升级为作品级读模型：Learning Situation、Stage Path、Dynamic Simulation、Quality/Eval。
3. 增加 Mastra Studio 运行指南和本地启动脚本，确认 Studio 能看到 workflow。
4. 将 artifact loop 从 transient analysis 推进到可提交作品证据的正式活动链。
