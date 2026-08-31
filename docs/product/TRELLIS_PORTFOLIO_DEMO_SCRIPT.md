# Trellis 作品集演示脚本

> 日期：2026-08-27
> 时长：10-15 分钟（含演示操作与 Q&A 弹性）
> 受众：AI PM 面试官、作品集评审者、AI 产品协作者
> 配套文档：[作品集目标](TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md) / [Mastra Runbook](../engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md) / [截图索引](TRELLIS_PORTFOLIO_SCREENSHOTS.md)

## 演示准备

```bash
npm ci
npm run dev
```

启动后访问（以实际端口为准，Vite 默认 5173）：

```text
http://127.0.0.1:5173/learn
```

本讲稿使用固定演示输入（与浏览器验收脚本 `npm run acceptance:next-stage` 一致）：

```text
目标：我是转 AI PM 的小白，希望完成一个 AI Agent 产品 PRD 作品集项目
时间：每周 240 分钟
资料：选择一份（如 Machine Learning Crash Course 或 OpenAI Evals）
偏好：build_first
```

---

## 0:00-1:30 一句话定位与问题洞察

> 讲：Trellis 不是一个学习计划工具，而是一个 Learning Situation-first 的动态学习适应系统。

普通学习产品默认四件事成立：**目标稳定、资料可靠、时间固定、执行线性**。真实学习全都不成立：

- 目标是在学习过程中才变清楚的；
- 资料可能太深、太营销、和主线无关；
- 每周时间和精力会变；
- 用户可能只输入不产出；
- 完成任务不等于掌握；
- 作品必须经过证据评审。

所以 Trellis 的主链路不是 `goal -> plan -> 打卡 -> 完成`，而是：

```text
Learning Situation
-> Material Intelligence
-> Capability Signal Map
-> Stage Path
-> Dynamic Orchestration
-> Evidence-to-Mastery
-> Human Confirmation
-> Eval / Monitor
```

## 1:30-3:00 为什么不是普通 Learning Planner

> 讲：普通 planner 回答「学什么、什么时候学」；Trellis 回答三个持续变化的问题。

1. **为什么现在学这个？**（处境判断，而不是默认排课）
2. **怎么证明自己真的学会了？**（证据评审，而不是打勾）
3. **失败、拖延、资料不合适时，下一步该怎么调整？**（动态编排，而不是重新排一次）

打开 `/learn`，输入目标与资料，点「开始诊断」。强调：**系统第一件事不是排计划**，而是先判断学习处境——目标是否清楚、资料是否适合、时间是否够、当前最该做什么。

## 3:00-4:30 Learning Situation-first

> 讲：诊断结果页展示「Trellis 当前判断 / 为什么这么判断 / 下一步」。

指给评审看三个输出：

- **Learning Situation**：目标清晰度、资料状态、时间容量、精力状态、行为模式、证据质量，以及 `nextBestMove`；
- **Material Review**：资料被判定为 `core` / `reference` / `supplement` / `not_recommended`，并给出来源可信度与个人适配两个分数；
- **Decision Trace**：`输入 -> 信号 -> 工具步骤 -> 决策 -> HITL -> 状态变更`，每一步为什么发生。

关键话术：**这些判断是结构化的、可解释的、可测试的，不是聊天生成的文本。**

## 4:30-6:00 StagePath + Dynamic Adjustment

> 讲：系统生成完整 8 周阶段路径，不只是本周任务。

- **StagePath**：8 周、里程碑、能力信号、最终作品（AI Agent 产品 PRD v1）；
- **Dynamic Simulation**：前三周的动态调整演示——资料错配、容量下降、精力低、证据失败、作品推进，各触发一次调整；
- 高风险变化只生成 proposed 调整，等待用户确认，不静默改写。

话术：**「路径是版本化的；改变主路径必须用户确认。周计划半稳定，普通完成不重排。」**

## 6:00-7:30 Artifact Loop

> 讲：作品不是「写完就算」，它进入正式闭环。

在已确认页调用阶段作品：

```bash
curl -X POST http://127.0.0.1:5173/api/learning/artifact
```

- 系统把「AI Agent 产品 PRD v1」生成为正式 `integrated_task` 学习活动；
- 提交作品证据 → 进入 Evidence Review → 评审通过后进入 `pending_confirmation`；
- 用户确认掌握后，系统提出下一阶段 `route_revision proposed`（作品包装、评测深化、项目讲述）。

> 演示技巧：如果时间紧，可以直接运行 `npm run acceptance:next-stage` 准备固定状态，截图见 `docs/learn-next-stage-rubric.png`。

