# Current Handoff

Updated: 2026-08-13

## Current objective

保留 Trellis V0.1 生产版本和数据，完成 V0.2 产品方案落库。本地开发环境已固定为 D 盘仓库、Git Bash 和 Node 22.23.2；当前进入仓库整理，之后继续讨论 AI 通识 V1 内容包。尚未开始 V0.2 代码实现。

## Production status

- GitHub repository: `rashaunzh/AI-Learning-OS`
- Production URL: https://ai-learning-os.rashaunzh.chatgpt.site
- Sites project: `appgprj_6a72003abefc8191a4bd0c79702ee892`
- Access: custom, owner only
- V0.1 D1 分批写入修复已通过 PR #4 合并到 `main`，合并提交为 `59a5258cee5e0b3903460b4dad97f05d3db79c7f`。
- 当前文档工作不修改生产代码或部署。

## Confirmed V0.2 direction

- 长期服务所有学习领域，首期使用 AI 通识基础验证通用内核。
- 产品中心是领域底图、个性路径、学习陪伴、掌握评估和动态调整，不是 Todo 或职业导航。
- 资源采用 AI 从一手来源起草、人工审核后发布的版本化内容包。
- 学习者面对一个长期导师；低风险调整自动执行，重大路径变化需要确认。
- 只做周容量与核心/可选活动，不做日排程。
- 单用户验证、多用户兼容、模型中立 BYOK。
- V0.1 数据和四主线保留并渐进迁移。

## Authoritative documents

- V0.2 PRD: `docs/TRELLIS_V0.2_PRD.md`
- Market and learning foundations: `docs/V0.2_MARKET_AND_LEARNING_FOUNDATIONS.md`
- Confirmed decision: `memory/decisions/2026-08-12-v0.2-adaptive-learning.md`
- Design session: `memory/sessions/2026-08-12-v0.2-product-design.md`

## Exact next step

1. 整理当前分支的环境配置与已有 `package-lock.json` 修改，保持改动边界清晰。
2. 在不写代码前先设计 AI 通识 V1 内容包：能力节点、知识前置、综合情境任务、量规和来源目录。
3. 审核内容包后，再为通用数据模型和 V0.1 渐进迁移制定实现规格。

## Local development environment

- 唯一仓库：`D:\02-Production\01-Trellis`；禁止操作 C 盘仓库副本。
- 已固定：VS Code 工作区默认 Git Bash、仓库根目录、项目内 Wrangler 4.92.0、Wrangler 日志进入 `.wrangler/`。
- Node 安装：`D:\tools\node-v22.23.2-win-x64`；`.nvmrc` 与 `.node-version` 均固定为 22.23.2。
- VS Code 新终端会把 Node 22 放在 PATH 最前；已打开的旧终端需要关闭重开。PowerShell 中使用 `npm.cmd` / `npx.cmd`，或直接使用 Git Bash。
- 详细记录：`docs/LOCAL_DEVELOPMENT.md`、`memory/sessions/2026-08-13-local-development-environment.md`。

## Boundaries

- 不在产品方案提交中修改应用代码、数据库或生产部署。
- 不清空或覆盖 V0.1 数据。
- 不同时建设第二个领域内容包。
- 不建设日历、每日打卡、实时计时器、完整课程平台或公开多用户市场。
