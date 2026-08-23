# Trellis Evidence Review Engine（v0.3）

> 状态：v0.3 已完成（规则版引擎落地 2026-08-23，LLM 版接口就绪）；v0.3-beta Proposal / Adjustment Engine 已进入 alpha（信号缺口回流、建议动作落库执行、确认/拒绝已落地 2026-08-23）
> 定位：本文说明「证据评审」这一核心机制的产品逻辑与工程实现，面向协作者与 GitHub 读者
> 关联：产品全景见 `product/TRELLIS_V0.2_PLATFORM_OVERVIEW.md`，架构基线见 `architecture/TRELLIS_V0.2_ARCHITECTURE.md`

## 一、Trellis 为什么不是聊天机器人

Trellis 表面上有"AI"、有"agent"，但它不是聊天机器人，也不需要是。

| | 聊天机器人 | Trellis |
| --- | --- | --- |
| 产品形态 | 对话框即界面，用户问、模型答 | 学习地图、周计划看板、活动抽屉、成长树、调整记录 |
| 判断方式 | 生成一段回答，好坏在对话中流转 | 产出结构化评审（verdict / 评分 / 信号覆盖 / 下一步建议），落库可追溯 |
| 记忆 | 在上下文里，会话结束即丢 | 在数据里：节点状态机、证据、复测间隔，跨会话持久 |
| 用户与 AI 的关系 | 直接对话 | AI 在后台按流水线工作，用户从不"和 agent 对话" |

三个本质差异：

1. **界面不是对话。** 用户面对的是"本周做什么 → 做了什么 → 证据被怎么评判"的看板，不是输入框。对话只是交互形式之一，Trellis 把它换成了对学习流程更有效的结构化界面。
2. **判断不是生成。** 评审引擎的每一次评估都产出固定的结构化 schema（`EvidenceAssessment`：verdict、confidence、score、证据卡片、信号评审、维度评分、下一步动作），并写入 `reviewJson` 持久化。这意味着每个判断都可以被审计、被重放、被测试——生成式回答做不到这一点。
3. **LLM 是可选实现，不是产品本体。** 当前评审可以用规则版（确定性、零成本）或 LLM 版（用户自配 API）完成，两者输出结构完全一致，产品主流程无感知。产品内核是"证据驱动的学习闭环"，LLM 只是其中一个可替换的评审器。

一句话：聊天机器人把"对话"当产品，Trellis 把"证据驱动的学习闭环"当产品。

## 二、Evidence Review Engine 解决什么问题

学习产品里三个普遍存在的失效模式：

1. **活动完成 ≠ 能力掌握。** 打卡式学习里，做完一个教程就"点亮"了知识点，但完成动作本身证明不了能力。
2. **自评不可信。** "我觉得我会了"无法被验证；学习者常常高估自己，也常常低估自己。
3. **调整无依据。** 计划调整凭感觉：学不动了就砍，时间不够就删，从不记录"为什么"。

Evidence Review Engine 用一条评审流水线回应这三个问题：

```
学习者提交材料（证据）
   → Evidence Agent  理解"提交了什么"（证据卡片 + 节点要求的能力信号）
   → Review Agent    判断"覆盖了哪些能力信号"（covered / partial / missing，每条带理由）
   → Scoring Agent   七个维度量化打分，加权合成总分
   → Proposal Agent  给出裁决后的下一步建议（修订 / 补前置 / 继续）
   → 全部结论回写数据层，驱动节点状态机与调整记录
```

核心主张：**能力是否成立，由证据说了算，而不是由"完成"或"自评"说了算。** 每次评审都留下结构化记录，学习路径的每一次变化都可以回答"为什么"。

## 三、四个 Agent 角色

| 角色 | 职责 | 关键产出 |
| --- | --- | --- |
| **Evidence Agent**（证据理解） | 理解学习者提交了什么材料，以及这个节点要求什么证据 | 证据卡片（`EvidenceCard`）：材料类型推断、摘要、提取要点、可读性 |
| **Review Agent**（评审） | 判断证据是否覆盖节点能力信号，给出接受/修订裁决 | 信号评审（`SignalReview[]`）+ 裁决（`verdict`）+ 置信度 |
| **Scoring Agent**（打分） | 把评审判断量化为可比较的分数 | 七个维度评分（`ReviewDimensionScore[]`）+ 加权总分 |
| **Proposal Agent**（建议） | 基于裁决与计划执行情况，提出下一步动作 | 调整建议（`AdjustmentSuggestion`）+ 证据层面的 `nextAction` |

