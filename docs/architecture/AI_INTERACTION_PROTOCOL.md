# Trellis AI 交互协议

## 基本判断

Trellis 不绑定一个“总模型”。用户继续在最合适的工具中工作，Trellis 提供统一上下文和可确认的记忆写入。V0.1 使用仓库文件即可，不需要微调，也不要求购买 API。

## 上下文包

与 AI 讨论任务、阶段、项目或概念时，只发送完成当前工作所需的最小上下文：

```yaml
object:
  id: G-LLM-01
  type: task
  title: 完成 Notebook 测评
route:
  line: G
  stage: LLM 应用工程
  order: 5
reason: 验证资料问答、引用与输出链路
prerequisites: []
budget_stars: 2
completion:
  - 测评报告链接
  - 三条结论
sources: []
related_decisions: []
user_question: ""
```

不应默认把整个仓库、全部聊天或全部知识库交给模型。

## 讨论入口

“与 AI 讨论”作为对象操作出现：

- 为什么现在做这项任务？
- 它和前后阶段有什么关系？
- 帮我把它拆成一个能立即开始的小任务。
- 根据当前证据判断是否完成。
- 我卡住了，给出三个不同成本的下一步。
- 总结这次外部讨论，并提出需要更新的路线/任务。
- 把概念生成闪卡草稿，并附官方来源。

## 输出契约

AI 输出分三块：

1. **回答**：直接解决当前问题。
2. **依据**：引用当前路线、用户偏好、证据或外部来源。
3. **提案**：任何可能改变系统状态的内容，使用结构化 patch。

```yaml
proposal:
  id: proposal-2026-08-07-001
  target: memory/routes/learning.yaml
  operation: update
  rationale: "完成 Python 基础后，下一步应先做可评价的 ML 项目"
  changes: []
  sources: []
  status: proposal
```

用户确认前，提案不能写成 `confirmed`。

## 模型与工具选择

- 基于给定资料的问答、引用核查：NotebookLM / Gemini。
- 开放式讨论、解释、方案比较：ChatGPT 或 Gemini。
- 仓库、代码、自动化和记忆文件：Codex。
- 批量剪藏与分类：Hermes / Obsidian 流程。
- 低价值整理优先使用免费额度或本地模型；高价值综合推理才考虑付费模型。
- 模型选择是可替换配置，不写进核心数据结构。

## 页面共享与来源

如果 AI 能读取共享页面：保存页面 URL、访问日期和提炼结论。如果不能读取：提供关键选段或导出文件。所有“官方解释”概念卡应优先引用官方文档、论文或教材，并把来源链接保存到卡片。

## 失败与冲突

- 来源不足：明确标记未知，不补写成事实。
- 新建议与已确认决策冲突：展示冲突并生成替代提案，不静默覆盖。
- 多模型结论不同：保存各自依据，由用户确认决策。
- 上下文过长：优先加载 handoff、当前对象、相关 route/decision，而非压缩整个历史。
