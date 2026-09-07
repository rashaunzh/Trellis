# 2026-09-02 Archify 风格架构图

## 背景

用户要求用 archtify 绘制 Trellis 技术架构和时序图，用于中高级作品集材料。

## 环境确认

- 本机未找到 `archtify` 命令。
- 本机未找到 `archify` 命令。
- 本机未找到 Mermaid CLI `mmdc`。
- 仓库已有 Mermaid 架构文档，且历史记录确认 `tt-a1i/archify` 适合工程架构、工作流和数据流图。

## 本次实现

- 新增 `docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md`，保存可审阅、可渲染的 Archify 风格图源。
- 图包含：
  - 技术架构图；
  - 学习闭环时序图；
  - 工作台资料闭环时序图；
  - 内测与准发布时序图。
- 更新 `docs/README.md`，把图源加入当前产品契约索引。
- 更新 `scripts/release/delivery-precheck.mjs`，把图源纳入交付预检。

## 验证

- `npm run delivery:precheck` 通过。
- `npm run lint` 通过。

## 后续

如需真正生成 PNG/SVG，需要安装或提供 archtify/archify 渲染命令；当前仓库已经具备可渲染 Mermaid 源图。
