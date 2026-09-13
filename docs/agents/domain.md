# 领域文档（Domain Docs）

工程类 skill 在探索本仓库代码时应如何消费领域文档。

## 探索前先读这些

- 仓库根目录的 **`CONTEXT.md`**，或
- 根目录的 **`CONTEXT-MAP.md`**（如存在）：它指向每个上下文各自的 `CONTEXT.md`，读取与当前主题相关的那些。
- **`docs/adr/`**：阅读与你即将工作的区域相关的 ADR。多上下文仓库中还需检查 `src/<context>/docs/adr/` 内上下文级决策。

这些文件不存在时，**静默继续**。不要提示缺失，也不要主动建议提前创建。`/domain-modeling` skill（经由 `/grill-with-docs` 和 `/improve-codebase-architecture` 触达）会在术语或决策实际落定时惰性创建它们。

## 文件结构

单上下文仓库（绝大多数仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `CONTEXT-MAP.md` 时）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 上下文级决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

本仓库为**单上下文**布局。

## 使用术语表中的词汇

当输出涉及领域概念（issue 标题、重构提案、假设、测试名）时，使用 `CONTEXT.md` 中定义的术语，不要漂移到术语表明确避免的同义词。

如果所需概念还不在术语表中，这是一个信号：要么你在发明项目不使用的语言（请重新考虑），要么存在真实的空白（记下来交给 `/domain-modeling`）。

## 标记 ADR 冲突

如果输出与已有 ADR 矛盾，应显式指出，而不是静默覆盖：

> “ADR-0007 规定 X；本方案改为 Y，理由是……需要新 ADR 或修订。”

不要假装已有决策不存在。
