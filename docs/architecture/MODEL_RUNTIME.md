# Trellis 模型运行架构

## 责任边界

模型负责目标语义、陌生课程目录和章节节点映射的候选判断。发布课程、知识节点、课程组合约束、学习状态和最终写入仍由 D1、确定性校验与确认流程负责。Mastra 保存工作流暂停和恢复状态，不替代业务事实。

```text
任务 contract
→ primary provider
→ schema 校验
→ grounding 校验
→ candidate / DecisionRecord
→ Mastra 暂停确认
→ D1 应用
```

技术或协议失败可以切换备用模型；虚构章节、未知节点、来源不足和低置信属于业务失败，进入评审，不能靠备用模型绕过。

## 模型任务

- `learning_intent.v1`：解释目标并选择发布图中的节点。
- `course_outline.v1`：从用户提供的公开目录中提取真实章节。
- `unit_node_mapping.v1`：提出章节到 canonical node 的映射、深度和置信度。

所有任务使用版本化 Zod contract。模型输出不能直接发布，也不能创造课程、章节或节点 ID。

## 主备配置

Qwen 与 GLM 使用两套独立官方 OpenAI-compatible API。配置放在服务端环境变量：

```text
TRELLIS_AI_PRIMARY_PROVIDER
TRELLIS_AI_PRIMARY_BASE_URL
TRELLIS_AI_PRIMARY_MODEL
TRELLIS_AI_PRIMARY_API_KEY
TRELLIS_AI_PRIMARY_STRUCTURED_OUTPUT

TRELLIS_AI_FALLBACK_PROVIDER
TRELLIS_AI_FALLBACK_BASE_URL
TRELLIS_AI_FALLBACK_MODEL
TRELLIS_AI_FALLBACK_API_KEY
TRELLIS_AI_FALLBACK_STRUCTURED_OUTPUT
```

`STRUCTURED_OUTPUT` 可选 `json_schema`、`json_object` 或 `prompt_json`。不配置时按 provider profile 推断；若具体模型不支持 strict schema，应显式覆盖。密钥不得进入 Git、D1、日志或 Trace。

本地 `npm run benchmark:model` 自动读取被 Git 忽略的 `.env.local`；本地 Worker 使用同样被忽略的 `.dev.vars`。生产环境继续使用托管平台 secret，不上传这两个文件。

主备模型由目标环境配置及版本绑定的真实基准决定。历史模型名、延迟或通过数量不作为当前生产可用性证明；每次模型或合同升级需重新验证。本次仓库整理未运行付费模型基准。

可选配置 `*_INPUT_USD_PER_MILLION` 和 `*_OUTPUT_USD_PER_MILLION`，让 benchmark 估算成本。未提供价格时按质量门、延迟和 token 使用比较。

## Benchmark 与发布

`npm run smoke:model` 先为每个槽运行一个真实结构化样本；`npm run benchmark:model` 再分别绕过缓存测试两个槽，覆盖目标理解、完整/不完整/双语目录、提示注入和章节映射。报告写入忽略提交的 `outputs/model-benchmark/`。

发布要求：结构与 grounding 全部通过，安全关键断言全部通过，非关键语义断言至少 85%。两者均过门后再根据成本、延迟和 token 选择主模型；未过门的模型不能进入 production fallback。

## Trace

内部 `/internal/course-intelligence` 的“模型运行”页展示 request、workflow、decision、primary/fallback attempts、失败分类、校验、token 和延迟。Trace 不返回 prompt、API Key、材料正文或模型思考过程。

模型完全不可用时，已发布 catalog、已确认路线、Solver 和确定性学习推进继续工作；陌生材料保持“待分析”。
