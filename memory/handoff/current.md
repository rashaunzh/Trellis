# Current Handoff

Updated: 2026-08-13

## Current objective

保留 Trellis V0.1 生产版本和数据，以 V0.2 自适应学习方案推进下一版本。开发环境与仓库信息架构均已固定；当前立即讨论 AI 通识 V1 内容包，确认后制定第一条功能切片并开始编码。尚未开始 V0.2 代码实现。

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

- V0.2 PRD: `docs/product/TRELLIS_V0.2_PRD.md`
- Market and learning foundations: `docs/research/V0.2_MARKET_AND_LEARNING_FOUNDATIONS.md`
- Confirmed decision: `memory/decisions/2026-08-12-v0.2-adaptive-learning.md`
- Design session: `memory/sessions/2026-08-12-v0.2-product-design.md`

## Exact next step

1. 以 `docs/product/TRELLIS_V0.2_PRD.md` 为唯一基线，确认 AI 通识 V1 的目标用户与毕业能力。
2. 继续确认能力节点、知识前置、综合情境任务、量规和来源目录，并按提案 → 审核 → 确认落库。
3. 内容包确认后，为第一条可运行功能切片与 V0.1 渐进迁移制定实现规格并开始编码。

## Local development environment

- 唯一仓库：`D:\02-Production\01-Trellis`；禁止操作 C 盘仓库副本。
- 已固定：VS Code 工作区默认 Git Bash、仓库根目录、项目内 Wrangler 4.92.0、Wrangler 日志进入 `.wrangler/`。
- Node 安装：`D:\tools\node-v22.23.2-win-x64`；`.nvmrc` 与 `.node-version` 均固定为 22.23.2。
- VS Code 新终端会把 Node 22 放在 PATH 最前；已打开的旧终端需要关闭重开。PowerShell 中使用 `npm.cmd` / `npx.cmd`，或直接使用 Git Bash。
- 详细记录：`docs/development/LOCAL_DEVELOPMENT.md`、`memory/sessions/2026-08-13-local-development-environment.md`。

## Repository information architecture

- 文档索引：`docs/README.md`。
- 当前产品基线：`docs/product/TRELLIS_V0.2_PRD.md`；V0.1 仅作为生产兼容基线。
- 目录契约：`docs/development/REPOSITORY_STRUCTURE.md`。
- 旧版材料：`docs/archive/legacy-v0.1/`，仅供追溯。
- 整理记录：`memory/sessions/2026-08-13-repository-information-architecture.md`。

## Boundaries

- 不在产品方案提交中修改应用代码、数据库或生产部署。
- 不清空或覆盖 V0.1 数据。
- 不同时建设第二个领域内容包。
- 不建设日历、每日打卡、实时计时器、完整课程平台或公开多用户市场。
