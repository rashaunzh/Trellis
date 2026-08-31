# 2026-08-28 Calm OS Report + Action Card

## 本轮目标

用户指出 `/learn` 仍然模板化，功能入口和前端体验不足，尤其是诊断后页面没有完整产品旅程，task card 仍是旧版任务卡。

本轮按已确认计划实现：Calm OS 风格、诊断后旅程重构、Action Card 信息结构升级。

## 已完成

- `/learn` 诊断后提案页从“学习地图提案”改为 `Learning Situation Report`。
- 新增诊断后旅程条：
  - Situation
  - Material Fit
  - Goal Calibration
  - Stage Path
  - Simulation
  - Confirm
- 第一屏改为判断报告：
  - Trellis 当前判断；
  - Next Best Move；
  - 为什么不能机械排计划；
  - 目标、资料、容量、精力、行为、证据质量。
- StagePath 展示从普通列表调整为更清晰的阶段路线视图。
- DynamicSimulation 展示改为更明确的事件时间线，保留调整前后与 HITL/自动微调。
- 本周看板 `ActivityCard` 升级为 Action Card：
  - 行动状态；
  - 证据状态；
  - Capability / Artifact 类型；
  - 证据要求；
  - 待确认调整和缺口信号；
  - 下一步动作。
- 已确认页顶部不再展示完整 intake goal 作为大标题，改为“本周执行台”，长目标压到摘要。
- Calm OS 样式继续收敛：
  - 主内容区约 1240px；
  - 更低圆角；
  - 更克制的报告/行动卡结构；
  - 响应式保留单列降级。
- 浏览器验收新增：
  - proposal journey 检查；
  - Action Card evidence/status 检查。
- 截图索引更新：
  - 诊断报告截图说明包含 `Learning Situation Report` 旅程条；
  - 下一阶段截图说明包含 Action Card。

## 验证结果

- `npx tsc --noEmit --incremental false`：通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npm run lint`：通过。
- `npm run acceptance:portfolio`：通过，截图更新：
  - `docs/acceptance-portfolio-onboarding.png`
  - `docs/acceptance-portfolio-stage-path.png`
  - `docs/acceptance-portfolio-next-stage.png`
- `npm run release:check`：通过，required 22/22，敏感命中 0。
- `npm run build`：通过；仍有依赖 `gray-matter` direct eval 警告，非本轮引入。

## 当前判断

这轮解决了产品体验的第一层问题：入口和诊断后页面已经能体现 Trellis 的“Learning Situation-first dynamic learning adaptation”，本周 task card 也不再只是旧任务卡。

但前端体验还没完全结束。下一步如果继续 UI，应优先做：

1. 作品任务抽屉重构：把证据提交、rubric、评审结果和掌握确认整理成更强的 artifact workspace。
2. Quality / Eval / Mastra runtime 区域再降噪，变成工程验证 drawer 或折叠区。
3. 移动端截图验收，确保 620px 以下没有挤压。

## 注意

- 未修改 `memory/handoff/current.md`，该文件此前存在无效 UTF-8 风险。
