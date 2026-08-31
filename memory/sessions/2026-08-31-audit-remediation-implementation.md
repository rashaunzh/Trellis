# 2026-08-31 审计修缮实施

## 本次目标

依据 2026-08-30 全工程审计，把 Course Intelligence 从演示纵向切片推进到可恢复、可验证的本地正式运行时，不继续扩张页面能力。

## 已完成

- D1 `PublishedCourse` 仓储返回 genome、tags 和 mappings；编排器停止回读 baseline mappings。
- 内容包和课程目录增加 release marker，停止每请求重复 seed 写入。
- 新增 `0014_canonical_learning_runtime.sql`：活动 canonical 引用、curriculum 激活状态、knowledge state、learning signal、course candidate 和 seed release 表。
- curriculum 激活支持 activating/active/failed 与失败重试；重复确认保持幂等。
- 新增 `/api/learning/current` 与 `/api/learning/runs/:id/feedback`。
- `/learn` 轻反馈直接写 canonical signal；`/grow` 直接读 canonical knowledge state。
- 新材料模型分析保存为 candidate，未经发布不能进入正式组合。
- 停用浏览器 BYOK 写入与旧 D1 明文 Key 读取；500 响应脱敏。
- Next 升级至 16.3.3，生产审计为 0 high / 0 critical / 2 low。
- 新增 migration manifest 与空库执行检查；统一 `npm run check` 并接入 CI。
- 浏览器验收增加 canonical 引用、轻反馈、下一章节推进和 390px 无严重横向溢出。
- 宿主认证邮箱通过稳定散列映射为 owner id，不在学习状态表中保存明文邮箱。
- candidate 增加受控发布规则与 D1 batch 写入；低置信和不完整映射不能进入 published catalog。

## 验证

- `npm run check`：通过。
- migration chain：15/15。
- 领域测试：212/212。
- 构建产物测试：6/6。
- `npm run acceptance:course-intelligence`：通过。
- `npm run delivery:precheck`：通过。
- 本地页面：`http://127.0.0.1:5179/learn`。

## 开放问题

- 宿主身份映射已接入，但独立账号、完整会话授权和跨设备迁移尚未实现。
- candidate 服务端发布闸门已实现；内部评审台、来源自动更新和影响审查尚未实现。
- 激活通过幂等状态恢复，尚未成为跨 curriculum 与 legacy weekly plan 的单 D1 事务。
- 旧 StagePath、Mastra/Eval、Evidence 等兼容代码尚未物理删除。
- 远程 D1 0013/0014、生产环境变量、线上部署和 production smoke 未执行。

## 证据

- `docs/engineering/TRELLIS_REMEDIATION_IMPLEMENTATION_2026-08-31.md`
- `docs/acceptance-course-intelligence-learn.png`
- `docs/acceptance-course-intelligence-grow.png`
- `docs/acceptance-course-intelligence-mobile.png`
