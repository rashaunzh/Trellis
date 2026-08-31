# 2026-08-27：Mastra CLI / Studio 入口接入

## 背景

用户要求继续接 Mastra Studio/CLI，然后再回到产品闭环。上一轮已经完成 Mastra runtime/API/UI，本轮补 Mastra 官方项目入口。

## 本轮完成

- 新增 `src/mastra/index.ts`，按 Mastra 官方约定导出 `mastra`。
- 该入口复用 `trellisMastraRuntime`，不新建第二套 workflow registry。
- `package.json` 新增脚本：
  - `mastra:dev`: `npx mastra dev --dir src/mastra`
  - `mastra:studio`: `npx mastra studio --server-port 4111`
- `tests/learning-domain/portfolio-orchestration.test.ts` 增加断言：`src/mastra/index.ts` 导出的 `mastra` 能取到 `trellis-learning-situation-workflow`。
- 更新 Mastra runbook 和作品级目标文档，明确当前“CLI/Studio 入口已接入”，但 Studio 未截图验收。

## CLI 安装情况

- 查询到 `mastra` npm 当前版本为 `1.27.0`。
- 尝试 `npm install --save-dev mastra@1.27.0` 和 `npx mastra --version`，均长时间无输出，已中止。
- 随后用 `npm install --ignore-scripts --no-audit --no-fund` 修复失败安装造成的 node_modules 缺包问题。
- 因此当前不把 `mastra` CLI 固化进 devDependency；脚本通过 `npx mastra ...` 调用。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，190/190。
- focused tests 14/14 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- `GET /api/learning/mastra-runtime` 200，steps=10，HITL=5。
- `POST /api/learning/mastra-runtime` 200，status=success，steps=10。

## 当前边界

- Studio/CLI 项目入口已接好。
- 本机 CLI 下载/安装未完成，所以尚未启动 `mastra dev`，也没有 Studio graph 截图。
- Trellis 正式状态仍由 service / D1 控制；Mastra Studio 入口用于 workflow 展示和调试。

## 准确下一步

1. 在网络稳定时运行 `npm run mastra:dev`，打开 `http://localhost:4111`，确认 Studio 能看到 workflow。
2. 截图 workflow graph / step output / HITL 节点。
3. 回到产品闭环：把 `NextStagePlan` 三个模块转成正式活动。
