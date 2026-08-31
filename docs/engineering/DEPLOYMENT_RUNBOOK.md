# Trellis V0.2 部署 Runbook

> 目标：`<your deployed URL>`（Cloudflare Workers + D1；账号、Account ID、子域名按部署环境填写，不写入公开仓库）。

## 部署前置清单

- [ ] 代码已 commit + push（分支 `docs/trellis-v02-adaptive-learning-prd`）
- [ ] 全量验证绿：test:domain / eslint / build / node --test / 验收脚本
- [ ] wrangler 已登录（`npx wrangler whoami`，OAuth 有效）
- [ ] 远程 D1 迁移已应用（见下）
- [ ] 网络走 Clash 代理（`export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890`）

## 远程 D1 迁移

远程库：`<your-d1-database-name>`（uuid `<your-database-id>`）。每次 schema 变更（新迁移文件）执行：

```bash
npx wrangler d1 execute <your-d1-database-name> --remote --file drizzle/000N_*.sql
# 验证表结构：
npx wrangler d1 execute <your-d1-database-name> --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'learning_%' ORDER BY name"
```

本次 Course Intelligence 发布必须包含：

```bash
npx wrangler d1 execute <your-d1-database-name> --remote --file drizzle/0013_course_intelligence.sql
```

若启用内置模型，在服务端配置 `TRELLIS_AI_API_KEY`、`TRELLIS_AI_MODEL` 和可选 `TRELLIS_AI_BASE_URL`；不要把 Key 写入仓库。未配置模型时生产环境仍应通过已发布基线 smoke。

## 构建与部署

```bash
# 1. 生产构建（必须注入真实 DATABASE_ID，否则 wrangler.json 是 placeholder 绑定）
DATABASE_ID=<your-database-id> npm run build

# 2. 核对绑定
python -c "import json; print(json.load(open('dist/server/wrangler.json'))['d1_databases'])"
# 预期：database_id 是真实 uuid，不是 00000000-...

# 3. 部署
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890
npx wrangler deploy
# 成功标志：Deployed trellis triggers + <your deployed URL> + Current Version ID
```

不要手写 wrangler.toml（build 生成 wrangler.json，手写会合并出重复 DB 绑定）。

## 线上验证

```bash
# Bot Fight Mode 坑：必须带完整浏览器 UA，否则 403
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
curl -s -x http://127.0.0.1:7890 -A "$UA" -o /dev/null -w "%{http_code}\n" <your deployed URL>/learn   # 200
curl -s -x http://127.0.0.1:7890 -A "$UA" <your deployed URL>/api/learning/workspace   # {"workspace":{...}}

# 自动 smoke：未设置 TRELLIS_BASE 时会跳过；设置后检查 /learn、/workbench、workspace API、week-review API
TRELLIS_BASE=<your deployed URL> npm run smoke:production
```

- `/`→307（→/learn）、`/product /learn /grow /workbench`→200
- 远程库为空 = 全新起点（onboarding 态）

## 交付前固定检查

```bash
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
node --test tests/*.test.mjs
npm run lint
npm run build
npm run delivery:precheck
TRELLIS_BASE=<your deployed URL> npm run smoke:production
```

部署前还应在本地运行：

```bash
TRELLIS_BASE=http://127.0.0.1:<实际端口> npm run acceptance:course-intelligence
```

`acceptance:three-week-loop`、`acceptance:portfolio` 和 `acceptance:next-stage` 只用于旧兼容链回归，不是当前部署门槛。`delivery:precheck` 只检查交付资产是否齐备；`smoke:production` 才检查线上 URL。

## 演示数据管理

- **重置**：页面右上角"重新设置"（清学习状态，不清 API 配置与收集箱）
- **API 直调**：`curl -X POST -H "x-trellis-owner-id: <uuid>" <your deployed URL>/api/learning/reset`
- 验证用的真实 LLM key 测完必须清除（`DELETE FROM learning_api_config`）

## 回滚

- 旧版本：`npx wrangler deployments list --name trellis` 找历史 version → 重新 deploy 对应代码（无一键回滚，重新构建部署）
- 数据：远程 D1 无备份机制，迁移前确认；危险操作先导出（`wrangler d1 export trellis-v02-d1 --remote --no-data` 仅结构）
- 子域名/绑定变更：`.openai/hosting.json` 记录 project_id（`appgprj_6a72003abefc8191a4bd0c79702ee892`），复用不新建 site

## 已知边界

- workers.dev 子域名注册只能用户在 dashboard 完成（Turnstile 挡 headless）：`https://dash.cloudflare.com/<accountId>/workers/onboarding`
- 中国大陆直连网络访问 workers.dev 可能不稳定；正式对外演示建议绑定自定义域名
- 公网是匿名隔离（x-trellis-owner-id header），不是安全鉴权；ownerId 可伪造
