# Trellis 本地开发环境

## 固定环境

- 交付源：GitHub 仓库 `rashaunzh/AI-Learning-OS` 的当前分支；本地目录只是工作区，不另设"唯一仓库"
- 本地工作区：`D:\02-Production\01-Trellis`
- 编辑器：VS Code
- 终端：Git Bash
- Node.js：22.23.2 LTS（安装在 `D:\tools\node-v22.23.2-win-x64`，仓库通过 `.nvmrc` 和 `.node-version` 固定版本）
- 包管理器：随 Node 22 提供的 npm
- Cloudflare CLI：项目内 Wrangler，版本由 `package-lock.json` 固定

避免在 C 盘保留另一份仓库副本运行或编辑。开发会话开始后，先运行 `pwd` 和 `git rev-parse --show-toplevel`，确认当前在 D 盘工作区；提交前先 `git pull`，结束后 `git push` 到 GitHub 当前分支。

## 首次准备

1. 在 VS Code 中打开 `D:\02-Production\01-Trellis`，不要只打开单个文件。
2. 新建终端。工作区配置会默认选择 Git Bash，并从仓库根目录启动。
3. 新建终端后运行 `node --version`，结果应为 `v22.23.2`。工作区配置会把 D 盘的固定 Node 目录放在 PATH 最前。
4. 运行 `npm ci` 安装锁文件中的依赖。不要使用全局 Wrangler。

另一台电脑可在同一路径安装 Node 22.23.2，或使用版本管理器读取 `.nvmrc` / `.node-version`。若安装路径不同，需要调整该电脑的工作区 PATH，但项目 Node 版本仍保持一致。

## 日常检查

在 Git Bash 中运行：

```bash
pwd
git rev-parse --show-toplevel
node --version
npm --version
npx --no-install wrangler --version
```

预期结果：仓库路径位于 D 盘、Node 为 22.23.2、Wrangler 从当前项目的 `node_modules` 加载。VS Code 工作区还会把 `WRANGLER_LOG_PATH` 指向被 Git 忽略的 `.wrangler/`，避免 Wrangler 把开发日志写入用户配置目录。

若必须从 PowerShell 检查，使用 `npm.cmd` 和 `npx.cmd`；这可以避开 Windows 执行策略对 `npm.ps1`、`npx.ps1` 的拦截。
