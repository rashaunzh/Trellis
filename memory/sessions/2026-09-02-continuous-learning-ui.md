# 2026-09-02 连续学习体验与前端重构

## 本轮目标

把课程智能功能 MVP 补成可恢复、可解释、可连续使用的学习运行面，并参考 ClauseOS 的生命周期视觉语言统一学习、成长和工作台。

## 已完成

- 新增 `0019_learning_continuity.sql`：活动开始、最近打开、暂停、完成、暂停原因和实际用时。
- 新增正式 start、pause、location 与 resource attachment API；`GET /api/learning/current` 返回恢复状态、来源定位、最近适配、路线摘要和当前附加资源。
- 来源定位明确区分 `exact / course_root / missing`；用户补充位置只修改个人活动。
- 学习反馈持久保存物化调整摘要；刷新后仍能说明原信号、变化和下一行动。
- `/learn` 改为路线状态、课程层叠、当前片段、适配说明、连续进度和下一周生命周期；反馈与路线管理进入抽屉。
- `/grow` 默认当前路线，只把真实信号和确认状态计为成长；完整领域为二级视图。
- `/workbench` 可把辅助内容附加到当前片段，仍不改变正式课程主线。
- 引入 `lucide-react`；桌面侧栏、1024 收敛布局和 390 固定底部导航完成。

## 验证

- `npm run check`：通过；239 项领域测试、20 个迁移、6 项构建契约全部通过。
- `npm run acceptance:course-intelligence`：通过；覆盖目录压缩、确认、开始、暂停、刷新恢复、补定位、反馈适配、成长、工作台附加与三档视口。
- `npm run delivery:precheck`：通过。
- 截图：`docs/acceptance-continuous-learning-*.png`。
- 生产构建仅保留既有 `gray-matter` direct eval 与 vinext 路由分类提示。

## 边界与下一步

- 本轮没有新增 Agent 框架或聊天助教，Mastra 仍负责耐久工作流，D1 仍是业务事实源。
- 远程 D1 尚未执行 `0013-0019`，托管身份与线上 smoke 尚未完成。
- 下一轮进入真实课程组合质量评审和具体功能优化，不再扩底层架构。
