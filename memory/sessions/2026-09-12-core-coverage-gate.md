# 2026-09-12 收缩版 PRD 与目标核心覆盖质量门（切片 1）

## 本轮结果

用户确认收缩方向但要求完善核心功能。已交付：

1. **[收缩版 PRD](../../docs/product/TRELLIS_SHRUNK_PRD_2026-09-12.md)**：产品承诺收缩为一句话（目标→学哪几段→做到什么算完→材料不够时诚实说不），四个功能切片按序，明确冻结清单（课程内容包、雅思、新工作流等）。
2. **切片 1 已实现**：
   - `curriculum-solver.ts`：新增 `deriveGoalCoreNodeIds`（目标语义核心节点，不含前置闭包）；求解改为核心节点优先消费选课预算（弹性上限 5，默认其余 3）；新增 `planStatus`（complete/limited）与 `limitedPlanNotice`（缺失能力说明 + 三种用户选择）。
   - `course-intelligence.ts`：装配 schema 新增可选 `planStatus`/`coreNodeIds`/`limitedPlanNotice`；验证层新增质量门——核心节点未覆盖时必须声明有限方案，不得伪装完整路线。
   - `service.ts`：创建与重算两条路径都传入核心节点。
   - 回归测试：评估型目标核心被安排或诚实标记 limited（283 领域测试全过，typecheck/lint 过）。

## 关键验证

H1 型输入（"写过客服方案，学可靠性评估"）实测：此前评测核心全部进缺口；现在 `pm.eval-design`、`pm.failure-taxonomy`、`app.eval-observability` 全部安排，`planStatus: complete`，缺口 0。根因确认是"前置基础先消费 3 门预算挤走核心节点"，核心优先选课修复了它。

## 已确认决策

- 核心节点选课预算弹性至 5 门（默认其余仍 3 门）——取代"AI PM 组合不超过 3 门"的旧断言，对应测试已更新。
- 诚实失败（planStatus=limited）成为一等产品状态。

## 开放问题 / 准确下一步

1. 前台（learn/grow 页）尚未消费 `planStatus`/`limitedPlanNotice`：limited 路线目前仍渲染成普通路线。切片 1 的展示层收尾未完成。
2. 切片 2（路线审阅与章节启动）、切片 3（反馈分流与状态诚实）未开始。
3. 五维表 H1–H4 复评未跑（需真实模型试验）。
4. 出口条件句式填空（切片 3 范围）未动。

## 边界

未跑完整 `npm test`（含 build），未跑真实模型试验，未部署。样本验证基于本地基线目录。
