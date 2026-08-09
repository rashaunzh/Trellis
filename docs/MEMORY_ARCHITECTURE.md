# Trellis 记忆架构（V0.1）

## 目标

让用户在两台电脑、不同 AI 工具和不同会话之间继续同一项工作，不依赖某个聊天产品是否同步历史。当前把程序与记忆放在同一个私有 Git 仓库中。

## 记忆分层

| 层 | 位置 | 内容 | 更新频率 |
|---|---|---|---|
| 稳定身份与偏好 | `memory/profile/` | 时间习惯、任务偏好、工具边界 | 很低 |
| 路线记忆 | `memory/routes/` | 四条主线、阶段、能力节点、资源 | 低 |
| 决策记忆 | `memory/decisions/` | 已确认选择及理由 | 中 |
| 会话记忆 | `memory/sessions/` | 一次讨论的摘要、提案与结果 | 高 |
| 当前接力 | `memory/handoff/current.md` | 当前状态、下一步、阻塞、入口链接 | 每次会话结束 |
| 概念与证据索引 | `memory/concepts/`、`memory/evidence/` | 闪卡和成果链接 | 按需 |

数据库继续承载应用运行状态；Markdown/YAML 是可读、可审计、可迁移的长期记忆。V0.1 不要求两者自动双向同步。

## 会话协议

开始会话时：

1. 拉取最新分支。
2. 阅读 `AGENTS.md`。
3. 阅读 `memory/handoff/current.md`。
4. 按任务需要读取偏好、路线与相关决策；不要无差别加载全部历史。
5. 复述当前目标、重要限制与准备执行的下一步。

结束会话时：

1. 把本次摘要写入一个新的 session 文件。
2. 把已确认且长期有效的选择写入 decision 或 route/profile。
3. 把未确认修改保留为 proposal，不冒充用户决定。
4. 覆盖更新 `handoff/current.md`。
5. 提交并推送，使另一台电脑可以继续。

## 写入状态

```text
外部对话/页面
   ↓ 摘要
候选记忆（proposal）
   ↓ 用户确认
正式记忆（confirmed）
   ↓ 后续使用发现过时
废弃但保留历史（superseded）
```

每条重要记忆应尽量包含：

- `id`
- `status: proposal | confirmed | superseded`
- `created_at` / `updated_at`
- `source`（链接或 session）
- `scope`（profile / route / decision / task / concept / evidence）
- `summary`
- `rationale`
- `supersedes`（如适用）

## 外部 AI 对话如何沉淀

当前不要求 NotebookLM、Gemini 或 ChatGPT 都提供 MCP：

1. 在外部工具完成阅读或讨论。
2. 分享页面链接；若工具无法读取，就粘贴/导出关键片段。
3. AI 生成结构化摘要：问题、结论、分歧、证据、下一步、来源。
4. Trellis 保存摘要和链接，不保存无价值的完整聊天副本。
5. 需要修改路线或任务时，先写提案，确认后再更新正式文件。

未来 MCP 最小工具面：

- `get_context(object_id)`
- `list_next_tasks(line, horizon)`
- `propose_change(target, patch, rationale, sources)`
- `confirm_proposal(proposal_id)`
- `append_session(summary, links)`
- `record_evidence(task_id, evidence)`

## 多电脑同步

- 会话前 `git pull --rebase`，会话后 commit + push。
- session、decision 使用“一次一文件”降低冲突。
- `handoff/current.md` 是唯一高频覆盖文件；冲突时人工合并语义，不机械覆盖。
- 代码改动和记忆改动尽量分 commit。
- 不把未提交状态当作可跨电脑记忆。

## 隐私与恢复

- 仓库必须保持 private。
- 禁止提交 API key、cookie、token、公司机密、受限 JD 数据或原始私密聊天。
- 使用链接时标明访问权限；敏感原文留在来源系统。
- Git 历史不会因为普通删除而真正消失，因此“未来可能要彻底删除”的内容从一开始就不进入仓库。
- 未来若数据量或权限模型需要升级，再把运行状态迁移到远端 D1/Postgres；Markdown 记忆格式保持可导出。
