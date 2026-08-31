# 2026-08-29 最终交付情景迭代：行动节奏与跨周一致性

## 背景

用户要求基于最终交付情景继续实现前一轮功能完善计划。重点不是继续扩大概念或页面，而是让 `/learn` 更像可连续几周真实使用的学习执行台。

## 本次完成

- `weeklyActionPlan` 读模型加入节奏排序：
  - 修订优先；
  - 待评审优先；
  - 进行中优先；
  - 小容量周主推进收窄到 3-4 张；
  - 其余活动保留为补充推进或低精力备选。
- `/learn` 材料区只直接展示前 6 个材料判断，其余后续/参考材料折叠，降低资料墙压力。
- `startActivity`、`submitEvidence`、`reviewEvidence` 返回活动所属周 workspace，避免第 2/3 周执行时跳回当前自然周。
- `db/schema.ts` 补齐 `learningActivities.activityType` 枚举：`quiz`、`reflection`、`integrated_task`、`retest`。
- 文档 `docs/product/TRELLIS_DAILY_USABLE_2_0.md` 同步本轮最终交付情景迭代状态。

## 验证

- `npx tsc --noEmit --incremental false`
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：199/199 通过。
- `node --test tests/*.test.mjs`：6/6 通过。
- `npm run lint`
- `npm run build`：通过；仍有既有依赖 `gray-matter` direct eval warning。
- `npm run acceptance:three-week-loop`：通过并更新三张截图。

## 下一步建议

- 继续围绕最终交付做 `/learn` UI 降噪：第一屏只保留本次行动、周状态、待确认事项。
- 为材料折叠路径补一个有 7+ 材料的浏览器验收场景。
- 进入部署前做一次真实 D1 数据迁移/远端预览验收，确认 schema enum 与 D1 数据一致。