四个角色不是四个可以对话的"人格"，而是**评审流水线上的四个职责边界**。每个职责都有明确的结构化输入输出，这保证了流水线可以被单独替换、单独测试。

## 四、当前工程如何实现这些角色

### 端口层（契约）

`lib/learning/agents/types.ts` 定义了四类端口：`PlannerPort`、`ActivityComposerPort`、`EvidenceEvaluatorPort`、`AdjustmentAdvisorPort`。设计约束写在文件头：

> 所有输入输出必须为结构化 schema，不能只是一段自然语言。未来替换成内嵌自研 agent 时，只替换实现，不改产品主流程。

### 角色 → 实现映射

| 角色 | 工程实现 | 说明 |
| --- | --- | --- |
| Evidence Agent | `agents/evidence-extractor.ts` + `domain/signals.ts` | 提取器推断材料类型（文本/网页/文档/代码/表格）、生成摘要与提取要点；能力信号数据层（`NODE_SIGNALS` 节点信号 / `CAPABILITY_SIGNALS` 信号目录 / `DEFAULT_SIGNALS` 通用兜底）定义"这个节点要求什么证据" |
| Review Agent | `agents/evidence-evaluator.ts`（规则版）+ `agents/llm-evidence-evaluator.ts`（LLM 版） | 规则版按关键词判定每个信号的覆盖状态；LLM 版调用用户自配的 OpenAI 兼容 API 评审，**失败自动回退规则版**，输出结构完全一致 |
| Scoring Agent | `agents/evidence-evaluator.ts` 的 `buildDimensionScores` + `weightedScore` | 七维度：材料可解析性、完成标准完整性、信号覆盖度、内容质量、证据可信度、能力证明强度、下一步明确性；加权合成 0-100 总分 |
| Proposal Agent | `agents/adjustment-advisor.ts`（规则版） | 证据被退回 → 修订重交或插入前置活动；完成率低 → 收缩周计划；有跳过节点 → 安排验证；正常 → 继续推进。`severity` 非 low 才记录为正式调整事件；alpha 版建议已携带具体缺失/部分信号（来自 `missingSignals` / `partialSignals`），动作随建议落库（`action_json`），用户可确认或拒绝 |

### 一次评审的调用链

`LearningService.reviewEvidence()`（`application/learning-service.ts`）：

1. 校验证据状态（`submitted` 才允许评估）
2. 读取用户 API 配置：已启用且配置了 key → LLM 版；否则规则版
3. `evidenceEvaluator.evaluateEvidence({ content, criteria, capabilitySignals, ... })` → 完整 `EvidenceAssessment`
4. 证据/活动状态机迁移：accepted → 活动进入 reviewed；needs_revision → 活动退回 in_progress（复测失败还会把节点降级回成长中）
5. 节点状态驱动：证据通过 → 普通活动直接验证；综合任务/首次复测进入"待确认"，由用户确认或纠正后才落定
6. 回写数据层：`extractedJson`（证据卡片）+ `reviewJson`（完整评审）持久化（迁移 `0010_evidence_review_engine.sql`）
7. `adjustmentAdvisor.suggestAdjustment()` → 建议携带具体信号缺口（`missingSignals` / `partialSignals` 合成进文案），动作列表随记录落库（`action_json`，迁移 0011）；非 low 级别建议记录为调整事件，用户可确认（执行动作）或拒绝，进入"调整记录"可追溯

前端 `/learn` 活动抽屉把评审结果按学习者视角呈现：证据卡片（我提交了什么）、已覆盖/待补充能力信号（证明了哪些能力、还缺什么）、评审维度、可信度说明、下一步建议。

## 五、v0.3 已实现

