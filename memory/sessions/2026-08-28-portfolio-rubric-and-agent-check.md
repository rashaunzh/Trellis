# 2026-08-28 作品级 rubric 评审与并发 agent 检查

## 本轮目标

承接作品级分发前检查：完成 A 线的 `rubric-aware Evidence Review`，并核查其它并发 agent 产物是否能组成可运行、可讲述、可验收的 Trellis 作品级交付包。

## 已完成

- Evidence Review 增加作品 rubric 覆盖：
  - `EvidenceAssessment` 新增 `rubricReviews`。
  - 评分维度从 7 维扩展为 8 维，新增 `rubricCoverage`。
  - 规则 evaluator 会从活动 `evaluationCriteria` 中提取作品 rubric，并把未覆盖/部分覆盖的 rubric 写入 `missing`。
  - hard evidence 即使覆盖能力信号，如果作品 rubric 未达标，也会 `needs_revision`，避免“提交了作品就自动掌握”。
- 前端 `/learn` 的证据评审抽屉展示 rubric 覆盖情况：
  - 已覆盖和待补强 rubric 分开显示。
  - 旧 `reviewJson` 无 `rubricReviews` 时保持兼容。
- LLM fallback 保持结构完整：
  - LLM 失败或缺配置时，规则版结果仍包含 `evidenceCard`、`signalReviews`、`rubricReviews`、`dimensionScores`。
- 构建边界修复：
  - `vite.config.ts` 将 Mastra workspace 引用的 native optional 包 `@ast-grep/napi` 标为 external，避免生产 build 把 Studio/workspace 辅助依赖卷入应用 bundle。
- 发布脚本整理：
  - `npm run build` 改为跨平台 Node 入口 `scripts/build-verified.mjs`。
  - `npm run validate:artifact` 改为 `scripts/validate-artifact.mjs`。
  - `npm run lint` 改为直接调用 ESLint，避免 Windows bash/WSL 依赖。
- 分发说明：
  - 新增 `docs/engineering/PORTFOLIO_AGENT_DISTRIBUTION.md`，说明已完成模块、必跑验收、分发边界、下一批任务和推荐合并顺序。
- 分发卫生整理：
  - 旧 Python 验收脚本的截图路径从个人绝对路径改为 `TRELLIS_SHOTS_DIR` / `.wrangler/...`。
  - `DEPLOYMENT_RUNBOOK.md`、`DEMO_RUNBOOK.md`、`TRELLIS_V0.2_PLATFORM_OVERVIEW.md`、本地开发文档中的个人 URL、邮箱、账号 ID、本地盘符路径已改为占位符或通用说明。
  - 非 archive 的 `docs/` 与 `scripts/` 复扫：`C:/Users`、`D:/`、个人 handle、邮箱、真实 D1 uuid 无命中。
  - Mastra 文档口径更新：runtime/API/acceptance 是验收依据，Studio 截图是辅助证据并可复跑更新。
- 作品闭环深化：
  - 新增 `PortfolioArtifactIteration` 读模型，从 activities/evidence/adjustments/NextStagePlan 推导作品状态、当前版本、修订轮次、缺失 rubric、下一步动作和包装 readiness。
  - `PortfolioArtifactIteration` 增加 `versions[]`：每条作品证据映射为版本历史，记录 version、evidenceId、status、rubricGapCount 和摘要。
  - `Workspace` 与 `/learn` 已展示作品迭代状态；质量面板新增 `artifactIterationStatus` 与 `artifactRevisionCount`。
  - Eval suite 从 10 项扩展到 12 项，新增 `artifact_revision_loop` 与 `rubric_guardrail`。
  - 浏览器验收 `acceptance:portfolio` 新增作品迭代状态和修订轮次断言。
- 发布稳定化：
  - 新增 `scripts/portfolio-release-check.mjs` 与 `npm run release:check`，检查公开候选文件、必需作品文件和敏感模式。
  - `docs/engineering/PORTFOLIO_RELEASE_CHECKLIST.md` 与 `docs/engineering/PORTFOLIO_AGENT_DISTRIBUTION.md` 已写入 `release:check`。
- 并发产物检查：
  - C 的 README、demo script、截图索引文档已落地。
  - D 的发布检查清单和 `.gitignore` 清理已落地。
  - B/E 的 Mastra Studio 截图、runtime demo、full-loop acceptance 脚本可运行。

## 验证结果

- `npx tsc --noEmit --incremental false`：通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next`：通过。
- `npm run demo:mastra`：通过，输出 10 步 workflow trace。
- `npm run acceptance:next-stage`：通过，截图 `docs/learn-next-stage-rubric.png`。
- `npm run acceptance:portfolio`：通过，截图 `docs/acceptance-portfolio-stage-path.png`、`docs/acceptance-portfolio-next-stage.png`。
- `npx vinext build`：通过。
- `npm run build`：通过，已改为跨平台 Node 入口并完成 Sites artifact 校验。
- `npm run test`：通过，6/6 通过。
- `npm run lint`：通过，已改为直接调用 ESLint。
- `npm run validate:artifact`：通过，已改为跨平台 Node 入口。
- `python -m py_compile scripts/acceptance-replan.py scripts/acceptance-v02-main-flow.py scripts/browser-acceptance.py scripts/demo-v02.py`：通过。
- `rg "C:/Users|D:/|D:\\\\|rashaunzh|gmail|33f222|5490481c" scripts docs -n --glob '!docs/archive/**'`：无命中。
- `npm run acceptance:portfolio` 最新输出：eval 12/12 pass，作品迭代状态与修订轮次可见。
- `npm run release:check`：213 个公开候选文件，20/20 必需文件，敏感命中 0。
- `npm run acceptance:portfolio` 最新输出：eval 12/12 pass，作品迭代状态、修订轮次和版本历史可见。

## 已知风险

- 旧 bash 脚本 `scripts/build-verified.sh` / `scripts/validate-artifact.sh` 仍保留，但常用 npm 入口已改为 Node 版。后续若维护两套脚本，需要避免验收口径分叉。
- 当前 worktree 仍有大量未提交文件，属于多 agent 并发交付产物。合并前需要统一审阅并提交。
- `memory/` 仍不适合公开分发；发布分支应按 `docs/engineering/PORTFOLIO_RELEASE_CHECKLIST.md` 做白名单或脱敏。

## 下一步

1. 统一审阅并提交作品级交付包。
2. 统一审阅旧 bash 脚本是否保留；公开包可以只依赖 npm 脚本。
3. 继续产品闭环下一轮：把 artifact loop 从演示链路进一步沉入正式活动/路线数据流。
