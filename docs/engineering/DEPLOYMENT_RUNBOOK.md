# Trellis V0.2 部署 Runbook

> 目标：`<your deployed URL>`（Cloudflare Workers + D1；账号、Account ID、子域名按部署环境填写，不写入公开仓库）。

## 部署前置清单

- [ ] 当前交付分支已 commit + push
- [ ] 全量验证绿：test:domain / eslint / build / node --test / 验收脚本
- [ ] wrangler 已登录（`npx wrangler whoami`，OAuth 有效）
- [ ] 远程 D1 迁移已应用到 `0016`（见下）
- [ ] `TRELLIS_ADMIN_EMAILS` 已配置为课程内容评审管理员邮箱
- [ ] `TRELLIS_IDENTITY_MODE=chatgpt-hosted` 且 `TRELLIS_TRUSTED_HOSTS` 只列托管域名
- [ ] `workers.dev` 已关闭；每周来源 Cron `0 18 * * sun` 已注册
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
npx wrangler d1 execute <your-d1-database-name> --remote --file drizzle/0014_canonical_learning_runtime.sql
npx wrangler d1 execute <your-d1-database-name> --remote --file drizzle/0015_production_control_plane.sql
npx wrangler d1 execute <your-d1-database-name> --remote --file drizzle/0016_agentic_decision_kernel.sql
```

若启用内置模型，在服务端配置 `TRELLIS_AI_PRIMARY_*` 与 `TRELLIS_AI_FALLBACK_*`；不要把 Key 写入仓库。未配置模型时生产环境仍应通过已发布基线 smoke，但带模型的正式发布必须让两槽分别通过 benchmark。

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

# 自动 smoke：无身份时检查页面与 API 鉴权；提供测试身份后执行完整 Course Intelligence 链。
TRELLIS_BASE=<your deployed URL> TRELLIS_AUTH_EMAIL=<smoke-user-email> npm run smoke:production
```

- `/`→307（→/learn）、`/product /learn /grow /workbench`→200
- 未带 ChatGPT 托管身份的学习 API → 401
- `/api/learning/mastra-runtime` → 课程分析、课程组合、学习调整、来源演进四条正式工作流
- 客户端伪造 `x-trellis-owner-id` 或托管邮箱 header → 401
- 远程库为空 = 全新起点（onboarding 态）

## 交付前固定检查

```bash
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
node --test tests/*.test.mjs
npm run lint
npm run build
npm run delivery:precheck
TRELLIS_BASE=<your deployed URL> TRELLIS_AUTH_EMAIL=<smoke-user-email> npm run smoke:production
```

部署前还应在本地运行：

```bash
TRELLIS_BASE=http://127.0.0.1:<实际端口> npm run acceptance:course-intelligence
```

`acceptance:three-week-loop`、`acceptance:portfolio` 和 `acceptance:next-stage` 只用于旧兼容链回归，不是当前部署门槛。`delivery:precheck` 只检查交付资产是否齐备；`smoke:production` 才检查线上 URL。

## 演示数据管理

- **重置**：页面右上角"重新设置"（清学习状态，不清 API 配置与收集箱）
- **API 直调**：生产请求必须经过 ChatGPT 托管身份；`x-trellis-owner-id` 只在 localhost 有效。
- 验证用的真实 LLM key 测完必须清除（`DELETE FROM learning_api_config`）

## 回滚

- 旧版本：`npx wrangler deployments list --name trellis` 找历史 version → 重新 deploy 对应代码（无一键回滚，重新构建部署）
- 数据：远程 D1 无备份机制，迁移前确认；危险操作先导出（`wrangler d1 export trellis-v02-d1 --remote --no-data` 仅结构）
- 子域名/绑定变更：`.openai/hosting.json` 记录 project_id（`appgprj_6a72003abefc8191a4bd0c79702ee892`），复用不新建 site

## 已知边界

- workers.dev 子域名注册只能用户在 dashboard 完成（Turnstile 挡 headless）：`https://dash.cloudflare.com/<accountId>/workers/onboarding`
- 中国大陆直连网络访问 workers.dev 可能不稳定；正式对外演示建议绑定自定义域名
- 课程候选评审入口为 `/internal/course-intelligence`，数据接口同时校验托管身份与 `TRELLIS_ADMIN_EMAILS`。
- smoke 使用的身份必须是专用测试用户，完整 smoke 会生成并确认一条课程方案。