- **能力信号数据层**：从规则版评估器的硬编码关键词中抽出，成为独立的产品数据（`domain/signals.ts`），由内容模型 `node.signals` 引用
- **规则版评估器**：信号覆盖判定（covered/partial/missing，每条带理由）、七维评分与加权总分、verdict/confidence/nextAction
- **LLM 增强版评估器**：用户自配 OpenAI 兼容 API（base_url/key/model，key 只存服务端），结构化 JSON 输出，失败自动回退规则版
- **证据卡片提取**：材料类型推断、摘要、提取要点、可读性（`evidence-extractor.ts`）
- **评审结果持久化**：`extracted_json` / `review_json` 两列落库（迁移 0010），评审历史可回放
- **调整建议（alpha）**：修订重交 / 插入前置活动 / 收缩周计划 / 继续推进，带 severity 分级；建议含具体缺失/部分信号（Evidence Review 缺口回流），动作随记录落库（迁移 0011 `action_json`），用户可确认（执行动作）或拒绝（`/reject`），非 low 事件记录在案
- **前端展示层**：`/learn` 抽屉中文化展示（证据卡片、信号覆盖分组、评审维度、可信度说明、下一步建议）；调整记录区中文展示（类型映射、缺口信号、建议动作、确认/忽略）
- **测试**：`signals.test.ts`、`agents.test.ts`、`api-loop.test.ts` 等，`npm run test:domain` 78/78 通过

## 六、v0.3 尚未实现

| 未实现 | 现状 | 为什么留到后面 |
| --- | --- | --- |
| 外部链接/文件真实解析 | 只保存 URL，不抓取正文；`credibilityNote` 明确标注"尚未真实解析外部链接" | 需要独立的抓取/解析管线，属于内容理解能力，不阻塞评审闭环 |
| 复杂产物深度解析 | 代码/PDF/表格按文本近似处理 | 依赖文档解析基础设施，先验证文本证据评审的准确性 |
| 多 agent 编排框架（LangGraph 级） | 端口 + 顺序调用，无状态图/工具调用 | 当前单次评审流水线不需要；见第八节 |
| 评分公式实证标定 | 阈值与权重为产品预设（如 58 分接受线） | 需要真实学习者数据回测，先跑起来再校准 |
| 能力信号目录全量覆盖 | 覆盖内容包全部节点（14 节点，含历史节点） | 随内容包扩展逐步补齐语义描述 |
| 账号体系/鉴权 | 匿名 owner 隔离（非安全鉴权） | 演示与单机场景够用，多用户是另一条线 |

## 七、v0.3-beta：Proposal / Adjustment Engine（已进入 alpha）

v0.3 完成了评审流水线的"感知与认知"：证据被理解、被评审、被量化。自适应闭环的最后一步——根据评审结果**真正改变学习路径**——已进入 alpha：`adjustmentAdvisor` 产出携带具体信号缺口的建议，动作随记录落库，用户确认后**执行**（插入前置活动等），拒绝则记录为已忽略。

### alpha 已实现（2026-08-23）

| 能力 | 实现 |
| --- | --- |
| 缺口回流 | 建议文案携带 `missingSignals` / `partialSignals`（来自 Evidence Review 的信号评审），"为什么补强"具体到缺失的能力信号 |
| 动作落库 | 建议动作列表随记录持久化（迁移 0011 `action_json`），不再只存在于函数返回值 |
| 动作执行 | 用户确认建议后按动作类型真实执行（插入前置活动 / 修订 / 继续） |
| 确认/拒绝 | `confirm` 与 `reject` 双接口，proposed → accepted / rejected 状态流转，`/learn` 调整记录区中文展示 |

### contract 演进策略

- **短期（当前）**：`missingSignals` / `partialSignals` 走 **transient contract**——经 `AdjustmentInput` 传入 `adjustmentAdvisor`，合成进 `reason` / `summary` 文案落库，不单独落字段；完整信号评审仍可经 `evidence.reviewJson` 追溯。
- **中期**：若需要跨调整记录聚合"哪些信号反复缺失"这类分析，再把 missing/partial 信号结构化落库（新列或关联表）。
- **action_json 已先行落库**：动作是"建议如何执行"的机器可读部分，alpha 起就结构化持久化（迁移 0011），与文案分离。
- **LangGraph 仍后置**：见第八节，alpha 不引入编排框架。

alpha 之后，v0.3-beta 的剩余目标是把调整从"单次证据评审后的规则建议"升级为完整的 **Proposal / Adjustment Engine**：

