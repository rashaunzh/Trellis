# 2026-08-27 — Portfolio Full-Loop 浏览器验收脚本

## 目标

新增作品级主链路浏览器验收 `scripts/acceptance-portfolio-full-loop.mjs`（无 npm 依赖，
Node + CDP），覆盖 reset → diagnostic（页面表单）→ StagePath/DynamicSimulation →
confirm → artifact → evidence → review → mastery → next stage → /learn 渲染 →
quality/eval；保存两张截图；补 `acceptance:portfolio` npm script；更新 runbook。

## 交付

- 新增 `scripts/acceptance-portfolio-full-loop.mjs`：复用 next-stage 导出的 CDP/API
  helpers；浏览器 pass 1 用 React 受控表单（原生 value setter）提交诊断并截
  StagePath 提案视图；API 闭环 confirm→artifact→evidence→review→mastery→next-stage；
  API 校验 quality / eval（passRate=1）/ mastra-runtime（StagePath≥6 周、
  DynamicSimulation≥4 次、trace≥10）；浏览器 pass 2 校验 NextStagePlan + 3 正式活动
  + rubric + quality 面板 + 点击 eval（100% pass）与 Mastra runtime（week StagePath），
  截 next-stage 视图。
- 修改 `scripts/acceptance-next-stage-rubric.mjs`：导出 check/apiPost（ownerId 参数）/
  findChrome/waitForJsonVersion/waitForPageTarget/connectCdp + 常量，主入口加
  `isMain` 守卫（import 不触发副作用）；行为不变。
- `package.json`：新增 `acceptance:portfolio`。
- `docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`：补作品级主链路验收小节
  （前置 dev server、命令、链路、截图位置）。
- `eslint.config.mjs`：globalIgnores 增加生成/运行时目录（.mastra/.tmp-*/.wrangler/
  .sites-runtime），修复 eslint 扫生成物超时。
- `vite.config.ts`：server.watch.ignored 排除生成目录（修复 Chrome 自动化 profile /
  Mastra 输出导致 watcher 风暴、页面 fetch 挂起的真实 bug）；server.port 固定 5174
  （与验收脚本默认 BASE 一致）。

## 验证

- `npm run acceptance:next-stage` 等价命令：12/12 PASS（API + 页面 + 截图）。
- `npm run acceptance:portfolio` 等价命令：29/29 PASS（含两张截图）。修复过程中发现
  并解决：导入的 apiPost 闭包捕获 next-stage 的 OWNER_ID 导致 API 打到错误 owner
  （改为显式传 ownerId）。
- `npx tsc --noEmit --incremental false`：0 错误（含 vite.config 改动）。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next`：0 problems。
- 领域测试：159+ 中 1 个失败为并发 agent 引入的既有问题（见下），与本次改动无关。
- 说明：页面挂起（loading 卡死）根因诊断为 vite watcher 跟踪 Chrome profile 高频写
  文件导致 dev server 过载；watch.ignored 修复后未能在本环境端到端复跑——重启 dev
  server 的权限升级被用户拒绝，尊重决定，不再启动服务器。

## 并发冲突与既有问题（未处理，已标记）

- `scripts/acceptance-*.mjs` 被另一 agent 并发编辑（PID 唯一 CDP 端口/profile、
  新增 onboarding 截图）；按其规则停止覆盖，仅做 node --check（语法 0 错误）。
- `tests/learning-domain/llm-evidence-evaluator.test.ts` "回退结果包含 dimensionScores"
  失败：并发 agent 在 evidence-evaluator.ts 新增 rubricCoverage 维度（8 维），测试
  硬编码 7；属并发工作自身的测试滞后，未代改。
- `memory/handoff/current.md` 被并发 agent 以 GBK 编码写入（read 工具报 invalid
  UTF-8），他人无法 UTF-8 读取；未代改（其在写文件），需其重存 UTF-8。
- `.mastra/`（Mastra CLI 输出）未 gitignore，eslint 已加忽略；建议补 .gitignore。