## 7:30-9:00 Evidence-to-Mastery

> 讲：掌握只能由 hard evidence 推动。

- **hard evidence**（作品、代码、可复核产出）才能推动节点到 `validated`；
- **soft signal**（自评、困惑、反思）只影响下一步判断，不能直接验证；
- **behavior signal**（低完成率、只输入不产出）影响节奏和粒度；
- 作品通过评审 ≠ 自动掌握：还需要用户确认（HITL）。

采纳下一阶段建议后，`/learn` 展示 `NextStagePlan`，并在本周看板生成三个**带作品级 rubric** 的正式活动：

- 作品包装：评审读者可理解性与架构证据；
- 评测深化：评审 eval / fallback / 失败样例；
- 项目讲述：评审 10-15 分钟面试讲法与边界表达。

## 9:00-10:30 Mastra Runtime / Fallback

> 讲：Trellis 用 Mastra Workflows 承载 agentic workflow，但领域判断留在规则引擎。

运行：

```bash
npm run demo:mastra
```

指给评审看 10-step trace：

```text
assessSituation -> auditMaterials -> mapCapabilities -> planStagePath
-> simulateDynamicAdjustment -> createArtifactTask -> reviewArtifactEvidence
-> waitForMasteryConfirmation -> proposeNextStage -> summarizeQuality
```

讲解重点：

- `humanInTheLoop: true` 出现在阶段规划、动态调整、作品任务、掌握确认、下一阶段提案 5 个节点——**哪些判断不能静默自动改，系统是显式声明的**；
- `fallbackMode: "rule"`——**无 API key 时规则版闭环仍可运行**；LLM 只是增强，不是依赖；
- Mastra 只承载 step 边界与 trace；持久状态仍由 Trellis service / D1 承担。

也可以在 `/learn` 已确认页运行 Mastra runtime，展示同样的 trace。

## 10:30-12:00 Eval 如何证明质量

> 讲：用评估报告证明学习链路质量，而不是只展示生成文本。

```bash
curl -X POST http://127.0.0.1:5173/api/learning/eval
```

当前 eval 是**规则版、确定性、无 API key 可运行**，覆盖五个维度：

- situation decision：处境判断是否合理；
- material fit：资料适配判断是否一致；
- stage path：阶段路径是否完整；
- dynamic adjustment：动态调整是否触发正确；
- artifact loop：作品闭环是否完整。

话术：**「eval 证明的是产品链路是否完整，不是模型聪明程度——这正是作品集要讲清楚的生产思维：判断可复现、可回归、可降级。」**

## 12:00-13:00 边界诚实

> 讲：主动说边界，比被追问更有说服力。

**当前已完成**：

- Learning Situation-first 诊断与决策；
- Material Review（core / reference / supplement / not_recommended）；
- Capability / Signal Map（existing content 复用 + generic fallback）；
- 8 周 Stage Path + 前三周 Dynamic Simulation；
- Artifact Loop 正式闭环 + NextStagePlan + 作品级 rubric；
- Evidence-to-Mastery（hard evidence 才推动掌握）；
- Quality Monitor / Eval / Learning Memory / Decision Trace / Tool Registry；
- Mastra workflow runtime（10-step）。

**当前没有宣称完成**：

- 完整 autonomous agent runtime（当前是结构化 agent ports + 规则引擎 + LLM 增强接口）；
- Mastra Studio 截图（CLI 入口已接，本机 CLI 下载未完成）；
- 多轮作品迭代与完整阶段版本管理；
- 完整商业化学习平台 / 泛领域课程平台；
- 外部 MCP 工具生态（当前是内部 Tool Registry）；
- 向量记忆 / 跨设备智能检索（当前是聚合读模型）。

## 13:00-15:00 Q&A 弹性（可选）

预留 2-5 分钟。常见问题与回答要点：

- **「AI 用在哪？」** 判断、解释、建议、证据增强；规则版保证可降级可测试。
- **「为什么用 Mastra？」** 承载 workflow runtime、step 边界与 trace；领域判断仍在规则引擎，框架服务于判断。
- **「下一步做什么？」** Decision-driven Activity Insertion：让学习决策真正改变首周计划（资料校准 / 路线修正活动），再补资料输入增强与 soft signal。

## 结束语

Trellis 的原创点不是「用了多个 agent」，而是把学习过程建模成**动态判断系统**：目标、资料、时间、精力、行为和证据都会变化，系统必须持续判断下一步，而不是一次性生成计划。证据驱动掌握、判断可解释、变化需要确认、无 key 可降级——这四条是作品集最想证明的工程判断力。
