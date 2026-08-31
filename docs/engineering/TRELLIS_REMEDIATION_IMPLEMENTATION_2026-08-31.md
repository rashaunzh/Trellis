# Trellis 审计修缮实施报告

## 结论

本轮没有继续扩页面功能，而是修复 Course Intelligence 从“演示切片”进入正式运行时的关键断点。当前本地版本可以完成：

`目标 → 有依据的课程取舍 → 用户确认 → 准确章节 → 轻反馈 → canonical 知识状态 → 下一行动`

本地功能 MVP 由 No-Go 提升为 **Conditional Go**。课程智能控制面、正式工作流和产品状态原子写入已经补齐；公开生产仍是 No-Go，剩余条件是远程 D1、托管环境配置、真实模型基准和线上 smoke。

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
13. 正式身份边界：生产学习 API 只接受 ChatGPT 托管身份；localhost 才允许显式测试 owner，并通过 owner alias 将旧短 owner 迁移到 canonical owner。
14. 正式 Mastra 工作流：intake 创建课程组合并暂停，用户确认后恢复；Mastra D1Store 保存工作流快照，D1 业务表保存唯一产品状态。
15. 原子激活：profile、weekly plan、canonical activities、node progress 和 curriculum 状态通过单个 D1 batch 激活，不再依赖跨表补偿写入。
16. 内部评审台：`/internal/course-intelligence` 支持候选查看、验证、拒绝和发布；未验证候选不能进入 published catalog。
17. 来源更新控制面：公开来源抓取限制协议、地址、跳转、类型、大小和超时；更新只形成 candidate 与影响记录，不静默覆盖已发布版本。
18. 模型运行治理：缓存键包含完整模型契约，损坏缓存自动重算；记录 token、延迟和失败，并执行输入、调用次数和 token 预算限制。
19. 统一当前状态：`/api/learning/current` 同时返回 curriculum、weekly plan、activities、knowledge states 和 workflow correlation。
20. 发布工程：新增秘密扫描、真实模型有限 benchmark、生产身份 smoke，以及跨 Windows/macOS/Linux 的 dev/start 脚本。

## 仍需完成

- 远程发布：Cloudflare CLI 当前未登录，远程 D1 `0013/0014/0015`、托管环境变量、部署和 production smoke 尚未执行。
- 真实模型质量门槛：benchmark 脚本已交付，但当前无 provider Key/模型配置，因此尚无真实结构化输出、成本和失败率结果。
- 托管身份联调：服务端已拒绝生产伪造 owner，并支持 ChatGPT 托管邮箱；仍需在真实托管请求中验证 header 注入与跨设备 owner 连续性。
- 旧模块收缩：旧 StagePath、历史 Evidence 和 Mastra demo 保留为兼容层，已退出正式调用链；需要先用真实历史数据确认无依赖，再分批删除。
- 内容运营：候选评审台和来源更新任务已可用，但首批 25-40 个代表来源仍需人工复核与持续维护，不能把“控制面完成”等同于“课程知识永远正确”。

## 验证结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run db:verify`：16/16 迁移通过空库执行。
- `npm run test:domain`：220/220 通过。
- `npm run build`：通过；仅保留既有 third-party direct eval 与 vinext 分类提示。
- `npm run acceptance:course-intelligence`：通过，含 390px 无严重横向溢出。
- `npm audit --omit=dev`：0 high、0 critical、2 low；均来自 Mastra 的间接 `@ai-sdk/provider-utils` 依赖，等待上游兼容升级，不自动改写依赖树。
