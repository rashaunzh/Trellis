# 2026-09-02 真实使用断点优化

## 背景

用户指出现有计划仍偏向功能修补，要求从真实使用角度实施 Trellis 的学习、成长、工作台闭环优化，不新增第四个主页面或更多 Agent。

## 本次实现

- `/learn` 强化当前片段恢复状态：区分未开始、已打开未反馈、暂停、继续和完成，并显示原因与下一步按钮文案。
- 来源定位增加用户可理解的精度标签：缺少位置、只能到课程主页、可直达片段、个人补充的准确位置。
- 学习反馈后的路线变化改为可刷新追踪的时间线，显示触发信号、变更摘要和是否已应用。
- 学习页新增克制的路线管理入口，常驻展示已采用、暂缓、排除、固定和待确认版本数量。
- `/grow` 从领域目录转为当前路线视角，补充当前阶段、最近能力信号、下一里程碑、节点为何在当前阶段以及下一次验证方式。
- `/workbench` 给暂存资源增加上下文状态：已附加当前片段、已关联当前节点、可转课程候选、未整理。
- 移动端保持学习主动作、底部导航和无严重横向溢出。

## 工程变更

- `CurrentLearningState` 增加 `adaptationTimeline`、`routeManagementSummary` 和更完整的 `resumeState`。
- `SourceResolution` 增加 `precisionLabel`、`missingReason`、`manualOverride` 与更新时间。
- 活动 scope 增加个人补充定位标记，避免污染共享课程 catalog。
- 时间线按创建时间和读取顺序稳定排序，避免同毫秒反馈导致“最近变化”不稳定。
- 更新 Course Intelligence 领域测试和浏览器验收断言，覆盖真实使用断点。

## 验证

- `npm run test:domain` 通过：239/239。
- `npm test` 通过：production build + 6 项构建测试。
- `npm run acceptance:course-intelligence` 通过，截图覆盖 proposal、learn、feedback、grow、workbench、mobile。
- `npm run check` 通过：typecheck、lint、secret scan、20 个迁移、239 项领域测试、production build、6 项构建测试。

## 后续

- 公开上线前仍需远程 D1 `0013-0019`、生产 secrets、ChatGPT 托管身份联调、部署和线上 smoke。
- 下一轮应以真实 AI PM 多课程组合进行产品质量评审，而不是继续扩底层 Agent 架构。
