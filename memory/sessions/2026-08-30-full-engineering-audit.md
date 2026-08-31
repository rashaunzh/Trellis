# 2026-08-30 Trellis 全工程审计

## 目标

按用户要求，使用已安装的 `mattpocock/skills` 分析 Trellis 从建仓至当前的完整工程进程，而不是只分析 Course Intelligence 更新。

## 完成

- 盘点 37 个 skill，并按触发条件建立适用性矩阵。
- 审计产品演进、领域语言、模块深度、Working Tree、测试、文档、部署和研发流程。
- 运行 TypeScript、lint、209 个领域测试、production build 和 delivery precheck，全部通过。
- 输出 `docs/engineering/TRELLIS_FULL_ENGINEERING_AUDIT_2026-08-30.md`。

## 核心结论

- Trellis 是三个产品时代共存的、测试较强的本地工程原型。
- 当前最大交付风险是 48 个 tracked 修改和 104 个 untracked 项未形成版本。
- Course Intelligence 的 D1 catalog 和 canonical learning runtime 尚未成立。
- 下一步应先建立 fixed point、domain docs 和 decision map，再做两个端到端 tracer-bullet。

## 2026-08-31 补充审计

- CI 未运行 209 个领域测试、lint 或独立 typecheck。
- curriculum activation 非原子，可能留下半确认状态。
- legacy BYOK 明文存 D1，不能与可伪造 anonymous owner 一起公开部署。
- 每个学习 API 请求都逐条 seed legacy 内容包，造成大量无效 D1 写入。
- Drizzle journal 只到 0009，0010-0013 使用手工 SQL，迁移 authority 分叉。
- production dependency audit 为 5 个漏洞，其中 4 个 high；未自动强制升级。
- `docs/README.md` 仍把旧作品/Mastra 方向列为当前权威文档。

## 未执行

- 未修改产品代码。
- 未部署、迁移远程 D1 或配置真实模型。
- 未强行运行与当前审计无关的 skill。
