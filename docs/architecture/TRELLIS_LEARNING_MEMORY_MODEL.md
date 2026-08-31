# Trellis Learning Memory Model

> 状态：聚合读模型
> 日期：2026-08-27

## 目标

Learning Memory 不是向量数据库，也不是聊天历史。它是 Trellis 对学习状态的结构化记忆视图。

## Memory 分类

`LearningMemorySnapshot` 包含：

- `hardEvidenceMemory`：accepted evidence，能支持 mastery。
- `softSignalMemory`：自评、困惑、反思，只影响 next move。
- `behaviorMemory`：低完成率、输入偏重、容量变化等节奏信号。
- `materialMemory`：资料 fit verdict 与理由。
- `artifactMemory`：作品任务、证据、mastery 状态和里程碑。
- `decisionMemory`：调整提案、采纳、拒绝记录。

## API

```text
GET /api/learning/memory
```

返回当前 owner 的 memory snapshot，不新增表，基于现有 workspace 聚合。

## 边界

- soft signal 不推动 `validated`。
- behavior signal 只影响节奏和粒度。
- decision memory 记录提案状态，不自动改路线。
