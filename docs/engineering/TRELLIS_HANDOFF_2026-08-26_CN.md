# Trellis 中文工程交接 — 2026-08-26

## 1. 当前一句话

Trellis 现在不是一个普通待办工具，也还不是完整自主 Agent。它当前已经完成的是：

```text
目标输入
-> 资料分析
-> 资料是否适合当前用户
-> 能力拆解
-> 下一步学习决策
-> 路线确认
-> 每周学习活动
-> 证据提交
-> 证据评审
-> 调整建议
-> 状态变化
```

更准确的定位是：

```text
证据驱动的动态学习辅助系统。
```

它的核心价值不是“帮用户记任务”，而是持续回答三个问题：

1. 为什么现在学这个？
2. 怎么证明自己真的学会了？
3. 失败、拖延、资料不合适时，下一步该怎么调整？

## 2. 用户与产品方向

当前产品方向已经修正：

- Trellis 不是 AIPM 转型专用工具。
- AIPM 学习只是第一个 demo/content pack。
- 最终方向是更通用的学习辅助系统。

典型用户画像：

- 有大致学习目标，但目标不一定清楚或正确。
- 手上有一些课程、文章、项目、培训资料，但不确定是否靠谱。
- 有学习动机，但不知道先学什么、怎么判断自己学会、什么时候该调整。
- 像当前项目 owner 一样，是瞄准 AI PM 的小白，需要系统不仅执行，还要解释为什么。

产品原则：

- 不把用户逼进复杂分类表单。
- 用户主要看到：目标、资料、学习活动、能力进展、证据、评审、下一步。
- Track / Domain / Capability / Signal 可以作为内部结构，不应全部压给用户选择。
- 学习不是只看完成，也不是只看考试；理解、解释、困惑、反思、产出、复测都可以成为信号。
- AI 的价值不是陪聊，而是在学习对象上持续判断、解释、建议和调用工具。

## 3. 当前已完成的工程主线

### 3.1 Evidence Review Engine

已完成：

- 用户提交 evidence。
- 系统抽取 Evidence Card。
- 规则版评审信号覆盖。
- 输出 7 维评分。
- 输出 verdict：`accepted` / `needs_revision`。
- accepted 才推动节点状态。
- needs_revision 会退回活动并触发调整建议。
- LLM evidence evaluator 已有增强路径和回退测试。

核心文件：

- `lib/learning/agents/evidence-extractor.ts`
- `lib/learning/agents/evidence-evaluator.ts`
- `lib/learning/agents/llm-evidence-evaluator.ts`
- `lib/learning/application/learning-service.ts`
- `lib/learning/domain/signals.ts`

### 3.2 Proposal / Adjustment Engine

已完成：

- 证据失败后生成调整建议。
- 缺失/部分覆盖的能力信号会回流到建议。
- 支持采纳、忽略、被新建议取代。
- 采纳补强建议会真实插入补强活动。
- 复测失败、重复失败、反复缺失信号会提高建议优先级。
- weekly_light 空动作采纳后会写入周计划 rationale，形成可见副作用。

核心文件：

- `lib/learning/agents/adjustment-advisor.ts`
- `lib/learning/application/learning-service.ts`
- `app/learn/page.tsx`

### 3.3 Goal / Course / Capability / Adaptive Planner

已完成：

- `goalAnalyzer`：从目标文本提取领域、关键词、目标深度。
- `courseAnalyzer`：把资料映射到内容包能力节点。
- `capabilityMapper`：生成能力图，支持 existing content 和 generic fallback。
- `adaptiveRoutePlanner`：生成 adaptive plan 预览。
- `plannerMode`：
  - `legacy`
  - `adaptive_preview`
  - `adaptive_existing_content`
- 默认仍是 legacy，避免 generic 能力污染正式学习闭环。
- `adaptive_existing_content` 命中现有内容包时可以驱动正式计划。

核心文件：

- `lib/learning/agents/goal-analyzer.ts`
- `lib/learning/agents/course-analyzer.ts`
- `lib/learning/agents/capability-mapper.ts`
- `lib/learning/agents/adaptive-planner.ts`
- `lib/learning/agents/adapters.ts`
- `lib/learning/application/learning-service.ts`

### 3.4 Learning Situation / Decision Policy

已完成：

- 新增 `LearningSituation`。
- 新增 `LearningDecision`。
- 新增 `RuleLearningDecisionPolicy`。
- 系统可以判断当前更应该：
  - 澄清目标
  - 评估资料
  - 建立理解
  - 练习能力
  - 产出作品
  - 修复缺口
  - 延迟复习
  - 降低范围恢复节奏
  - 修正路线
  - 包装作品集

核心文件：

- `lib/learning/agents/learning-decision-policy.ts`
- `lib/learning/agents/types.ts`

### 3.5 Material Review + Personal Fit

已完成：

