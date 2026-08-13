---
id: session-2026-08-13-local-development-environment
status: completed
created_at: 2026-08-13
scope: development-environment
---

# 固定本地开发环境

## 结果

- 确认唯一工作仓库与 Git 根目录均为 `D:\02-Production\01-Trellis`；本次未访问或操作 C 盘仓库副本。
- 从 Node.js 官方站点下载并校验 Node 22.23.2 Windows x64 ZIP，SHA-256 匹配官方 `SHASUMS256.txt`；安装到 `D:\tools\node-v22.23.2-win-x64`。
- 新增 `.nvmrc` 与 `.node-version`，将项目 Node 版本固定为 22.23.2。
- 新增 VS Code 工作区配置，默认使用 Git Bash、从工作区根目录启动，并将 Wrangler 日志放在仓库内已忽略的 `.wrangler/`。
- 新增 `docs/development/LOCAL_DEVELOPMENT.md`，记录两台电脑共用的环境约束、首次准备和日常检查命令。
- 验证 VS Code 1.133.0、Git 2.53.0、Git Bash 5.2.37、Node 22.23.2、npm 10.9.8、项目内 Wrangler 4.92.0 可用。
- 使用固定环境完成 `npm test`：构建通过，2 项渲染测试通过。
- 仓库整理时将 npm 包元数据中的旧产品名统一为 `trellis`；锁文件已有依赖清理结果予以保留并纳入验证。

## 注意事项

- 已打开的旧终端仍可能保留 Node 24；关闭并新建 VS Code 终端后，工作区 PATH 才会生效。
- PowerShell 执行策略会拦截 `npm.ps1` 和 `npx.ps1`；日常默认使用 Git Bash，必须用 PowerShell 时调用 `npm.cmd` / `npx.cmd`。

## 保护事项

- 会话开始前已有 `package-lock.json` 依赖清理修改；未回退这些修改，仅把根包名同步为 `trellis`，完整测试通过。
- 未修改应用代码、数据库或生产部署。

## 下一步

1. 关闭并新建 VS Code 终端，按 `docs/development/LOCAL_DEVELOPMENT.md` 复核工作区 PATH。
2. 整理当前仓库改动并明确 `package-lock.json` 的归属。
3. 进入 AI 通识 V1 内容包设计，不开始 V0.2 代码实现。
