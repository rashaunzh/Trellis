# 功能学习闭环 V3 实施

日期：2026-09-01

## 目标

把已收口的 Agentic 决策内核推进为可连续两周使用的功能 MVP：多课程判断、有限组合、局部调整、准确片段、轻反馈、实际适配和下一周提案。

## 完成

- 最多 8 门材料的 intake 与 owner 隔离的 `personal_ready` 私有课程。
- Curriculum Solver v3：硬约束、课程比较、三门以内 AI PM 组合、准确 `StudySegment` 和显式缺口。
- 方案 revision API：固定、暂缓、排除与章节范围约束，不覆盖历史方案。
- canonical activity 直接保存课程版本、章节定位、停止条件和完成信号。
- 可选 Scenario Check 与 `LearningSignalInputV2`；错误判断会变成针对性回看，卡点会缩小范围或插入前置。
- 自动周摘要、第二周 draft 与轻确认；旧周和原始信号不清空。
- `/learn` 三态 UI 重构，多课程输入和两周闭环可在桌面与 390px 视口使用。
- README、产品契约、本地开发、部署说明和发布预检同步到 `0018`。

## 验证

- TypeScript、lint、秘密扫描通过。
- 19 个迁移在空 SQLite 中通过。
- 237 项领域测试通过。
- production build 与 6 项构建契约通过。
- Agentic HTTP 验收覆盖情景题、物化回看和第二周确认。
- Course Intelligence 浏览器验收覆盖方案、学习、成长、工作台和移动端，无框架错误与严重横向溢出。

## 开放项

- 真实多课程集合仍需做人工产品质量评审，尤其课程选择理由、来源用途和阶段语义。
- 远程 D1 `0013-0018`、托管身份和线上 smoke 未执行。
- 当前不继续扩 Agent 框架；下一步进入功能质量与前端细化。
