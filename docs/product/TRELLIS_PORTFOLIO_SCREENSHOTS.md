# Trellis 作品集截图索引

> 日期：2026-08-27
> 配套：[作品集目标](TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md) / [演示脚本](TRELLIS_PORTFOLIO_DEMO_SCRIPT.md) / [Mastra Runbook](../engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md)

本索引引用 `docs/` 下的现有截图，说明每张截图的内容、来源与复现方式。讲解时配合[演示脚本](TRELLIS_PORTFOLIO_DEMO_SCRIPT.md)使用。

## 现有截图

### 1. `docs/acceptance-portfolio-onboarding.png`（主截图，可自动复现）

- **内容**：`/learn` 未诊断页的作品级 intake：作品方向、阶段成果、时间/精力/基础、资料适配，以及 Learning Situation-first 用户旅程。
- **来源**：`npm run acceptance:portfolio`（`scripts/compatibility/acceptance-portfolio-full-loop.mjs`）自动生成。
- **复现方式**：

  ```bash
  npm run dev
  # 另开终端
  npm run acceptance:portfolio
  ```

- **讲解要点**：Trellis 的入口不是“填一个 goal 然后排课表”，而是先做学习处境识别和资料适配，适合 AI PM 转型小白这种目标、时间、精力和材料都不稳定的真实场景。

### 2. `docs/acceptance-portfolio-stage-path.png`（主截图，可自动复现）

- **内容**：`/learn` 诊断提案页：Learning Situation Report、Situation / Material Fit / Goal Calibration / Stage Path / Simulation / Confirm 旅程条、Next Best Move、Active Risks、完整 StagePath 和前三周 DynamicSimulation。
- **来源**：`npm run acceptance:portfolio` 自动生成。
- **复现方式**：同上。
- **讲解要点**：系统先解释“为什么现在不能机械排计划”，再给出 6-8 周阶段路径和可调整节点。

### 3. `docs/acceptance-portfolio-next-stage.png`（主截图，可自动复现）

- **内容**：`/learn` 已确认页：NextStagePlan、作品级质量面板、eval 结果、Mastra runtime report，以及展示行动状态 / 证据状态 / 证据要求 / 下一步动作的 Action Card。
- **来源**：`npm run acceptance:portfolio` 自动生成。
- **复现方式**：同上。
- **讲解要点**：作品闭环进入评审、掌握确认和下一阶段活动，不是生成后即完成。

### 4. `docs/learn-next-stage-rubric.png`（主截图，可自动复现）

- **内容**：`/learn` 已确认页的 AI PM 作品集包装阶段（NextStagePlan）面板：Learning Situation-first、runtime fallback、10-15 分钟项目讲述三个作品级 rubric，「已生成 3 个正式活动」的下一阶段活动清单，以及作品迭代状态 / 修订轮次 / 版本历史。
- **来源**：`npm run acceptance:next-stage`（`scripts/compatibility/acceptance-next-stage-rubric.mjs`）自动生成。
- **复现方式**：

  ```bash
  npm run dev
  # 另开终端
  npm run acceptance:next-stage
  ```

  脚本会：准备固定 demo 状态（AI PM 转型小白 → AI Agent 产品 PRD v1 → 作品证据 accepted → 掌握确认 → 下一阶段 route_revision 采纳）→ 打开 `/learn` 检查 NextStagePlan、三个正式下一阶段活动与 rubric 文案 → 保存截图。
- **讲解要点**：作品闭环的终点不是「作品写完」，而是「作品被证据评审、被用户确认掌握、并转化为带 rubric 的下一阶段行动」。

### 5. `docs/learn-drawer-assessment.png`

- **内容**：活动抽屉的证据评估视图（上半部分）：我提交的材料、系统提取的材料摘要、已覆盖 / 待补充能力信号。
- **来源**：历史本地截图（2026-08-23，`/learn` 活动抽屉）。
- **复现方式**：`npm run dev` 后走诊断 → 确认路线 → 打开任一活动抽屉 → 提交证据并评审。
- **讲解要点**：Evidence Review 把「你写了什么」转成「你证明了哪些能力信号」，评审依据可见、可解释。

### 6. `docs/learn-drawer-assessment-bottom.png`

- **内容**：活动抽屉的证据评估视图（下半部分）：评分依据、可信度说明、下一步建议。
- **来源**：历史本地截图（2026-08-23，`/learn` 活动抽屉）。
- **复现方式**：同上，滚动到抽屉底部。
- **讲解要点**：评审输出 8 维评分、verdict（accepted / needs_revision）、可信度说明与下一步建议；缺口信号与作品 rubric 缺口会回流到评审解释。

## 建议补充的截图点位（按 Mastra Runbook）

以下点位当前尚未截图，演示时可直接打开页面讲解，或后续补充到本索引：

1. `npm run demo:mastra` 终端输出：workflowTrace / stepOutputs / HITL checkpoints / resumeContract / fallbackMode。
2. 作品任务抽屉：AI Agent 产品 PRD v1 的步骤、证据要求、评审标准和掌握确认说明。
3. 调整记录：作品掌握确认后出现的下一阶段 `route_revision proposed` 建议。
4. `/api/learning/memory`：Learning Memory Snapshot（六类记忆）。
5. `/api/learning/eval`：eval 报告（situation / material fit / stage path / dynamic adjustment / artifact loop）。

## 截图使用约定

- 截图是**证据，不是承诺**：每张截图标注来源与复现命令，评审者可自行复现。
- 主截图（Next Stage rubric）由验收脚本自动生成，与 `npm run acceptance:next-stage` 的 PASS/FAIL 绑定，保证「截图 = 通过验收」。
- 历史本地截图（drawer 两张）仅作讲解辅助；若未纳入版本控制，演示前请确认文件存在。