- 新增 `MaterialReview`。
- 新增 `RuleMaterialReviewer`。
- 区分资料质量和个人适配。
- 判断资料是：
  - `core`：可作为当前主线
  - `reference`：适合参考
  - `supplement`：可用但需要补充
  - `not_recommended`：当前阶段不建议
- 评分维度：
  - 来源可信度
  - 结构清晰度
  - 练习密度
  - 评估标准清晰度
  - 项目/成果相关性
  - 新鲜度
  - 营销风险
  - 小白适配度
  - 当前目标适配度
  - 时间周期适配度
- `LearningDecisionPolicy` 已能消费 `materialReviews`。

核心文件：

- `lib/learning/agents/material-reviewer.ts`
- `lib/learning/agents/learning-decision-policy.ts`

### 3.6 前端可见体验

已完成：

- `/learn` 未诊断页新增“已有参考资料（可选）”。
- 路线确认页展示：
  - Trellis 当前判断
  - 为什么这么判断
  - 下一步
  - 资料是否适合现在的你
  - 资料质量分
  - 个人适配分
  - 能力拆解预览
- 活动抽屉展示：
  - 我提交的材料
  - 系统提取的材料摘要
  - 已覆盖/待补充能力信号
  - 评分依据
  - 可信度说明
  - 下一步建议
- 调整记录展示：
  - 为什么
  - 缺什么
  - 做什么
  - 采纳建议
  - 先不调整

核心文件：

- `app/learn/page.tsx`
- `app/v02.css`

## 4. 当前 Agent / Engine 盘点

当前更准确叫“agent-like ports + rule engines”，不是完整 runtime agent。

已注册端口：

- `goalAnalyzer`
- `courseAnalyzer`
- `materialReviewer`
- `capabilityMapper`
- `adaptiveRoutePlanner`
- `learningDecisionPolicy`
- `planner`
- `activityComposer`
- `evidenceEvaluator`
- `adjustmentAdvisor`

这些东西已经有 agent 分工，但还缺完整 agent runtime 的能力：

- 无长期 memory harness。
- 无 MCP/tool registry。
- 无 LangGraph/DeepAgents/Pi Agent 编排。
- 无多步工具调用循环。
- 无外部搜索/网页/PDF 解析。
- 无观测面板记录每次 agent reasoning trace。

当前可以对外准确表达为：

```text
Trellis 已具备结构化 agent ports、规则版智能内核、LLM 增强接口与可回退闭环。
```

不要夸大为：

```text
Trellis 已经是完整自主 Agent 平台。
```

## 5. 当前测试与验证基线

最近验证：

```bash
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
npx eslint . --ignore-pattern dist --ignore-pattern .next
```

最近结果：

```text
TypeScript: 0 错误
Domain tests: 176/176 通过
ESLint: 0 问题
GET /learn: 200
```

Windows 注意：

- `npm run test:domain` 在部分沙箱会因为 child process spawn 限制不稳定。
- 权威替代命令是：

```bash
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
```

## 6. 最新 Git 状态

最新主线提交：

```text
697c3da feat(learn): show diagnostic decision analysis
d22bfe2 feat(learning): wire material review into analysis
4ab3e17 feat(learning): add material review rubric
8ccca45 feat(learning): add decision policy
4340002 feat(learning): add full-chain adaptive analysis
```

远端：

```text
origin/main 已同步到 697c3da
```

不要随手提交这些本地文件：

```text
AGENTS.local.md
.tmp-dev-server.out.log
.tmp-dev-server.err.log
docs/learn-drawer-assessment.png
docs/learn-drawer-assessment-bottom.png
scripts/legacy/trellis-shot.mjs
wrangler.migrate.json
memory/sessions/2026-08-24-ponytail-dsh-integration.md
```

其中 `memory/sessions/2026-08-24-ponytail-dsh-integration.md` 当前是本地改动，不属于刚才主线提交；接手者不要误提交。

## 7. 当前不足

工程上已经有作品集级骨架，但还没到“完整 AI 学习伙伴”。

主要不足：

1. 资料输入还很弱
   - 现在只是内置资料选择。
   - 没有真实 URL 抓取、PDF 解析、课程目录解析。

2. Material Review 仍是规则版
   - 好处是确定、可解释、可测试。
   - 不足是对中文复杂课程介绍、视频课结构、真实网页内容的理解有限。

3. Learning Decision 还没有真正驱动计划
   - 现在会展示“下一步决策”。
   - 但如果决策是 `review_material` 或 `route_correction`，首周计划还没有自动插入“资料校准活动”。

4. Soft Signal 尚未成型
   - 系统能评审 hard evidence。
   - 但对“我理解了吗”“我哪里困惑”“我为什么要学这个”的过程信号还不够。

5. Agent runtime 还没做
   - 现在是端口和规则引擎。
   - 还没有 tools、hooks、memory、loop、MCP、trace。

