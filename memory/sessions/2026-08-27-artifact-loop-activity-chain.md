# 2026-08-27：Artifact Loop 正式活动链

## 背景

用户确认下一步要把 Trellis 的作品产出从阶段路径和 demo 表达推进到正式学习数据流。目标不是新增一套作品系统，而是复用现有活动、证据评审和掌握确认闭环。

## 已完成

- `LearningApplicationService.createPortfolioArtifactActivity(ownerId)`：
  - 生成 AI Agent 产品 PRD v1 作品任务；
  - 作品任务类型为 `integrated_task`；
  - 作为核心活动进入当前周计划；
  - 复用 Evidence Review 和 `pending_confirmation` 掌握确认机制；
  - 幂等：已存在作品任务时不重复创建。
- 新增 `/api/learning/artifact`：
  - POST 后生成作品任务并返回 workspace。
- `/learn` 已确认页新增“阶段作品闭环”：
  - 未生成时显示“生成作品任务”；
  - 已生成时显示任务状态、证据状态和“通过后需掌握确认”；
  - 可直接打开作品任务抽屉。
- `lib/learning/frontend.ts` 新增 `createPortfolioArtifactActivity()`。
- 新增领域测试：
  - 生成正式作品 `integrated_task`；
  - 提交 PRD 类 hard evidence；
  - 评审通过后节点进入 `pending_confirmation`，不直接 validated。
- 更新作品级文档和 Mastra runbook，明确 artifact loop 首个正式切片已完成，未夸大为多阶段作品迭代系统。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 184/184 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- 本地 `http://127.0.0.1:5174/learn` HTTP 200。
- 本地 `http://127.0.0.1:5174/api/learning/quality` HTTP 200。

## 当前边界

- 作品任务目前是手动确认生成，符合 HITL；不是诊断后自动写入。
- 首个作品类型固定为 AI Agent 产品 PRD v1 / 案例拆解报告。
- 作品反馈还没有自动回写下一阶段路线；下一步需要做 Artifact Review -> Next Stage Adjustment。
- Mastra workflow demo 仍不直接写学习状态；正式状态写入仍由 Trellis service/API 承担。

## 下一步建议

1. 做 Artifact Review -> Next Stage Adjustment：作品评审结果生成下一阶段路线/补强建议。
2. 把作品任务与 StagePath Week 3/5 里程碑建立可追溯引用。
3. 为 `/learn` 做一次浏览器截图级验收，确认作品闭环区和活动抽屉没有布局问题。
