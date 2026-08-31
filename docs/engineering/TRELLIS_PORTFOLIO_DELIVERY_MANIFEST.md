# Trellis Portfolio Delivery Manifest

> 状态：作品级交付清单
> 日期：2026-08-28
> 用途：给 coding agent、作品集评审者或后续维护者一个最短入口，判断 Trellis 当前能展示什么、如何运行、哪些内容不能公开。

## 1. 产品交付目标

Trellis 当前交付目标不是普通学习计划工具，而是：

> Learning Situation-first Agentic Learning Companion：先识别学习者处境，再评估资料适配、校准目标、规划完整阶段路径，并在时间、精力、行为、资料和证据变化时动态调整，最终导向可评审 AI PM 作品。

当前固定作品集场景：

- 用户：AI PM 转型小白；
- 阶段：AI PM 转型启动阶段；
- 路径：6-8 周 StagePath；
- 演示：前三周 DynamicSimulation；
- 作品：AI Agent 产品 PRD v1；
- 质量证明：Evidence Review、rubric guardrail、Quality Monitor、Eval、Mastra runtime trace。

## 2. 可运行入口

```bash
npm run dev
npm run demo:mastra
npm run acceptance:portfolio
npm run release:check
```

浏览器入口：

- `/learn`：作品级 demo surface；
- `GET /api/learning/quality`：质量监控；
- `POST /api/learning/eval`：12 项 eval；
- `GET /api/learning/artifact`：作品迭代读模型；
- `GET /api/learning/mastra-runtime`：runtime 注册状态；
- `POST /api/learning/mastra-runtime`：运行固定 Mastra workflow demo。

`/learn` 当前入口不是空白 goal-first 表单，而是作品级 intake：

- 选择 AI PM 作品方向；
- 选择最终成果类型；
- 设置每周时间、当前基础和精力状态；
- 带入资料并进入 Material Fit；
- 默认用 `adaptive_existing_content` 生成阶段路径。

## 3. 当前 Runtime 能力

Mastra 承载 workflow runtime / Studio 展示层：

- `trellisLearningSituationWorkflow`：10 步 workflow；
- `trellisMastraRuntime`：注册 workflow；
- `runTrellisMastraWorkflowDemo`：可运行固定 demo；
- runtime report 已包含：
  - `runId` / `traceId`；
  - `workflowTrace`；
  - `stepOutputs`；
  - `hitlCheckpoints`；
  - `resumeContract`；
  - `runtimeReadiness`；
  - `stagePath`；
  - `dynamicSimulation`；
  - `qualitySummary`。

Trellis domain engine 承载核心判断：

- Learning Situation；
- Material Review；
- Capability Map；
- StagePath；
- DynamicSimulation；
- Evidence-to-Mastery；
- Artifact iteration；
- NextStagePlan；
- Quality / Eval fallback。

## 4. 当前可截图证据

- `docs/acceptance-portfolio-stage-path.png`：Learning Situation + StagePath + DynamicSimulation。
- `docs/acceptance-portfolio-next-stage.png`：NextStagePlan + Quality + Eval + Mastra runtime panel。
- `docs/learn-next-stage-rubric.png`：下一阶段正式活动 rubric。
- `docs/mastra-studio-*.png`：Mastra Studio 辅助截图素材，发布前可复跑更新。

## 5. 必须通过的验收

```bash
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
npm run lint
npm run acceptance:portfolio
npm run release:check
```

当前作品级验收口径：

- domain tests：190/190；
- eval：12/12；
- portfolio acceptance：覆盖 `/learn`、artifact API、quality、eval、Mastra runtime trace；
- release check：公开候选文件敏感命中为 0。

## 6. 分发边界

可以公开：

- `app/`
- `lib/`
- `src/mastra/`
- `tests/`
- `scripts/`
- `docs/product/`
- `docs/architecture/`
- `docs/engineering/`
- 根目录工程配置和 README。

不要公开：

- `memory/`
- `.wrangler/`
- `.mastra/`
- `.next/`
- `.sites-runtime/`
- `dist/`
- `node_modules/`
- 浏览器自动化临时目录。

注意：`memory/handoff/current.md` 此前有无效 UTF-8 风险，发布包必须排除 `memory/`。

## 7. 不能夸大的内容

- 不是完整 autonomous agent。
- 不是商业化学习平台。
- 不是外部 MCP tool ecosystem。
- Mastra runtime 当前是作品级 workflow runtime / report / Studio 展示入口，不是完整 durable production orchestration。
- Learning Memory 当前是聚合读模型，不是向量长期记忆。
- Artifact loop 已有正式闭环切片，但还没有完整多阶段 artifact version 数据模型。

## 8. 下一阶段开发入口

Phase 3 继续方向：

- 把 runtime report 持久化为正式 run history；
- 将 HITL checkpoint 和 Trellis adjustment/mastery API 建立更强 resume 对应；
- 将 Mastra Studio 截图更新成当前 10-step workflow；
- 加入失败 run、fallback run、人工拒绝 run 的对比样例。

Phase 4 继续方向：

- 从当前 manifest 生成公开发布包；
- 补最终架构图和 10-15 分钟演示材料；
- 清理公开分支历史，确保不带 `memory/`；
- 给其他 coding agent 按模块分发收尾任务。
