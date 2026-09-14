# 仓库目录契约

框架入口保持在根目录。目录整齐不能以破坏运行、迁移或兼容回归为代价。

| 路径 | 内容 | 处理原则 |
|---|---|---|
| app/ | 页面、样式、API | 交付源码 |
| lib/、src/ | 业务模块与工作流注册 | 按真实依赖保留 |
| db/、drizzle/ | Schema、已审核迁移 | 迁移不可因整理随意删除或重排 |
| worker/、build/ | 运行入口、构建适配 | build 是源码，不是 dist |
| public/ | 静态公共资源 | 可随应用分发 |
| scripts/acceptance/ | 当前功能验收 | 运行产物写 outputs |
| scripts/compatibility/ | 仍有价值的旧运行时回归 | 保留明确启用边界；不作为新版验收 |
| scripts/release/ | 构建、扫描、迁移、预检 | 可复现的交付工具 |
| tests/ | 模块、集成和构建测试 | 不因旧名称删除仍有效断言 |
| docs/ | 当前规则、设计、架构、状态、必要证据 | 每类一个明确入口 |
| memory/decisions、memory/handoff、memory/sessions | 产品决策与简短交付记录 | 只保存可审阅工程内容 |
| memory/profile、memory/routes、.vscode | 个人资料与本机设置 | 本地保留，Git 忽略 |
| .openai/ | 当前 Sites 非秘密绑定配置 | 保留部署所需配置 |
| node_modules、dist、.vinext、outputs | 依赖和可重建产物 | 不提交 |
| .wrangler/state | 本地持久数据 | 不提交，也不能当缓存随意删除 |

旧设计和演示包装从当前树删除，Git 历史可追溯。保留源码、迁移与兼容测试不代表这些能力都属于当前产品承诺。
