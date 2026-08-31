# Trellis 分发前发布清单（Portfolio Release Checklist）

> 状态：可执行清单（配合 2026-08-27 全仓敏感扫描）
> 用途：把私有开发仓库整理成可分发给 coding agent / 作品集评审者的工程状态。**不删除用户记忆与项目历史**：本清单只标记、忽略和人工检查，不做删除。
> 配套：`.gitignore` 已追加浏览器自动化临时产物规则；`npm run build` / `npm run lint` / `npm run validate:artifact` 已改为跨平台 Node/ESLint 入口。

## 1. 扫描结论（2026-08-27）

对仓库全部文本文件（排除 node_modules/.next/dist/.git/.wrangler 等）做了 18 类敏感模式扫描（API key、GitHub/AWS/Google/Slack token、JWT、私钥、赋值型 secret、私人邮箱、手机号、身份证、本地路径、workers 域名、个人 handle、localhost）：

- **无真实密钥**：`sk-` 命中 5 处全部为 URL 片段（`ai-risk-management-framework`）误报；JWT / AWS / Google / Slack / 私钥 / 手机 / 身份证命中为 0。仓库历史无需因密钥重写。
- **个人标识命中**（约 30 处）：初扫时集中在 docs runbook 与 memory；当前 docs/scripts 已做第一轮占位符脱敏，发布前仍需复扫确认。
- **本地绝对路径命中**（11 处）：初扫时集中在 scripts 验收脚本与 memory；当前 scripts 已改为相对路径 / 环境变量，发布前仍需复扫确认。
- **开发 URL**：`http://localhost` 14 处，低危，runbook 常规内容。

## 2. 可公开文件

| 范围 | 说明 |
|---|---|
| `lib/`（业务代码） | 无真实密钥；`apiKey` 相关命中均为变量引用/空值（如 `config.apiKey`） |
| `app/`（前端与 API 路由） | workbench 页面的 apiKey 字段为绑定/占位，无字面量密钥 |
| `tests/` | 测试用例，无敏感数据 |
| `drizzle/`、`db/` | schema 与迁移 |
| `docs/product/` | 产品介绍、作品集文档（除含个人标识的平台总览，见 §3） |
| `docs/architecture/` | 架构与决策说明 |
| `scripts/` | 验收/演示脚本（旧 Python 脚本已归入 `scripts/legacy/`，发布前仍需检查路径脱敏） |

## 3. 不建议公开文件（仅标记，不删除）

| 文件 / 范围 | 风险 |
|---|---|
| `memory/` 整体 | 用户记忆与历史：handoff、sessions、profile、decisions 含个人邮箱、GitHub 账号、workers 域名、本地路径与未脱敏会话细节。**发布包必须排除 `memory/`** |
| `memory/handoff/current.md` | 个人邮箱、账号、域名、本地路径；另注意该文件当前为**无效 UTF-8**（并发写入损坏，含被截断的多字节字符），发布前需由维护方修复 |
| `memory/profile/preferences.yaml` | 个人偏好（产品语言、时间单位、工具边界） |
| `memory/sessions/*` | 全部会话记录，含账号/路径/过程细节 |
| `docs/engineering/DEPLOYMENT_RUNBOOK.md` | 已做占位符脱敏；发布前复扫确认 |
| `docs/engineering/DEMO_RUNBOOK.md` | 已做占位符脱敏；发布前复扫确认 |
| `docs/development/LOCAL_DEVELOPMENT.md` | 已做通用化处理；发布前复扫确认 |
| `docs/product/TRELLIS_V0.2_PLATFORM_OVERVIEW.md` | 已做占位符脱敏；发布前复扫确认 |
| `wrangler.migrate.json` | D1 迁移配置（当前 database_id 为零占位，但 database_name 指向本地库，发布前确认是否随包） |

处置建议（三选一）：(a) 整体排除（推荐，见 §6 分支建议）；(b) 脱敏后公开：把邮箱/账号/域名替换为 `<placeholder>`，本地路径改为相对路径；(c) 保留私有。

