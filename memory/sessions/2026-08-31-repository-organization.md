# 2026-08-31 仓库整理

## 本次目标

在审计修缮完成后，将本地长期积累的运行时、界面与交付资料整理为可审阅的 Git 历史，并同步到独立 GitHub 分支。

## 已完成

- 从 `main` 创建 `codex/trellis-production-remediation`，不直接改写远端主分支。
- 第一笔提交隔离课程智能运行时、API、D1 migration、canonical 学习状态和领域测试。
- 第二笔提交隔离 `/learn`、`/grow`、`/workbench` 与共享壳层的产品界面重构。
- 本地 `mattpocock/skills`、skill lock 和旧生成截图加入 `.gitignore`，不把分析工具误提交为 Trellis 产品依赖。
- 交付文档、架构资料、验收脚本与当前截图归入第三笔仓库整理提交。

## 仓库边界

- 保留历史 memory 与旧兼容文档，避免丢失产品决策证据。
- 不删除旧本地分支，不清理用户生成物；仅从 Git 状态中隔离明确的本地工具与旧截图。
- GitHub 仓库仍使用旧远端名称 `AI-Learning-OS`；CLI 当前未认证，仓库重命名和默认分支策略需在 GitHub 设置中单独完成。

## 验证与同步

- `npm run check`、课程智能浏览器验收与交付预检均通过。
- GitHub 只计划推送修缮分支，不自动合并到 `main`。
- 用户确认远端为私有并授权同步 `memory/` 后，修缮分支已推送到 GitHub。
- 本地仅 `feat/evidence-review-engine-v03` 已完全合并进 `main` 且远端已删除；未擅自删除本地分支。

## 工程化分类补充

- `scripts/` 分为 `acceptance/`、`release/`、`compatibility/`、`legacy/` 与 `lib/`，正式发布门槛不再和旧作品集脚本混在一起。
- 提取中立 `scripts/lib/browser-cdp.mjs`；Course Intelligence 不再反向依赖旧 next-stage 验收脚本。
- `docs/README.md` 改为当前契约、当前工程、交付材料、历史兼容和归档五类；V0.2 PRD 不再被误写为当前唯一实现基线。
- 清理 38 个临时 Chrome profile 与 Python cache；运行中的两份 dev server 日志因文件占用保留。
- 安全删除已完全合并且远端已移除的本地 `feat/evidence-review-engine-v03` 分支。
- 目录迁移后 `npm run check`、Course Intelligence 浏览器验收和 delivery precheck 全部通过。
