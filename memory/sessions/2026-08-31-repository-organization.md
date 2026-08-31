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
- 首次 push 被隐私安全门拦截：提交包含私有 `memory/`，当前无法由 CLI 确认远端仓库可见性。需用户明确确认该远端为私有且允许同步 memory 后再推送。
- 本地仅 `feat/evidence-review-engine-v03` 已完全合并进 `main` 且远端已删除；未擅自删除本地分支。