## 4. 必跑命令

```bash
# 1. 全量领域测试（Windows 沙箱下需 --test-isolation=none）
node --test --test-isolation=none "tests/learning-domain/*.test.ts"

# 2. 类型检查
npx tsc --noEmit --incremental false

# 3. Lint（排除构建产物）
npx eslint . --ignore-pattern dist --ignore-pattern .next

# 4. 构建（发布前，跨平台 Node 入口，包含 Sites artifact 校验）
npm run build

# 4b. 单独校验构建产物（可选）
npm run validate:artifact

# 5. 敏感扫描（发布前复跑；只输出 文件:行:类别，不输出匹配内容）
#    用仓库根文本文件集跑 18 类正则，见 §1；无真实密钥/个人标识命中后再发布。

# 6. 公开候选包检查（白名单 + 必需文件 + 敏感模式）
npm run release:check
```

## 5. 分发前人工检查项

- [ ] `git status --short` 只含预期变更；`.gitignore` 生效后不再出现 `.tmp-next-stage-chrome/`、日志、中间截图。
- [ ] `npm run release:check` 通过：必需作品级文件齐全，公开候选文件敏感命中为 0。
- [ ] 发布包不含 `memory/`（用 §6 白名单方式打包或独立分支）。
- [ ] 以下文件中的邮箱/账号/域名/本地路径已替换为占位符（或整体排除）：
  - docs：`DEPLOYMENT_RUNBOOK.md`、`DEMO_RUNBOOK.md`、`LOCAL_DEVELOPMENT.md`、`TRELLIS_V0.2_PLATFORM_OVERVIEW.md`（已初步脱敏）
  - `scripts/legacy/`：`acceptance-replan.py`、`acceptance-v02-main-flow.py`、`browser-acceptance.py`、`demo-v02.py`（已改为 `TRELLIS_SHOTS_DIR` / 相对路径）
  - memory（若保留）：`handoff/current.md`、`sessions/2026-08-20-v0.2-replan-acceptance.md`
- [ ] `memory/handoff/current.md` 编码损坏已由维护方修复（当前无效 UTF-8，不随发布包）。
- [ ] 截图（`docs/learn-*.png`）确认为作品集素材而非中间文件；中间截图目录已被忽略。
- [ ] `wrangler.migrate.json` 决定随包或排除。
- [ ] 检查 `app/`、`lib/` 中无注释/字符串里残留真实账号或 URL 凭据（扫描已覆盖赋值型模式）。

## 6. 分支 / commit 建议

- **推荐方式：白名单打包，不依赖删除**。用 `git archive` 或 rsync 只取需要的顶层目录（`lib/ app/ tests/ docs/ drizzle/ db/ scripts/ package.json package-lock.json tsconfig.json .gitignore`），天然排除 `memory/`、`.wrangler/`、`.sites-runtime/` 等。
- 机器检查入口：`npm run release:check`。该脚本只检查公开候选集合，排除 `memory/`、`docs/archive/`、构建产物和浏览器临时目录。
- 若坚持用 git 分支：从干净基线开 `release/portfolio`，只 cherry-pick 公开文件相关的 commit，**不要把含 memory/ 的 commit 历史带入发布分支**（git 历史无法用 `.gitignore` 清除）。
- 清理 commit 建议单文件最小化：`feat(hygiene): ignore browser automation temp artifacts`（仅 `.gitignore`）+ `docs(engineering): add portfolio release checklist`（仅清单）。
- 本轮扫描确认无真实密钥，**无需** git filter-repo / 历史重写；若未来发现历史中已入库密钥，再按 `git filter-repo` 流程处理。
- 发布前确认当前工作区由多任务并发修改：`git status --short` 中未跟踪源码（`src/`、`app/api/learning/artifact/` 等）是其他任务产物，发布时统一评审后纳入，勿单独提交半成品。
