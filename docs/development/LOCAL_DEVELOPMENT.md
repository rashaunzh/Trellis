# Trellis 本地开发环境

## 固定环境

- 交付源：当前 GitHub 仓库的当前分支；本地克隆只是工作区，不另设"唯一仓库"
- 工作区定位：以当前克隆的 git root 为准（`git rev-parse --show-toplevel`），不依赖特定盘符或绝对路径
- 编辑器：VS Code
- 终端：PowerShell / Git Bash 均可；常用 npm 脚本已使用跨平台入口
- Node.js：22.23.2 LTS（仓库通过 `.nvmrc` 和 `.node-version` 固定版本）
- 包管理器：随 Node 22 提供的 npm
- Cloudflare CLI：项目内 Wrangler，版本由 `package-lock.json` 固定

开发会话开始后，先运行 `pwd` 和 `git rev-parse --show-toplevel`，确认在目标克隆的 git root 下工作；提交前先 `git pull`，结束后 `git push` 到 GitHub 当前分支。避免在多个位置保留仓库副本同时编辑。

## 首次准备

1. 在 VS Code 中打开克隆目录（git root），不要只打开单个文件。
2. 新建终端。工作区配置会默认选择 Git Bash，并从仓库根目录启动。
3. 新建终端后运行 `node --version`，结果应为 `v22.23.2`。工作区配置会把固定 Node 目录放在 PATH 最前（安装路径不同则调整该电脑的工作区 PATH）。
4. 运行 `npm ci` 安装锁文件中的依赖。不要使用全局 Wrangler。

另一台电脑可在同一路径安装 Node 22.23.2，或使用版本管理器读取 `.nvmrc` / `.node-version`。若安装路径不同，需要调整该电脑的工作区 PATH，但项目 Node 版本仍保持一致。

## 日常检查

在 Git Bash 中运行：

```bash
pwd
git rev-parse --show-toplevel
git status -sb
node --version
npm --version
npx --no-install wrangler --version
```

预期结果：git root 位于当前克隆、分支与远端同步、Node 为 22.23.2、Wrangler 从当前项目的 `node_modules` 加载。VS Code 工作区还会把 `WRANGLER_LOG_PATH` 指向被 Git 忽略的 `.wrangler/`，避免 Wrangler 把开发日志写入用户配置目录。

若必须从 PowerShell 检查，使用 `npm.cmd` 和 `npx.cmd`；这可以避开 Windows 执行策略对 `npm.ps1`、`npx.ps1` 的拦截。

## 本地 D1 初始化

如果打开 `/learn`、`/grow` 或 `/workbench` 时看到：

```text
D1_ERROR: no such table: learning_routes
```

说明本地 Miniflare D1 还没有应用 learning 域迁移。先启动或构建一次项目，确保 `dist/server/wrangler.json` 已生成，然后在仓库根目录执行：

```powershell
$env:WRANGLER_LOG_PATH = "$PWD\.wrangler\wrangler.log"
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0004_kind_boomerang.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0005_premium_ultron.sql
.\node_modules\.bin\wrangler.cmd d1 execute site-creator-d1 --local --persist-to .wrangler\state --config dist\server\wrangler.json --file drizzle\0012_week_reviews.sql
```

注意：`--persist-to` 应指向 `.wrangler\state`，不要写成 `.wrangler\state\v3`，否则 Wrangler 会创建错误的 `.wrangler\state\v3\v3\d1` 目录。
