# Trellis Decision Trace

> 状态：作品级可解释性模型
> 日期：2026-08-27

## 目标

Decision Trace 解释 Trellis 每次判断为什么发生：

```text
输入 -> 信号 -> 工具步骤 -> 决策 -> HITL -> 状态变更
```

## Trace 字段

`LearningDecisionTrace` 包含：

- `traceId`
- `trigger`
- `inputs`
- `signals`
- `steps`
- `decision`
- `stateChanges`

触发类型包括：

- diagnostic
- material_review
- stage_planning
- dynamic_adjustment
- artifact_task
- evidence_review
- mastery_confirmation
- next_stage

## 当前接入点

- `runDiagnostic().analysis.decisionTrace`
- artifact task decision
- next stage decision
- Mastra workflow trace

## 价值

Trace 让 Trellis 能回答：

- 系统用了哪些信号？
- 哪些步骤由工具执行？
- 哪里需要 human-in-the-loop？
- 哪些状态被 proposed / created / accepted？
