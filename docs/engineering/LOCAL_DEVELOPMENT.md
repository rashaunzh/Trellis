# 本地开发与验证

## 环境

Node.js 22.13+、npm、Git；Chrome/Edge 仅在浏览器验收时需要。使用 package-lock.json 确定依赖，首次执行 npm ci。不要求协作者具有任何特定磁盘、代理或编辑器配置。

```bash
npm ci
npm run db:verify
npx wrangler d1 migrations apply DB --local --config wrangler.migrate.json
npm run dev
```

默认地址 http://127.0.0.1:5174/learn，另有 /grow 和 /workbench。Windows 如执行策略拦截 npm.ps1，可使用 npm.cmd。

## 数据

db:verify 在内存 SQLite 执行完整迁移并检查旧记录保留，不会初始化真实开发数据库。当前完整顺序由 drizzle/migration-manifest.json 定义，journal 必须一致。

新克隆使用仓库的 `wrangler.migrate.json` 应用本地迁移；其 DB 绑定和占位数据库 ID 与默认本地开发配置一致，不连接远端数据库。首次应用前核对命令列出的待应用迁移，再确认执行；已有数据库先核对记录，不盲目重放 SQL，不删除 .wrangler/state。自定义 DB 绑定或持久化目录时，迁移和开发服务必须使用同一配置/位置。隔离功能验收脚本有自己的测试数据库，不应连接个人开发数据。

## 模型

不配置密钥时先使用已发布基线验证基本流程。需要真实模型时，根据[环境示例](../../.env.example)和[模型配置](../architecture/MODEL_RUNTIME.md)在本地 .env.local 和 Worker .dev.vars 设置服务端变量；这些真实环境文件不提交，也不复制到文档。

## 检查

```bash
npm run check
npm run delivery:precheck
```

check 包含类型、lint、常见密钥扫描、迁移、领域测试、构建和构建路由测试。delivery:precheck 检查交付入口、文档链接及其目标是否进入 Git，同时检查个人文件与过时目录边界；新文件暂存后运行，不替代功能或生产验收。

运行浏览器流程见[脚本说明](../../scripts/README.md)。截图和详细日志放 outputs/；人工核对后才将少量脱敏证据放 docs/product/evidence，附源码、时间、环境和证明范围。

## 结果边界

本地测试不证明托管登录可用、真实模型稳定或用户已获得学习效果。正式身份与生产验证见[发布指南](DEPLOYMENT_RUNBOOK.md)。
