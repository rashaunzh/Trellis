# Trellis

Trellis 是个人成长与行动中台：连接长期路线、当前任务、外部 AI 工作台、作品证据和跨会话记忆。它不替代 NotebookLM、Gemini、ChatGPT、Codex、Obsidian 或 Hermes，而是让这些工具围绕同一条成长路线持续协作。

## 当前状态

V0.1 是保留中的生产版本；V0.2 自适应学习方向已确认，正在设计首个 AI 通识内容包，尚未开始 V0.2 代码实现。

## V0.1 重点

- G 学习成长 / J 求职发展 / B 商业探索 / I 创新与想法四条主线
- 路线阶段、项目、任务三个不同层级
- 进行中、短期启动、长期规划、暂停、完成等区间状态
- 0.5 星 = 15 分钟的粗粒度预算，以及完成后的实际用时
- 任务的安排理由、前后顺序、资料链接和证据
- 对象内 AI 讨论与“提案 → 确认 → 正式记忆”
- 私有 Git 仓库支持两台电脑接力

首条验证链路是 Notebook 测评项目。一周检查重点，连续两周真实使用后再决定是否建设 V0.2。

## 权威入口

- [文档索引](docs/README.md)
- [V0.2 产品方案](docs/product/TRELLIS_V0.2_PRD.md)
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

当前 V0.1 已实现阶段看板、四条路线、项目链路、任务上下文、星级与实际用时、证据回写、AI 讨论摘要、概念闪卡、工具地图和周复盘。第一周从 Notebook 测评链路开始真实使用。
