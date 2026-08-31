# Trellis Tool Layer

> 状态：内部工具层标准化
> 日期：2026-08-27

## 目标

Tool Layer 把现有规则能力标准化成可注册、可追踪、可由 Kernel / Mastra 调用的内部 tools。

## Tool Interface

每个 tool 具备：

- `id`
- `name`
- `description`
- `inputSchema`
- `outputSchema`
- `run(input)`

## 当前 Tools

- `assessSituationTool`
- `reviewMaterialsTool`
- `mapCapabilitiesTool`
- `planStagePathTool`
- `simulateDynamicSprintTool`
- `generateArtifactTaskTool`
- `reviewEvidenceTool`
- `proposeAdjustmentTool`
- `summarizeLearningQualityTool`
- `buildLearningMemoryTool`

## 边界

当前 tools 是内部工具层，不是 MCP server，不做外部权限和联网工具调用。这样能先稳定 agentic architecture，再决定是否接外部 tool ecosystem。
