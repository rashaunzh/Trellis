# Trellis 仓库目录契约

## 原则

仓库按“运行代码、工程支持、产品资料、长期记忆”分工。Next/Vinext、Drizzle 和 Worker 依赖若干根目录约定，因此 V0.2 架构确认前不为视觉整齐移动运行代码。

## 运行代码

| 路径 | 职责 | 约束 |
|---|---|---|
| `app/` | Next/Vinext 页面、样式和 API 路由 | 框架入口，保持根目录 |
| `lib/` | 跨页面复用的 Trellis 业务逻辑 | 新通用逻辑优先放这里 |
| `db/` | 数据库连接和当前 Schema | 被 API 与 Drizzle 配置直接引用 |
| `drizzle/` | 已审核的数据库迁移和迁移元数据 | 不手工改写已应用迁移 |
| `worker/` | Cloudflare Worker 入口 | 被 Vite 配置直接引用 |
| `public/` | 浏览器可直接访问的静态资源 | 不存放秘密或用户私密材料 |

## 工程支持

| 路径 | 职责 |
|---|---|
| `build/` | Sites/Vinext 构建适配代码，不是构建产物 |
| `scripts/` | 安装、构建、环境与产物验证脚本 |
| `tests/` | 自动化验证 |
| `examples/` | 不参与主运行流程的示例 |
| `.github/` | CI 工作流 |
| `.openai/` | 当前托管平台的非秘密配置 |
| `.vscode/` | 仓库级编辑器与终端约束 |

## 产品资料与记忆

- `docs/` 保存可评审的产品、架构、研究和开发文档；`docs/product/TRELLIS_V0.2_PRD.md` 是当前产品基线。
- `memory/` 保存已确认偏好、路线、决策、会话结果和当前交接；它不是文档归档区，也不复制外部知识原文。

## 可重建目录

`node_modules/`、`dist/`、`.vinext/`、`.wrangler/` 和 `.sites-runtime/` 由安装、构建或本地运行产生，不进入 Git，并在 VS Code 默认隐藏。需要时通过 `npm ci`、`npm run build` 或开发命令重建。

## 何时允许重构目录

只有当 V0.2 实现规格明确了领域边界，且移动能改善依赖方向或测试隔离时，才评估引入 `src/` 或重新组织 `app/db/worker`。目录迁移必须单独提交，并在每批移动后运行完整测试。
