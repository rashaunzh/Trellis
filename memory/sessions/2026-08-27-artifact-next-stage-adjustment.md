# 2026-08-27：Artifact Review 到下一阶段建议

## 背景

上一轮已把作品产出沉入正式活动链：AI Agent 产品 PRD v1 作为 `integrated_task`，提交 hard evidence 后进入 Evidence Review，评审通过后进入 `pending_confirmation`。本轮目标是让作品掌握确认后生成下一阶段建议，但仍保持 HITL，不自动改路线。

## 已完成

- `confirmMastery(confirmed)` 后新增作品任务识别：
  - 仅当当前节点对应正式作品任务；
  - 且作品 activity 已有 accepted evidence；
  - 才生成下一阶段 `route_revision proposed`。
- 下一阶段建议内容固定为 AI PM 作品集下一阶段：
  - 作品包装；
  - 评测深化；
  - 10-15 分钟项目讲述。
- `confirmMastery(corrected)` 不生成下一阶段建议，继续走原有 weekly_light 补强建议。
- 作品任务文案已绑定 StagePath 里程碑：
  - Week 3：确认作品方向；
  - Week 5：提交作品 v1。
- `/learn` 阶段作品闭环区新增里程碑 chip 与下一阶段建议摘要。
- 调整记录对作品下一阶段 `route_revision` 显示更具体的行动说明。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 185/185 通过。
- `npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- 本地 `/learn` HTTP 200。
- 本地 `/api/learning/quality` HTTP 200。

## 当前边界

- 下一阶段建议只是 `route_revision proposed`，用户可采纳/忽略；采纳后当前实现仍不真正切换路线或生成新阶段计划。
- 多轮作品迭代尚未完成。
- Mastra workflow demo 仍不写正式学习状态。

## 下一步建议

1. 做 proposed `route_revision` 采纳后的产品化效果：生成“下一阶段计划视图”或追加本周/下周行动，不改 DB schema。
2. 做浏览器截图级验收：作品闭环区、调整记录、活动抽屉。
3. 更新 demo script，把“作品掌握确认后出现下一阶段建议”作为作品级闭环亮点。
