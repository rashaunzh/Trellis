---
id: session-2026-09-03-architecture-diagrams
status: confirmed
created_at: 2026-09-03
updated_at: 2026-09-03
source: user request in current session
scope: architecture
summary: 重画 Trellis 功能架构与技术架构图，使用 Archify 风格 Mermaid 源图。
rationale: 现有图把页面、旧课程智能链路和连续学习链路混在一起，无法说明产品价值与工程责任边界。
---

## 结果

- 更新 `docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md`。
- 功能架构主链为：处境判断 → 内容拆解 → 能力映射 → 下一最佳推进 → 周任务包 → 学习上下文 → 多信号评估 → 动态调整 → 能力成长。
- 技术架构按 Client、HTTP、Application、可替换智能层、D1 业务事实源和外部系统分层。
- 补充一次“下一最佳学习任务”产生的关键时序。

## 工具边界

用户提供的 `tt-a1i/archify` 仓库当前返回 404；本机没有 `archify`、`archtify` 或 `mmdc`，因此没有生成伪造的 Archify PNG/SVG。当前交付物是可审阅、可迁移的 Mermaid 图源。

## 验证

- `npm run delivery:precheck`：通过；架构图源文件已被交付预检纳入并校验。
