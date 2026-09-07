# 模型运行层与主备验证收口

日期：2026-09-01

## 目标

在进入产品功能优化前，完成真实模型 provider、主备降级、任务 contract、模型 Trace 与 Mastra/Decision 关联；不把外部模型变成 Trellis 基础功能的单点依赖。

## 已完成

- 新增 provider adapter 与 Qwen/GLM 能力 profile，支持 `json_schema`、`json_object` 和 `prompt_json` 覆盖。
- 目标理解、课程目录提取、章节节点映射成为三个版本化模型任务。
- 技术/协议失败可有限重试和切备用；grounding 失败进入评审，不能被备用绕过。
- 新增迁移 `0017_model_runtime_trace.sql`，模型 attempt 关联 request、workflow、decision、contract、失败分类、Eval、token 和延迟。
- 内部课程情报页新增“模型运行”视图；接口只返回脱敏运行信息。
- Mastra 课程分析和课程编排将模型 attempt 关联到正式 workflow 与 DecisionRecord。
- 真实 benchmark 改为直接测试三个模型任务，绕过缓存并输出质量、成本、延迟报告及主模型建议。
- 无模型时继续使用发布 catalog、Solver 和确定性学习推进，陌生材料保持待分析。

## 验证

- `npm run smoke:model`：Qwen 与 GLM 单样本结构化调用均通过。
- `npm run benchmark:model`：两者均通过 8/8 golden cases；Qwen 为 20,473ms / 6,924 tokens，GLM 为 35,115ms / 6,534 tokens。
- 依据相同质量门下的延迟，正式主备确定为 `qwen/qwen3.8-flash → glm/glm-5.3-flash`。
- 真实陌生课程正式链通过：目录提取与章节节点映射关联到同一个 Mastra workflow 和 DecisionRecord，candidate 在内部评审处暂停。
- 真实调用暴露并修复“一章多节点被误判重复”的领域错误；现在允许一个章节映射多个节点，只阻断重复章节节点对和缺失映射。
- `npm run check`：通过；18 个迁移、232 项领域测试、生产构建和 6 项构建契约均通过。
- `npm run acceptance:agentic-kernel` 与 `npm run delivery:precheck` 通过。
- `.env.local` 与 `.dev.vars` 仅本地保存且被 Git 忽略；秘密扫描通过，不记录或提交 API Key。

## 下一步

1. 远程 D1 应用 `0013-0017`，在托管 secret 中配置相同主备模型并完成身份与线上 smoke。
2. 不再扩张底层架构，进入“多课程取舍与方案检查”功能设计和优化。
3. 模型、provider 或 contract 版本变化时重新运行 smoke 与完整 benchmark。
