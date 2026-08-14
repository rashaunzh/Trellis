# Trellis

Trellis 是证据驱动的自适应学习系统：从学习诉求和真实表现出发，生成个性路径，组织学习、练习、评估与复习，并解释路径为何变化。

## 当前状态

V0.2 已完成产品基线，正在把早期学习切片重构为“学习、成长、工作台”三个一级功能。当前 `/learn` 中仍有待替换的实验界面，不代表最终信息架构；诊断、路径提案、用户确认、状态恢复和 AI 通识 V1.1 内容包可继续复用。V0.1 数据与 API 保留为兼容层。

## 当前 MVP 重点

- 不以年龄或职业制造伪分类，按目标、基础、材料、表现证据和周容量形成差异
- 六项 AI 通识能力与可检查的前置关系
- 路径修改遵循“提案 → 用户确认”，不静默改写
- 学习状态与熟练等级分开保存
- 数学、Python、机器学习和深度学习仅在需要时展开
- 0.5 星 = 15 分钟，只做周容量，不做每日排程或实时计时
- 无模型密钥也能完成确定性诊断和学习流程

## 权威入口

- [文档索引](docs/README.md)
- [V0.2 正式 PRD](docs/product/TRELLIS_V0.2_PRD.md)
- [V0.1 产品骨架](docs/product/TRELLIS_V0.1_PRD.md)
- [仓库目录契约](docs/development/REPOSITORY_STRUCTURE.md)
- [当前接力状态](memory/handoff/current.md)
- [路线记忆](memory/routes/)

## 本地运行

```bash
npm ci
npm run dev
```

完整环境要求见[本地开发环境](docs/development/LOCAL_DEVELOPMENT.md)。

启动后访问 `http://127.0.0.1:3000/`，首页会进入新版学习 MVP。