| 维度 | alpha（现状） | v0.3-beta（剩余目标） |
| --- | --- | --- |
| 建议来源 | 证据评审裁决 + 信号缺口 + 完成率 + 前置缺口 | 综合证据裁决、完成率、前置缺口、复测结果、时间容量的调整决策 |
| 调整类型 | activity_replan / weekly_light / mastery_confirm | 覆盖全部四类：活动重排 / 周计划微调 / 路线修订 / 掌握确认 |
| 生效方式 | 建议 + 用户确认（确认后执行动作，可拒绝） | 分级生效：低风险自动、高风险用户确认 |
| 实现形态 | `RuleAdjustmentAdvisor` 单函数 + 动作落库执行 | 独立引擎：决策规则 + 可替换端口（复用 LLM 版评估器的"规则保底 + LLM 增强"先例） |

**为什么这一步代表 adaptive learning loop：**

自适应学习的完整闭环是"感知 → 判断 → 行动 → 新证据 → 再判断"：

```
感知    Evidence Agent    提取证据卡片与能力信号            （v0.3 已实现）
  ↓
判断    Review + Scoring  裁决与量化                        （v0.3 已实现）
  ↓
行动    Proposal/Adjustment Engine  改变路线、周计划与活动  （v0.3-beta，alpha 已打通建议→执行）
  ↓
反馈    新计划 → 新活动 → 新证据 → 重新进入评审              （闭环）
```

alpha 已打通"建议 → 执行"的第一步：系统基于证据流主动提出具体动作（插前置、修订、验证），用户确认后真实生效。但组合决策（缩容量、换路线、发起复测的联动）与分级自动生效仍在 beta 目标中。完整的"学习系统根据你的证据自适应"——系统对你的学习状态有判断，并据此采取行动，而不是等待你提问——正是 v0.3-beta 要补全的最后一环。

**agent runtime 替换空间（当前不是 LangGraph，但空间是设计出来的）：**

1. **端口契约已锁定**：四类端口 + 结构化 schema（`EvidenceAssessment` / `AdjustmentSuggestion`…），评审与调整的输入输出不依赖任何编排框架。
2. **替换路径明确**：把端口实现替换为 LangGraph 图（节点 = agent 调用，边 = 状态路由与工具调用），产品主流程、API、数据层、前端零改动——只换实现，不换契约。
3. **确定性底座保留**：即使未来上 LangGraph，规则版评审器仍作为回退与校验层存在——LLM 增强、规则保底，闭环永远可跑。
4. **v0.3-beta 的调整引擎按"可上图的决策节点"设计**：决策输入输出全部结构化，未来迁入状态图时只是把函数调用换成图节点，不需要重构决策逻辑本身。

## 八、为什么先用规则版，不直接上 LangGraph

v0.3-beta 的调整引擎遵循同样的原则：**先把决策逻辑用规则版固化、验证、测试，再考虑编排框架。**

1. **确定性优先。** 规则版同输入同输出，行为可以被回归测试锁定（`test:domain` 里有确定性用例）。LLM 输出天然不稳定，把它放在评审主链路上会引入无法复现的抖动——评审是"判定"而非"创作"，确定性是刚需。
2. **可解释、可审计。** 规则版的每条结论都有可逐条核对的依据（信号命中、维度得分、缺项列表）。作品集和产品初期最需要的是"每个判断都能说清楚为什么"，而不是更聪明的判断。
3. **成本与可用性。** 规则版零 API 依赖、离线可跑、演示不花 token；LLM 版失败时自动回退规则版，闭环永远可用。先保证产品闭环在任何环境都能跑通。
4. **契约先行，框架后置。** 端口层已经把结构化 schema 定死（`EvidenceAssessment` 等），未来换 LangGraph 或内嵌 agent runtime 时只替换实现、不改主流程。**接口边界比编排框架更早锁定价值**。
5. **数据与公式先于框架固化。** 能力信号和评分权重是产品决策，规则版把它们固化成了可讨论、可测试的数据（`signals.ts` 注释明确：改动节点信号即改变覆盖判定与评分，需产品评审）。先把"判什么、怎么算"定下来，再谈"谁在什么时候调谁"。
6. **复杂度按需引入。** LangGraph 解决的是多 agent 状态路由、工具调用、循环与并行——当前一次评审是一条线性流水线，引入状态图是纯成本。等出现"多轮往返评审""跨节点联合评审"这类真实需求时再上，才是合适的时机。

一句话：**规则版先把"证据驱动的学习闭环"这个假设验证成立，LangGraph 是规模化时才需要的复杂度。**
