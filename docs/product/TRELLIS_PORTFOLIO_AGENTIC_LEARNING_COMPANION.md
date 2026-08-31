# Trellis 作品级目标：Agentic Learning Companion

> 状态：作品级开发基线
> 日期：2026-08-26
> 对标参考：EchoMind 的工程完整度；Trellis 的原创主线是 Learning Situation-first dynamic learning adaptation

## 一句话

Trellis 是一个基于 Mastra Workflows 的 Agentic Learning Companion。它先识别学习者处境，再规划完整学习阶段，并在目标、资料、时间精力、行为和证据变化时动态调整学习路径，最终帮助 AI PM 转型小白产出可评审作品。

## 为什么不是普通学习 App

普通学习 App 通常是：

```text
目标 -> 计划 -> 打卡 -> 完成
```

Trellis 的作品级主链路是：

```text
Learning Situation
-> Material Intelligence
-> Capability Signal Map
-> Stage Path
-> Dynamic Orchestration
-> Evidence-to-Mastery
-> Human Confirmation
-> Learning Memory
-> Decision Trace
-> Eval / Monitor
```

核心判断不是“学什么”，而是：

- 这个目标现在是否足够清楚；
- 这份资料适不适合这个人、这个阶段和这个时间窗口；
- 当前时间精力是否支撑原计划；
- 用户是在理解、拖延、重启、只输入不产出，还是证据真的失败；
- 当前行动应该澄清、校准、理解、练习、产出、补强、复测还是包装作品；
- 哪些判断可以自动调整，哪些必须用户确认。

## 作品级模块

1. **Learning Situation Engine**
   - 识别目标清晰度、资料状态、学习阶段、时间容量、精力状态、行为模式和证据质量。

2. **Material Intelligence Engine**
   - 判断资料为 `core` / `reference` / `supplement` / `not_recommended`。

3. **Capability & Stage Path Engine**
   - 规划 AI PM 转型启动阶段 6-8 周路径，包含里程碑、能力信号和最终作品。

4. **Mastra Workflow Runtime**
   - 用 Mastra `createWorkflow/createStep` 包装核心链路，便于 Studio 展示、HITL 和后续 observability。

5. **Dynamic Sprint Simulator**
   - 可复现演示前三周中的资料错配、容量下降、精力低、证据失败和作品推进。

6. **Evidence-to-Mastery Engine**
   - hard evidence 才能推动掌握；soft signal 影响下一步；behavior signal 影响节奏。

7. **Learning Quality Monitor**
   - 汇总计划完成率、证据通过率、资料误配、反复缺口和 fallback 状态。

8. **Evaluation Suite**
   - 评估 situation decision、material fit、stage path、dynamic adjustment 和 artifact loop。

9. **Trellis Core Kernel**
   - 聚合现有规则引擎和 tools，输出结构化决策，不直接写数据库。

10. **Decision Trace / Learning Memory / Tool Layer**
   - Trace 解释每次判断；Memory 区分 hard/soft/behavior/material/artifact/decision；Tool Registry 标准化内部能力。

## 当前实现切片

本轮已完成作品级第一切片：

