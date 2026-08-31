# ADR：Mastra 与 D1 的运行责任

状态：已确认
日期：2026-08-31

## 决策

Mastra 是 Trellis 的正式工作流编排运行时，内嵌 Cloudflare Worker，并通过官方 `@mastra/cloudflare-d1` adapter 保存工作流快照。

- Mastra 保存 run、当前步骤、suspend/resume 和重试所需快照。
- Trellis D1 业务表保存课程、路线、计划、行动、反馈和知识状态。
- 工作流步骤调用 application module，不直接拥有业务 SQL。
- 人工确认通过 curriculum ID 找到关联 run，重复确认必须幂等。
- 课程激活使用一个 D1 batch，不能留下半激活业务状态。

## 不采用

- 独立 Mastra 服务：当前会增加身份同步和运维复杂度。
- Temporal：可靠性能力超过当前单用户 MVP 所需。
- Mastra 快照作为学习状态真相：会造成页面读模型与工作流状态双写竞争。

## 兼容

旧作品工作流保留为测试和历史实现，不再由正式 `/api/learning/mastra-runtime` 执行。0015 之前的课程草案没有工作流关联时，确认接口通过幂等兼容路径激活。
