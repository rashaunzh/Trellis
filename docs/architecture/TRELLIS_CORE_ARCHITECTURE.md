# Trellis Core Architecture

> 状态：作品级架构基线
> 日期：2026-08-27

## 定位

Trellis Core Architecture 的目标不是把学习产品做成多 Agent 聊天，而是把学习过程建模成可解释、可确认、可评估的 agentic workflow。

核心分层：

```text
UI / API
-> LearningApplicationService
-> TrellisCoreKernel
-> Trellis Tool Registry
-> Domain Agents / Rules
-> Persistence / Read Models
```

## Trellis Core Kernel

`TrellisCoreKernel` 是领域判断入口。它聚合现有规则能力和 tools，输出结构化 `KernelDecision`，但不直接写数据库。

Kernel 当前承担：

- diagnostic trace；
- artifact task decision；
- next stage decision；
- learning memory snapshot 聚合。

写入仍由 `LearningApplicationService` 控制，保持 HITL 和 store 边界。

下一阶段行动视图 `NextStagePlan` 由已采纳的作品级 `route_revision` 聚合生成，不新增表，也不清空原作品证据。

## Agentic 边界

- 高风险变更只能生成 proposed adjustment。
- hard evidence 才能推动 mastery。
- soft signal 只影响下一步判断。
- Mastra 负责 workflow runtime demo，不替代 domain engine。

## 当前非目标

- 不新增 DB schema。
- 不接外部 MCP tool ecosystem。
- 不引入多 Agent 角色群。
- 不宣称完整 autonomous agent runtime。
