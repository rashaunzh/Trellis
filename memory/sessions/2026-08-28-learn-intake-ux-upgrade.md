# 2026-08-28 Learn Intake UX Upgrade

## 本轮背景

用户指出两个分发前风险：

- 功能入口仍然粗糙，例如初入方向、时间、基础和精力没有形成真实学习处境 intake；
- `/learn` 页面仍像常见 UI，没有足够清晰的产品风格和用户旅程。

## 已完成

- `/learn` 未诊断页从单一 goal textarea 升级为作品级 intake：
  - 作品方向：AI PM 作品路径 / AI 评测与风险 / AI 应用方案；
  - 阶段成果：AI Agent 产品 PRD / AI 产品案例拆解 / 资料适配与学习路线报告 / AI 评测方案；
  - 时间容量：保留每周时间选择；
  - 当前基础：刚开始 / 有使用经验 / 能做初稿；
  - 精力状态：稳定 / 波动 / 偏低；
  - 资料适配：默认带入 AI PM 作品路径相关资料，可手动调整。
- 页面提交诊断时会组合更完整的 intake goal，并传入：
  - `selfReport`；
  - `plannerMode: "adaptive_existing_content"`；
  - `materialIds`；
  - `preference`。
- `/api/learning/diagnostic` 增加 `plannerMode` 透传，避免前端作品级体验停留在 legacy planner。
- onboarding 页面新增用户旅程条和画像草案侧栏。
- `scripts/acceptance-portfolio-full-loop.mjs` 增加 onboarding journey 检查，并保存 `docs/acceptance-portfolio-onboarding.png`。
- `scripts/portfolio-release-check.mjs` 将 onboarding 截图加入 required。
- `docs/product/TRELLIS_PORTFOLIO_SCREENSHOTS.md` 更新为三张自动验收主截图：
  - onboarding；
  - stage path；
  - next stage。
- `docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md` 与 `docs/engineering/TRELLIS_PORTFOLIO_DELIVERY_MANIFEST.md` 同步入口体验说明。

## 验证结果

- `npx tsc --noEmit --incremental false`：通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npm run lint`：通过。
- `npm run acceptance:portfolio`：通过，新增 onboarding 截图与 journey 检查。
- `npm run release:check`：通过，required 22/22，敏感命中 0。
- `npm run build`：通过；仍有依赖 `gray-matter` direct eval 警告，非本轮引入。

## 当前判断

这轮解决的是分发前最显眼的产品体验问题：用户入口现在能体现 Trellis 的原创主线，即 Learning Situation-first dynamic learning adaptation。它不再只是“输入目标生成计划”，而是从方向、成果、时间、基础、精力和资料共同识别学习处境。

## 下一步

- 做一次真人视角浏览器走查：从空状态进入 `/learn`，诊断、确认、生成作品任务、提交证据、运行 eval / Mastra runtime。
- 如果继续产品体验：强化诊断后页面的信息层级，把 StagePath、DynamicSimulation、Material Fit、NextBestMove 做成更明确的“学习伙伴判断报告”。
- 如果继续工程分发：按 manifest 生成公开发布包或公开分支。

## 注意

- 未更新 `memory/handoff/current.md`，该文件此前存在无效 UTF-8 风险。
