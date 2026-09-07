# Trellis V0.2 本地开发指南

> Windows / macOS / Linux 均可。基础结构见 `docs/development/REPOSITORY_STRUCTURE.md`。本文件是 V0.2 工程可用 MVP 的完整本地开发路径。

## 前置

- Node 22.13+（以 `package.json#engines` 和 `.nvmrc` 为准）
- Python 3.14 + playwright（旧浏览器验收脚本需要；作品级验收脚本使用 Node）
- 网络：境外走 Clash 代理 `127.0.0.1:7890`（公司网关封直连；git push/wrangler 需 `-c http.proxy=...` 或 `https_proxy` 环境变量）

## 安装与验证循环

```bash
npm install

npm run check          # typecheck + lint + 迁移链 + 领域测试 + production build
```

注意：`npm run build`、`npm run lint`、`npm run validate:artifact` 已改为跨平台入口，不再依赖 Windows WSL / Git Bash。

## D1 本地初始化（新 clone 必做）

迁移唯一顺序由 `drizzle/migration-manifest.json` 定义。先验证空库可以完整执行：

```bash
npm run db:verify
```

已有 0013 的本地库升级到 canonical runtime 与生产控制面：

```powershell
npm run build
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0014_canonical_learning_runtime.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0015_production_control_plane.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0016_agentic_decision_kernel.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0017_model_runtime_trace.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0018_functional_learning_loop.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0019_learning_continuity.sql
```

全新环境按 manifest 顺序应用全部 SQL；不要再参考 Drizzle `_journal.json` 推断 0010 之后的顺序。

2. 启动 dev server：`npm run dev -- --host 127.0.0.1 --port 3410 --strictPort`。
3. 页面：`http://localhost:3410/product`（宣传页）、`/learn`（学习页）、`/grow`、`/workbench`。

## Schema 变更流程

1. 改 `db/schema.ts`（状态层用独立列，不用大 JSON 字段）。
2. `npm run db:generate` 生成 `drizzle/000N_*.sql`。
3. 应用到本地 D1（上述 python 方法）+ 部署前应用到远程（见 DEPLOYMENT_RUNBOOK）。
4. 若内容层新增字段：同步改 `lib/learning/persistence/d1.ts` 的 seedContent INSERT 与 `lib/learning/domain/types.ts`。

## Course Intelligence 验收

启动 dev server 后运行：

```bash
TRELLIS_BASE=http://127.0.0.1:<实际端口> npm run acceptance:course-intelligence
TRELLIS_BASE=http://127.0.0.1:<实际端口> npm run acceptance:internal-test-loop
```

该验收覆盖 DeepLearning.AI 目录压缩、路线确认、开始/暂停/恢复、用户定位、反馈适配、工作台附加、`/learn`、`/grow`、`/workbench`，以及 1440、1024、390 三档布局，并保存 `docs/acceptance-continuous-learning-*.png`。

内部测试闭环验收覆盖首次进入、开始学习、来源补定位、中断恢复、反馈变化和工作台资料引用，并保存 `docs/acceptance-internal-test-*.png`。它是作品集内测证据，不替代人工测试记录。

服务端模型使用 `TRELLIS_AI_PRIMARY_*` 和 `TRELLIS_AI_FALLBACK_*` 两组变量；旧 `TRELLIS_AI_API_KEY/MODEL/BASE_URL` 仅作为主模型兼容别名。不配置时为发布基线模式，不影响已有课程方案。每个槽可用 `*_STRUCTURED_OUTPUT=json_schema|json_object|prompt_json` 覆盖结构化输出能力；密钥只放本地或托管环境变量。
配置真实模型后先运行 `npm run smoke:model`，再运行 `npm run benchmark:model`；发布门设置 `TRELLIS_REQUIRE_MODEL_BENCHMARK=1` 时要求主备两槽都通过固定 benchmark。完整参数、错误策略和 Trace 见[模型运行架构](../architecture/MODEL_RUNTIME.md)。
浏览器端 API Key 存储已停用；旧 `learning_api_config` 表只作为迁移兼容保留，正式运行时不读取。

旧运行时 mutation 默认返回 `410`。只做兼容回归时设置 `TRELLIS_ENABLE_LEGACY_RUNTIME=1`，或由验收请求显式发送 `x-trellis-legacy-runtime: true`；不要在生产开启。

## 常见坑

- **dev server 端口残留**：新起用 `--strictPort` 换端口（3406/3407/…），不要杀旧进程。
- **worker 端 lib 代码更新**：vite HMR 对 worker 端模块不可靠，改 lib/ 后重启 dev server 再验证。
- **drizzle text enum**：SQLite 无 CHECK 约束，改 TS 枚举值不需迁移；新增列才需要。
- **正式验收**：`npm run acceptance:course-intelligence`；`TRELLIS_BASE` 指定实际端口。旧 Python 验收位于 `scripts/legacy/`，只在回归 V0.2 兼容行为时运行。
