# 2026-08-27：分发前仓库清理与隐私检查

## 任务

为可分发给 coding agent / 作品集评审者准备工程状态：敏感信息扫描、临时文件清理、忽略规则、发布清单。约束：不删 memory/，只标记不适合公开的文件；不改业务逻辑；不删用户未要求删的文件；疑似敏感内容只列文件与风险，不输出原文。

## 扫描方法与结论

- 全仓 236 个文本文件（排除 node_modules/.next/dist/.git/.wrangler 等）跑 18 类正则（API key / GitHub / AWS / Google / Slack token / JWT / 私钥 / 赋值型 secret / 私人邮箱 / 手机 / 身份证 / 本地路径 / workers 域名 / 个人 handle / localhost）。
- **无真实密钥**：`sk-` 命中 5 处均为 URL `.../ai-risk-management-framework` 误报；JWT / AWS / Google / Slack / 私钥 / 手机 / 身份证命中 0。
- 个人标识约 30 处：个人 handle、workers.dev 子域、个人邮箱，集中在 docs runbook 与 memory。
- 本地绝对路径 11 处：`C:/Users/...`、`D:/...`，集中在 scripts 验收脚本（acceptance-replan.py / acceptance-v02-main-flow.py / browser-acceptance.py / demo-v02.py / acceptance-next-stage-rubric.mjs）。
- 开发 URL localhost 14 处，低危。
- 完整命中清单（文件:行:类别）存 `%TEMP%\trellis-secret-scan.txt`。

## 产物

- `.gitignore` 追加：`/.tmp-next-stage-chrome/`（验收脚本创建的 Chrome profile）、`**/.tmp-chrome-*/`、`**/.acceptance-shots/`、`**/acceptance-shots/`、`*.log`、`*.log.*`。
- 新增 `docs/engineering/PORTFOLIO_RELEASE_CHECKLIST.md`：可公开/不建议公开文件、必跑命令、人工检查项、分支/commit 建议（推荐 git archive 白名单排除 memory/）。

## 验证

- `npx tsc --noEmit --incremental false`：0 错误。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next`：0 errors，1 warning（`scripts/acceptance-next-stage-rubric.mjs:9` 未使用变量，为并发任务产物，未改动）。
- `git check-ignore`：新增规则忽略 log/chrome profile，不误伤 lib/docs/memory/profile/package.json/截图。

## 风险标记（未处置，仅标记）

- `memory/handoff/current.md` 当前为**无效 UTF-8**（并发写入损坏，偏移 30 处多字节字符被截断为 `EF BC 3F`），需维护方修复；未改写以避免与并发写入冲突。
- memory/ 整体不建议公开（handoff/sessions/profile 含邮箱、账号、域名、路径）。
- scripts 中硬编码本地绝对路径未改（不改业务逻辑/并发产物），发布前需参数化或脱敏。

## 明确不做

不删除任何文件（含 memory/、截图、wrangler.migrate.json）；不改并发任务产物（src/、app/api/learning/*、新 lib 文件等）；不做 git 历史重写（无真实密钥入库）。
