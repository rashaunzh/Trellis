# 2026-09-13 版本 12 私有发布与 Coding Agent 交接

用户要求报告重构进度、整理可交给 coding agent 的计划，并按指定 SHA 发布版本 12。未扩展功能或修改个人路线、偏好。

## 发布结果

- Sites 项目：`appgprj_6a72003abefc8191a4bd0c79702ee892`。
- 源码：`61a2b0826120b4921d6e8418ace98c5628b6d00a`；`47ee9ee` 仅交接文档，不纳入构建。
- 版本：12；版本 ID：`appgprj_6a72003abefc8191a4bd0c79702ee892~appgver_6749334c13288191b0d004ebd8701e62`。
- 部署 ID：`appgdep_6aa6affa4a1c8191870bb74f5dd1131f`。
- 平台最终状态：`succeeded`；站点：`active`；环境 revision：`2`。
- 平台完成时间：2026-09-13 14:16:21 UTC（北京时间 22:16:21）。
- 线上地址：https://ai-learning-os.rashaunzh.chatgpt.site 。

## 构建与配置证据

在 `outputs/release/v12-source` 隔离工作树构建，复用已安装依赖。一次因依赖链接位置不正确而未启动构建，修正后 `npm run build` 完成，内含 `validate:artifact`，验证 ESM Worker `default.fetch` 和 hosting manifest。临时 Git 凭证仅用于本次进程，未写入仓库或持久 Git 配置。

精确 SHA 已推送至平台源码库 main，随后 `git rev-parse --verify HEAD` 输出上述完整 SHA。没有回退 GitHub 分支。按版本 11 布局打包 `dist/` 与根 `.openai/hosting.json`；未包含 memory、源码树、本地环境文件或 node_modules。

- 本地归档：`outputs/release/trellis-61a2b08.tar`。
- 本地文件 SHA256：`4972a2e7066b441b83ffd2198fd244bbed57d17622e39e816fc9ff7dfea925fb`。
- 平台归档记录：117 文件，13,281,280 字节；平台返回 content_hash：`sha256:c030fb0ad9216bc1b767aa2af25b20c3ade7d0bd8110e134041784af26e60cb6`。分别保留本地文件校验和与平台存储标识，不将两者视为相同值。

发布前只读核对环境 revision 2；部署后平台再次返回 revision 2。未调用环境更新、权限变更、迁移或重置。发布后权限仍为 custom、仅一个 owner、无允许组；数据库绑定仍为 DB。只读 overview 列出 50 张表（含 Mastra 运行时表），不把该数量解释为用户所说的 46 张业务表发生迁移；本次没有核对迁移账本或写入业务记录。

未认证 `/learn` 只读请求返回 HTTP 403。此结果仅记录访问响应，不证明真实身份登录、页面使用和业务保存已通过。

## 重构与后续计划

已交付 [Coding Agent 交接与计划评估](../../docs/engineering/TRELLIS_CODING_AGENT_HANDOFF_2026-09-13.md)：已有实现与未验收分开；六项任务分别覆盖真实路线、章节开始、反馈/阶段出口、调整恢复、工作台入口、真人修改复测。依据已确认收缩 PRD，完整课程交付计划仍暂停，不再同时推进两套范围。

历史完整工程门已有通过记录；本轮重新执行的是指定 SHA 生产构建和产物检查，没有重新跑完整领域/浏览器套件。最近本地浏览器 31 项通过仍不能代替路线语义评审或真人使用。

准确下一步：coding agent 执行交接 T1，旧失败案例回归并补新保留案例；并行条件具备时由所有者真实登录，完成学习、反馈、退出重进及恢复走查。随后按 T2–T6 修复并留证。发布成功不等于产品质量放行。
