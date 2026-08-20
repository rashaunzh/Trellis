# Trellis V0.2 部署 Runbook

> 目标：`https://trellis.rashaunzh.workers.dev`（Cloudflare Workers + D1，账号 rashaunzh@gmail.com，Account `33f222cb9c9aba8aa61c426e922d556d`，workers.dev 子域 `rashaunzh`）。

## 部署前置清单

- [ ] 代码已 commit + push（分支 `docs/trellis-v02-adaptive-learning-prd`）
- [ ] 全量验证绿：test:domain / eslint / build / node --test / 验收脚本
- [ ] wrangler 已登录（`npx wrangler whoami`，OAuth 有效）
- [ ] 远程 D1 迁移已应用（见下）
- [ ] 网络走 Clash 代理（`export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890`）

## 远程 D1 迁移

远程库：`trellis-v02-d1`（uuid `5490481c-c5a9-4423-8906-6a0d0e6e278f`）。每次 schema 变更（新迁移文件）执行：

```bash
npx wrangler d1 execute trellis-v02-d1 --remote --file drizzle/000N_*.sql
# 验证表结构：
npx wrangler d1 execute trellis-v02-d1 --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'learning_%' ORDER BY name"
```

## 构建与部署

```bash
# 1. 生产构建（必须注入真实 DATABASE_ID，否则 wrangler.json 是 placeholder 绑定）
DATABASE_ID=5490481c-c5a9-4423-8906-6a0d0e6e278f ./node_modules/.bin/vinext.cmd build

# 2. 核对绑定
python -c "import json; print(json.load(open('dist/server/wrangler.json'))['d1_databases'])"
# 预期：database_id 是真实 uuid，不是 00000000-...

# 3. 部署
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890
npx wrangler deploy
# 成功标志：Deployed trellis triggers + https://trellis.rashaunzh.workers.dev + Current Version ID
```

不要手写 wrangler.toml（build 生成 wrangler.json，手写会合并出重复 DB 绑定）。

## 线上验证

```bash
# Bot Fight Mode 坑：必须带完整浏览器 UA，否则 403
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
curl -s -x http://127.0.0.1:7890 -A "$UA" -o /dev/null -w "%{http_code}\n" https://trellis.rashaunzh.workers.dev/learn   # 200
curl -s -x http://127.0.0.1:7890 -A "$UA" https://trellis.rashaunzh.workers.dev/api/learning/workspace   # {"workspace":{...}}
```

- `/`→307（→/learn）、`/product /learn /grow /workbench`→200
- 远程库为空 = 全新起点（onboarding 态）

## 演示数据管理

- **重置**：页面右上角"重新设置"（清学习状态，不清 API 配置与收集箱）
- **API 直调**：`curl -X POST -H "x-trellis-owner-id: <uuid>" https://trellis.rashaunzh.workers.dev/api/learning/reset`
- 验证用的真实 LLM key 测完必须清除（`DELETE FROM learning_api_config`）

## 回滚

- 旧版本：`npx wrangler deployments list --name trellis` 找历史 version → 重新 deploy 对应代码（无一键回滚，重新构建部署）
- 数据：远程 D1 无备份机制，迁移前确认；危险操作先导出（`wrangler d1 export trellis-v02-d1 --remote --no-data` 仅结构）
- 子域名/绑定变更：`.openai/hosting.json` 记录 project_id（`appgprj_6a72003abefc8191a4bd0c79702ee892`），复用不新建 site

## 已知边界

- workers.dev 子域名注册只能用户在 dashboard 完成（Turnstile 挡 headless）：`https://dash.cloudflare.com/<accountId>/workers/onboarding`
- 中国大陆直连网络访问 workers.dev 可能不稳定；正式对外演示建议绑定自定义域名
- 公网是匿名隔离（x-trellis-owner-id header），不是安全鉴权；ownerId 可伪造
