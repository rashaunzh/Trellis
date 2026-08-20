# Trellis V0.2 本地开发指南

> Windows Git Bash 环境。基础结构见 `docs/development/REPOSITORY_STRUCTURE.md`。本文件是 V0.2 工程可用 MVP 的完整本地开发路径。

## 前置

- Node 24+（仓库 .nvmrc 固定 22.23.2，Node 24 原生跑 TS 测试）
- 系统 Python 3.14（`/c/Program Files/Python314/python.exe`）+ playwright（浏览器验收）
- 网络：境外走 Clash 代理 `127.0.0.1:7890`（公司网关封直连；git push/wrangler 需 `-c http.proxy=...` 或 `https_proxy` 环境变量）

## 安装与验证循环

```bash
npm install

npm run test:domain   # Node 原生跑 TS 测试（tests/learning-domain/*.test.ts）
./node_modules/.bin/eslint.cmd app lib tests --ignore-pattern dist --ignore-pattern .next   # 0 problems
DATABASE_ID=5490481c-c5a9-4423-8906-6a0d0e6e278f ./node_modules/.bin/vinext.cmd build
node --test "tests/*.test.mjs"   # 6/6
```

注意：`npm run test` 在当前 Windows/WSL 环境下因 bash 进入 WSL 找不到 node 而失败，用上面分命令替代。

## D1 本地初始化（新 clone 必做）

1. 启动 dev server 前先应用迁移到本地 Miniflare D1（`.wrangler/state/v3/d1/`）：

```bash
npx vite --port 3410 --strictPort   # 首次启动会建空库
# 停掉后，对 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite 逐个执行迁移：
python -c "
import sqlite3, glob
for p in glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite'):
    conn = sqlite3.connect(p)
    for f in ['drizzle/0004_kind_boomerang.sql','drizzle/0005_premium_ultron.sql','drizzle/0006_material_gressill.sql','drizzle/0007_next_ogun.sql','drizzle/0008_silent_dark_beast.sql']:
        conn.executescript(open(f, encoding='utf-8').read())
    conn.commit(); conn.close()
print('migrations applied')
"
```

2. 启动 dev server：`npx vite --port 3410 --strictPort`（用 localhost 访问，vite 可能只监听 IPv6）。
3. 页面：`http://localhost:3410/product`（宣传页）、`/learn`（学习页）、`/grow`、`/workbench`。

## Schema 变更流程

1. 改 `db/schema.ts`（状态层用独立列，不用大 JSON 字段）。
2. `npm run db:generate` 生成 `drizzle/000N_*.sql`。
3. 应用到本地 D1（上述 python 方法）+ 部署前应用到远程（见 DEPLOYMENT_RUNBOOK）。
4. 若内容层新增字段：同步改 `lib/learning/persistence/d1.ts` 的 seedContent INSERT 与 `lib/learning/domain/types.ts`。

## 常见坑

- **dev server 端口残留**：新起用 `--strictPort` 换端口（3406/3407/…），不要杀旧进程。
- **worker 端 lib 代码更新**：vite HMR 对 worker 端模块不可靠，改 lib/ 后重启 dev server 再验证。
- **drizzle text enum**：SQLite 无 CHECK 约束，改 TS 枚举值不需迁移；新增列才需要。
- **验收脚本**：`scripts/acceptance-replan.py`（重排本周 32 项）；`TRELLIS_BASE` 环境变量指定端口。Python 脚本需 `py_compile` 通过。
