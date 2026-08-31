# 2026-08-29：日用可用学习闭环

## 本轮目标

按“自己日用可用”标准实现 Trellis 下一轮完善：学习页突出本次最小推进，Evidence Review 继续作为核心闭环，新增周复盘/下周生成，工作台资源可以进入当前学习阶段。

## 已完成

- Workspace 新增 `weekReview` 读模型：汇总完成活动、accepted evidence、待修订证据、开放活动、材料错配、容量和下一步建议。
- 新增 `/api/learning/week-review`：
  - `GET` 返回当前周复盘读模型。
  - `POST` 基于当前周复盘生成下一周计划，并用 `weekly_light accepted` 记录来源。
- 学习页新增“本次最小推进”区块，优先显示待评估、进行中或下一个核心活动。
- 学习页新增“周复盘”区块，可在有完成/评审记录后生成下一周计划。
- 工作台资源新增节点映射能力：手动材料和系统推荐资源加入收集箱时可保留 `relatedNodeIds`。
- 映射到当前节点的用户资源会自动追加到本周同节点活动的 `inputRefs`，并更新活动 `nextAdvice`。
- 新增领域测试覆盖周复盘、下周计划生成不清空当前证据、资源进入当前阶段。

## 验证

- `npx tsc --noEmit --incremental false`：通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：193/193 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next`：通过。
- `npx vinext build`：通过，路由表包含 `/api/learning/week-review`。
- `node --test tests\*.test.mjs`：6/6 通过。
- `npm run acceptance:next-stage`：通过，并更新 `docs/learn-next-stage-rubric.png`。

## 当前边界

- `generateNextWeekPlan()` 已持久化下一周计划，但 `getWorkspace()` 仍默认读取当前周；下一轮需要周切换器或计划历史视图。
- 周复盘是聚合读模型，不新增 DB 表；足够支持日用入口，但还不是长期周报档案。
- 资源映射目前依赖用户选择节点或系统推荐资源已有节点，不做自动全文解析。

## 下一步建议

1. 做周切换器/计划历史，让已生成的下一周计划可查看、可切回。
2. 把周复盘从读模型升级为可归档记录，支持连续多周回顾。
3. 继续强化 rubric-aware Evidence Review 的活动类型差异化展示。
