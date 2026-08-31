# 2026-08-27：Core Architecture 五阶段主梁实现

## 背景

用户要求不要继续做小切片，而是实现五个阶段的作品级架构计划，让 Trellis 的技术厚度接近 EchoMind / Elis 这类可展示项目，同时保持 Trellis 的原创主线：Learning Situation-first dynamic learning adaptation。

## 本轮完成

- 新增 `TrellisCoreKernel`：作为领域判断入口，聚合现有规则引擎和内部 tools，输出结构化 `KernelDecision`，但不直接写持久状态。
- 新增 `Decision Trace`：统一记录 trigger、inputs、signals、steps、HITL 和 stateChanges，让系统能解释每次判断为什么发生。
- 新增 `Learning Memory Snapshot`：把 hard evidence、soft signal、behavior、material、artifact、decision memory 聚合为可读模型。
- 新增内部 `Trellis Tool Registry`：标准化 10 个核心 tools，供 Kernel / Mastra workflow 调用。
- Mastra workflow demo 从 5 步扩展为 10 步，覆盖 `assessSituation -> auditMaterials -> mapCapabilities -> planStagePath -> simulateDynamicAdjustment -> createArtifactTask -> reviewArtifactEvidence -> waitForMasteryConfirmation -> proposeNextStage -> summarizeQuality`。
- 新增 `/api/learning/memory`，前端 `/learn` 质量面板展示 memory、trace completeness、tool registry 和 workflow readiness。
- `LearningQualityMonitor` 扩展作品任务、作品证据、下一阶段建议、trace/memory/tool/workflow readiness 指标。
- 新增架构文档：
  - `docs/architecture/TRELLIS_CORE_ARCHITECTURE.md`
  - `docs/architecture/TRELLIS_DECISION_TRACE.md`
  - `docs/architecture/TRELLIS_LEARNING_MEMORY_MODEL.md`
  - `docs/engineering/TRELLIS_TOOL_LAYER.md`
- 更新作品级定位文档和 Mastra runbook，明确当前完成与边界。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `npm run demo:mastra` 通过，输出 10-step workflow trace、HITL steps、stagePath、dynamicSimulation、artifactTask、evidenceReview、masteryConfirmation、nextStageProposal、qualitySummary。
- 本地 HTTP 验证：
  - `/learn` 200。
  - `/api/learning/quality` 200。
  - `/api/learning/memory` 200。
  - `/api/learning/eval` POST 200，passRate 1，10/10。

## 当前边界

- 当前 tools 是内部工具层，不是 MCP server，不接外部工具权限。
- Learning Memory 是聚合读模型，不是向量库或跨会话智能检索。
- Mastra 当前是 workflow runtime demo；没有 Mastra CLI / Studio 本地截图，不宣称 Studio 已完成。
- 下一阶段 route_revision 仍是 proposed，采纳后的下一阶段计划产品化尚未完成。

## 准确下一步

1. 把 `route_revision proposed` 的采纳结果产品化：生成下一阶段行动视图或下一阶段 StagePath。
2. 做浏览器截图级验收，确认 `/learn` 的 memory / quality / eval / artifact loop 没有布局问题。
3. 再评估是否接入 Mastra Studio、MCP tool ecosystem 或 Vercel/Cloudflare 生产观测；接入前先确认作品集收益大于复杂度。
