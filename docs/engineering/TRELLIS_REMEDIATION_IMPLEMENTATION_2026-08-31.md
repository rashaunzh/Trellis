# Trellis 审计修缮实施报告

## 结论

本轮没有继续扩页面功能，而是修复 Course Intelligence 从“演示切片”进入正式运行时的关键断点。当前本地版本可以完成：

`目标 → 有依据的课程取舍 → 用户确认 → 准确章节 → 轻反馈 → canonical 知识状态 → 下一行动`

本地功能 MVP 由 No-Go 提升为 **Conditional Go**；公开生产仍是 No-Go，条件是账号边界、远程 D1 和部署 smoke 尚未完成。

## 已修复

1. D1 published catalog 成为运行时真相：来源、课程版本、章节映射均从 D1 解析，编排器不再调用 baseline mapping。
2. baseline 只负责版本化首次发布：legacy content pack 与课程目录都有 release marker，冷启动不再重复数百次写入。
3. canonical 学习状态落库：活动保存 curriculum、course version、unit 和 canonical node；成长地图不再用标题匹配推断状态。
4. 轻反馈成为正式 `LearningSignal`：课程测试、理解、卡住和判断可更新 `has_signal`，不把完成自动判为掌握。
5. 激活可恢复：curriculum 增加激活状态，失败可以重试；重复确认不产生重复路线。
6. 候选内容隔离：模型解析的新课程先进入 candidate 存储，不能静默进入已发布目录。
7. 模型安全收口：停用浏览器 API Key 写入，旧评审链不再读取 D1 明文 Key；500 错误不向前端泄漏内部信息。
8. 迁移与 CI：新增 0014、显式 migration manifest、空库执行检查；CI 运行 typecheck、lint、迁移、212 项领域测试和 production build。
9. 供应链：Next 16.2.6 升级到 16.3.3，production audit 从 4 high 降到 0 high、0 critical。
10. 浏览器验收：桌面与 390px 覆盖课程确认、canonical 引用、轻反馈、成长状态、工作台和下一准确章节。
11. 身份边界：优先使用宿主注入的认证邮箱生成稳定、不可逆的 owner id；匿名请求继续使用随机 owner，避免把邮箱直接写入学习表。
12. 候选发布闸门：内部服务只允许引用完整、置信度达标且无缺失节点的候选课程进入 published catalog；发布与章节映射在同一 D1 batch 中完成。

## 仍需完成

- 真实身份与授权：已支持宿主认证身份的稳定 owner 映射，但尚无独立账号、会话授权和跨设备身份迁移。
- 发布工作流：已有服务端受控发布闸门；内部评审界面、来源更新和影响审查还未交付。
- 原子激活：当前通过激活状态与幂等重试恢复；跨 legacy plan 与 curriculum 的单事务仍未实现。
- 旧模块物理删除：旧 StagePath、Mastra/Eval 展示和历史 Evidence 代码仍为兼容层，已退出正式页面但尚未删除。
- 远程 D1 `0013/0014`、托管环境变量、线上 smoke 和真实模型成本/失败率监控。

## 验证结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run db:verify`：15/15 迁移通过空库执行。
- `npm run test:domain`：212/212 通过。
- `npm run build`：通过；仅保留既有 third-party direct eval 与 vinext 分类提示。
- `npm run acceptance:course-intelligence`：通过，含 390px 无严重横向溢出。
- `npm audit --omit=dev`：0 high、0 critical、2 low。