6. 通用学习能力仍有限
   - AIPM/AI 内容包比较完整。
   - 非 AI 目标可以 generic fallback，但不能正式进入完整 evidence review 闭环。

## 8. 下一步不要怎么做

不要继续按“哪个最便宜”排序。

不要只补：

- 小文案
- 小 UI
- 单个测试盲区
- 零散 refactor

不要立刻盲目上：

- LangGraph
- DeepAgents
- Pi Agent
- DSH
- 大型 MCP 工具生态

原因：

```text
现在真正要证明的不是“用了什么框架”，而是 Trellis 的学习判断链路是否成立。
```

框架应该服务于：

- 多步判断
- 工具调用
- 记忆
- 可观测
- 可回放
- 成本控制

如果这些判断对象还没稳定，上框架只会把复杂度提前。

## 9. 下一步应该做什么

下一步主线目标：

```text
让 Learning Decision 真正改变首周计划。
```

最合理的下一阶段切片：

```text
Decision-driven Activity Insertion
```

意思是：

- 如果资料不适合，先生成“资料校准活动”。
- 如果目标模糊，先生成“目标澄清活动”。
- 如果用户是小白，先生成“建立理解活动”。
- 如果已经看了很多但没产出，生成“产出作品活动”。

第一优先级建议：

```text
当 learningDecision.primaryNeed 为 review_material 或 route_correction 时，
confirmProposal 不应直接进入普通学习活动，
而应先插入一个资料校准/路线修正活动。
```

验收标准：

1. 用户选择一份不适合当主线的资料。
2. runDiagnostic 返回 materialReviews 和 learningDecision。
3. confirmProposal 后，首周计划第一张活动是资料校准或路线修正。
4. 这个活动有：
   - 为什么做
   - 操作步骤
   - 产出证据
   - 评估标准
5. 证据仍能进入 Evidence Review Engine。
6. 不影响 legacy 默认路径和已有 176 条测试。

## 10. 给下一位 coding agent 的任务指令

```text
你是本仓库 coding agent。请严格按当前 Trellis 主线开发，不要扩展范围。

任务：实现 Decision-driven Activity Insertion 的最小闭环。

背景：
- 当前 runDiagnostic 已返回 workspace.analysis.learningDecision。
- materialReviewer 已能判断资料 core/reference/supplement/not_recommended。
- learningDecisionPolicy 已能在资料不适合时输出 review_material 或 route_correction。
- /learn 已能展示这个判断。

目标：
让 learningDecision 不只展示，而是在 confirmProposal 生成首周计划时影响第一张活动。

必须实现：
1. 在 adaptive_existing_content 或安全可控路径下，当 learningDecision.primaryNeed 为 review_material 或 route_correction 时，生成一张校准活动。
2. 校准活动必须复用现有 LearningActivity 结构，不新增 schema。
3. 活动 title 使用中文，例如：
   - 资料校准：判断这份资料能否作为主线
   - 路线修正：先确认学习方向与资料缺口
4. 活动 goal 必须说明为什么现在先做它。
5. steps / expectedEvidence / evaluationCriteria 必须可被 Evidence Review 消费。
6. generic fallback 能展示 analysis，但不得让 generic capability id 进入正式 nodeProgress/evidence。
7. 不新增页面，不接外部搜索，不接 PDF，不接 LangGraph/DeepAgents/DSH。

建议修改文件：
- lib/learning/application/learning-service.ts
- lib/learning/agents/adapters.ts 或 activity-composer.ts（仅当必须）
- tests/learning-domain/full-chain-integration.test.ts

必须新增/扩展测试：
1. materialReviews 中有 supplement/not_recommended 时，confirmProposal 首周插入校准活动。
2. 校准活动使用内容包节点 id 或安全 fallback，不产生 cap.generic.* 正式活动。
3. 证据可提交并进入 reviewEvidence。
4. legacy 默认路径不变。

验证命令：
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
npx eslint . --ignore-pattern dist --ignore-pattern .next

不要提交：
AGENTS.local.md
.tmp-dev-server.*
docs/learn-drawer-assessment*.png
scripts/legacy/trellis-shot.mjs
wrangler.migrate.json
memory/sessions/2026-08-24-ponytail-dsh-integration.md
```

## 11. 给项目 owner 的解释

现在 Trellis 的开发不是“先把所有功能做完”，而是在搭一条可以答辩的产品逻辑：

```text
普通学习 App：你填目标 -> 它排任务 -> 你打勾。

Trellis：你填目标和资料 -> 它判断目标是否清楚、资料是否适合、能力怎么拆、现在先做什么、怎么证明学会、失败后怎么调。
```

这就是作品集亮点。

但下一步必须让“判断”开始影响“行动”。否则系统会显得只会解释，不会真正改变学习安排。

所以接下来不要急着上花哨 agent framework。先把：

```text
判断 -> 活动生成 -> 证据评审 -> 动态调整
```

这条链做实。
