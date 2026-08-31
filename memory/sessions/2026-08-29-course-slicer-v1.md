# 2026-08-29 Course Slicer v1

## 背景

用户指出 OpenMAIC 值得参考，重点不是照搬多智能体课堂，而是强化 Trellis 的课程切分能力：从用户已有课程和资料中判断当前只学哪一段，避免把整门课塞进本周。

## 本次完成

- 新增 `courseSlices` workspace 读模型，不新增数据库表。
- `CourseSlice` 包含材料标题、片段角色、片段范围、选择理由、预计时间、看完动作、看完问题、跳过原因和关联活动。
- `weeklyActionPlan` 新增 `courseSliceIds`，行动卡可绑定具体课程片段。
- `/learn` 新增“课程切片”区，本周必看片段直接展示，后续/参考/跳过片段折叠。
- 活动抽屉展示当前行动绑定的课程切片，让用户打开行动后即可看到“只看哪段”和“看完回答什么”。
- 三周浏览器验收新增 `learn page renders course slicer` 检查。

## 产品判断

- OpenMAIC 的路线是 `主题/材料 → 完整互动课堂`。
- Trellis 的路线应保持为 `已有课程/资料 → 专业性判断 → 当前片段切分 → 本周行动 → 轻反馈/复盘`。
- 外部 AI 可以后续用于长大纲、字幕、PDF 的 slice 提取，但不能成为 Trellis 基础功能依赖。

## 验证

- `npx tsc --noEmit --incremental false`
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：199/199 通过。
- `node --test tests/*.test.mjs`：6/6 通过。
- `npm run lint`
- `npm run build`
- `npm run acceptance:three-week-loop`

## 下一步建议

- 把用户粘贴的课程大纲/视频目录解析成多个 slice，而不是当前每个材料判断一条 slice。
- 在 `/workbench` 材料卡展示“已切出几段、本周采用几段、跳过几段”。
- 为切片增加更强的质量规则：初学者难度、是否有练习、是否有评测、是否偏宣传。