- `LearningSituation` 增加 `capacityState`、`energyState`、`behaviorPattern`、`evidenceQuality`、`nextBestMove`。
- `runDiagnostic().analysis` 返回 `stagePath` 和 `dynamicSimulation`。
- 新增 Mastra workflow 对象 `trellisLearningSituationWorkflow`。
- 新增 Mastra demo 命令 `npm run demo:mastra`，可运行真实 workflow 并输出固定 trace / HITL / fallbackMode。
- 新增 Mastra runtime 实例 `trellisMastraRuntime` 与 `/api/learning/mastra-runtime`，`/learn` 可直接运行并展示 10-step workflow trace、step outputs、HITL checkpoints、resume contract 和 runtime readiness。
- 新增 Mastra CLI / Studio 入口 `src/mastra/index.ts`，以及 `npm run mastra:dev` / `npm run mastra:studio` 脚本。
- `/learn` 已展示 Learning Situation Report、Material Fit、StagePath、DynamicSimulation、Quality Monitor 和 Eval。
- `/learn` 入口已从普通 goal textarea 升级为作品级 intake：作品方向、阶段成果、时间容量、精力状态、当前基础和资料适配会共同进入诊断；默认使用 `adaptive_existing_content`，避免 UI 体验停留在 legacy planner。
- `/learn` 诊断后提案页已重构为 Calm OS 风格的用户旅程：Situation → Material Fit → Goal Calibration → Stage Path → Simulation → Confirm。
- 本周看板 task card 已升级为 Action Card：展示活动状态、证据状态、Capability/Artifact 类型、证据要求、待确认调整和下一步动作。
- 新增 `/api/learning/quality` 与 `/api/learning/eval`。
- 新增 `/api/learning/artifact` 与 `/learn` 的“阶段作品闭环”，可将 AI Agent 产品 PRD v1 生成为正式 `integrated_task`。
- 新增 `/api/learning/memory`，返回 Learning Memory Snapshot。
- 新增 Trellis Core Kernel、Decision Trace、Learning Memory Model 与 Tool Registry。
- Mastra workflow demo 已扩展为 10 步，覆盖 artifact-to-next-stage。
- 作品证据会复用现有 Evidence Review；通过后进入 `pending_confirmation`，需要用户确认掌握，不会自动把作品生成等同于掌握。
- 用户确认作品掌握后，系统会生成 `route_revision proposed` 下一阶段建议，方向为作品包装、评测深化和 10-15 分钟项目讲述。
- 用户采纳该 `route_revision` 后，`/learn` 会展示 `NextStagePlan`，并将作品包装、评测深化和项目讲述三个模块生成正式学习活动。
- 三个下一阶段模块已带作品级 rubric：作品包装评审读者可理解性和架构证据，评测深化评审 eval/fallback/失败样例，项目讲述评审 10-15 分钟面试讲法和边界表达。
- 新增 `artifactIteration` 读模型：从正式活动、证据、调整建议和 NextStagePlan 推导作品当前状态（待生成、待提交 v1、需修订、待掌握确认、下一阶段待采纳、作品包装中）、修订轮次、缺失 rubric、版本历史和下一步动作。
- Eval suite 从 10 项扩展到 12 项，新增 `artifact_revision_loop` 与 `rubric_guardrail`，明确验证作品不是一次提交即完成。
- 新增浏览器验收脚本 `npm run acceptance:next-stage`，会准备固定 demo 状态、打开 `/learn` 检查 Next Stage 面板和 rubric，并保存截图 `docs/learn-next-stage-rubric.png`。
- 新增作品级全链路验收脚本 `npm run acceptance:portfolio`，覆盖 Learning Situation、StagePath、DynamicSimulation、artifact API 读模型、Quality、Eval 和 Mastra runtime trace，并保存作品级截图。
- 新增作品级领域测试，领域测试达到 190/190 通过。

## 当前边界

- 当前安装的是 `@mastra/core@1.62.0`，并已补 Mastra CLI / Studio 入口；仓库已有 Studio 截图素材与截图脚本，但作品集验收以 `npm run demo:mastra`、`/api/learning/mastra-runtime` 和浏览器 acceptance 为准。若更换机器，需复跑 `npm run mastra:dev` 与 `scripts/legacy/mastra-studio-shot.mjs` 更新截图。
- Mastra runtime 已有作品级 report 语义：`runId` / `traceId` / `stepOutputs` / `hitlCheckpoints` / `resumeContract` / `runtimeReadiness`。当前 `resumeContract` 指向 Trellis API 状态机恢复，不宣称 Mastra 原生长任务持久恢复。
- Artifact loop 已完成正式闭环切片：阶段作品可生成活动、提交 hard evidence、进入评审和掌握确认；确认后能提出下一阶段建议；采纳后会进入下一阶段行动视图并生成带 rubric 的正式活动。当前已能通过 `artifactIteration` 表达多轮修订状态和版本历史；后续仍需更完整的阶段版本管理。
- Tool Layer 目前是内部 tools 标准化，不是外部 MCP 工具生态。
- Learning Memory 目前是聚合读模型，不是向量记忆或跨设备智能检索。
- 所有模型能力保持可降级：无 API key 时规则版 fallback 仍可运行。

## 作品级验收

- 能输入 AI PM 转型学习处境；
- 能输出完整 6-8 周阶段路径；
- 能自动演示前三周动态调整；
- 能将阶段作品作为 hard evidence 评审；
- 能将下一阶段作品包装、评测深化和项目讲述转成带 rubric 的正式活动；
- 能展示作品迭代状态、修订轮次、版本历史、缺失 rubric 和下一步动作；
- 能通过 Mastra workflow runtime 展示主链路，并可用 Studio 截图辅助讲解；
- 能输出 eval report 和 quality monitor；
- 能运行 `npm run acceptance:next-stage` 做浏览器级验收；
- 无 API key 时规则版 fallback 仍可运行；
- 文档能讲清 AI 用在哪、规则用在哪、HITL 用在哪、eval 如何证明质量。
