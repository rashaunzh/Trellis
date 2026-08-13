---
id: session-2026-08-13-repository-information-architecture
status: completed
created_at: 2026-08-13
scope: repository
---

# 仓库信息架构整理

## 目标

在不改变应用、数据库和部署行为的前提下，建立清晰的文档权威入口、目录职责和生成物边界，为 V0.2 PRD 讨论与后续编码清除歧义。

## 完成结果

- `docs/` 按 product、architecture、research、development 和 archive 分层。
- `docs/product/TRELLIS_V0.2_PRD.md` 成为唯一当前产品讨论基线；V0.1 产品骨架单独保留用于生产兼容。
- 旧根目录状态、决策和 PRD 文件移入 `docs/archive/legacy-v0.1/`，并明确标记为非当前基线。
- 新增文档索引、仓库目录契约和决策索引；更新 README、AGENTS、handoff 与历史会话中的路径。
- `.vinext/` 生成缓存已从 Git 索引移除，本地文件保留并加入忽略规则。
- VS Code 默认隐藏 `node_modules/`、`dist/`、`.vinext/`、`.wrangler/` 和 `.sites-runtime/`。
- 保留 `app/`、`db/`、`drizzle/`、`worker/`、`build/` 和 `lib/` 的现有位置，避免在 V0.2 架构确认前引入无产品价值的路径重构。

## 验证

- 非归档区没有旧文档路径；旧产品名只在禁止使用规则和历史决策说明中出现。
- 所有 Markdown 相对链接均可解析。
- `.vinext/` 不再被 Git 跟踪，但本地缓存仍存在。
- Node 22.23.2 下 `npm test` 通过：构建成功，2 项渲染测试通过。

## 下一步

围绕 `docs/product/TRELLIS_V0.2_PRD.md` 讨论 AI 通识 V1 内容包，依次确认目标用户、毕业能力、能力节点、知识前置、综合情境任务、量规和来源目录；确认后再制定第一条可运行功能切片的实现规格。
