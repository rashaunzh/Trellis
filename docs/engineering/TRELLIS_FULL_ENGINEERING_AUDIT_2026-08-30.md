# Trellis 全工程审计（mattpocock/skills）

> 日期：2026-08-30
> 范围：从 2026-08-05 建仓至当前工作区，不只审计 Course Intelligence。
> 方法：完整盘点 `mattpocock/skills` 的 37 个 skill，按触发条件应用适用项；不把不相关 skill 强行运行。
> 复核：2026-08-31 补充安全、数据一致性、CI、依赖、性能、前端和文档真实性审计。

## 1. 结论

Trellis 已经形成较强的学习运行底座，但尚未形成稳定的产品与工程主干。当前状态更准确地描述为：

**三个产品时代共存的、测试较强的本地工程原型。**

- 可复用底座：D1、owner 隔离、活动与证据状态机、周计划、调整提案、掌握确认、周复盘、规则降级、浏览器验收。
- 当前正式方向：Course Intelligence，即目标理解、课程取舍、章节编排和连续学习。
- 主要断点：新课程智能使用 canonical graph，旧学习运行时仍使用 legacy node；D1 还不是课程内容的运行时真相。
- 最大交付风险：8 月 27 日以后的大量功能集中在未提交工作区，无法可靠回滚、比较和发布。
- 最大过程问题：开发跳过了 glossary/ADR、spec、tracer-bullet tickets、双轴 review、逐片 commit 和 retro 的连续工程链。

## 2. 工程演进账本

| 阶段 | 产品假设 | 主要产物 | 当前价值 |
|---|---|---|---|
| V0.1 | 四主线个人成长与行动系统 | Git 记忆、任务/项目/证据、部署 | 记忆与协作规则可复用，产品身份已退出 |
| V0.2 | 自适应学习系统 | 能力图、诊断、周计划、活动、动态调整 | 学习运行底座的主要来源 |
| V0.3 | Evidence Review | 结构化评审、掌握确认、延迟复测 | 可复用，但前台需降为学习反馈 |
| 作品集阶段 | Agentic Learning Companion | StagePath、作品循环、Mastra、Eval | 工程展示资产，已退出正式入口 |
| 日用阶段 | 多周学习陪伴 | Course Slicer、周历史、周复盘、三周验收 | 周连续性可复用，课程判断已被替代 |
| 当前阶段 | Course Intelligence | 来源、Course Genome、领域图、课程组合、三态 Learn | 正确产品中心，但只完成固定基线纵向切片 |

此前开发并非全部浪费。问题是每轮开发完成了本轮闭环，却没有同步完成上轮模型的 contract，因此兼容层不断变成正式复杂度。

## 3. 仓库与交付状态

- 分支：`main`，HEAD `34871b6`；提交历史最后停在 2026-08-26。
- 工作区：48 个 tracked 文件修改、104 个 untracked 项，tracked diff 为 7040 行新增、2166 行删除。
- 未跟踪内容约 6.3 MB，包含代码、迁移、测试、文档、截图和 skills。
- 根目录保留 37 个已忽略 Chrome 临时 profile，说明验收脚本有清理债务。
- production build、TypeScript、lint、209 个领域测试和 delivery precheck 当前通过。
- 远程 D1 `0013`、内置模型真实调用、生产部署和 production smoke 尚未完成。
- 当前公网模型仍是可伪造 header 的 anonymous owner，不是安全身份系统。

结论：本地构建健康，但尚不存在可称为“Course Intelligence 版本”的 Git 交付物。

## 4. 领域模型审计

仓库中同时存在三套产品语言：

1. `AGENTS.md`：学习、求职、商业、想法四主线。
2. V0.2 PRD：可信领域图、个性路径、学习活动、证据驱动调整。
3. 最新决策：课程情报、Course Genome、Curriculum Assembly、准确章节。

目前没有 `CONTEXT.md`、`docs/adr/` 或 canonical glossary。结果包括：

- `route` 既表示产品方向，又表示 legacy 学习路线；
- `stage` 既表示学习深度，又表示固定八周阶段或课程组合阶段；
- `resource` 混合课程、材料、工具和工作台对象；
- `evidence` 同时承担低负担反馈、作品和掌握证据；
- 新 graph node 和 legacy content-pack node 不是同一身份。

Course Intelligence 要成立，至少需要稳定定义：`Learning Intent`、`Published Domain Graph`、`Course Genome`、`Course Unit Mapping`、`Curriculum Assembly`、`Learning Run`、`Learning Signal`、`Knowledge State` 和 `Curriculum Revision`。

## 5. 深模块审计

### Strong：Published Course Catalog

**现状**：`service.ts` 和 repository 都直接依赖 `baselineCourses` / `baselineMappingsFor()`；D1 新课程没有完整映射，seed 在已有 graph 时整体退出。

**应形成的 module**：一个小 interface 隐藏来源、版本、章节、映射、候选发布和回滚。内存与 D1 是两个 adapter；baseline 只是 seed adapter，不是运行时真相。

**收益**：课程组合只依赖已发布 catalog；新增课程无需修改编排 implementation；D1 integration test 可以通过同一 interface 验证完整行为。

### Strong：Canonical Learning Runtime

**现状**：`bridgeNode()` 把 36 个正式节点压回少量 legacy node，课程方案和学习状态使用不同身份。

**应形成的 module**：以 canonical node key 接受已确认 curriculum，产生本周 learning runs，并消费 learning signals 更新 knowledge state。

**收益**：`/learn`、`/grow` 和调整逻辑共享一份状态，不再依靠前端推测映射。

### Strong：Learning Application 分解

**现状**：`LearningApplicationService` 2806 行，承担诊断、编排、活动、证据、复测、作品、资源、周复盘、质量和记忆。

**应形成的 modules**：先按真实 change reason 切出 `LearningRun`、`LearningSignalReview`、`CurriculumRevision`；旧作品和 Mastra 先冻结为 legacy adapter，不能继续抽象整套 agent framework。

### Worth exploring：Learning Read Model

**现状**：`/learn` 和 `/grow` 并行读取 Course Intelligence state 与 legacy workspace，再在前端拼接状态。

**建议**：建立面向页面的单一 read module，返回当前 intent、curriculum、run、signal 和 canonical progress。

### Worth exploring：文档与 Agent Context

**现状**：68 个 docs、49 个 session，多份相互冲突的 PRD、handoff、demo 和部署说明；缺少指向当前真相的 context pointer。

**建议**：一个 `CONTEXT.md` 管词汇，一个 ADR 目录管不可逆决策，一个当前产品契约；历史文档统一归档，不再由 agent 猜哪个最新。

## 6. Course Intelligence 实现缺口

### P0：D1 不是运行时真相

- `CourseIntelligenceRepository.listCourses()` 暴露 `BaselineCourse`，泄漏 seed implementation。
- D1 adapter 对代码基线外课程返回空 `unitNodes`。
- curriculum assembly 直接调用 `baselineMappingsFor()`，绕过 repository seam。
- graph 已存在时 seed 全部退出，后续课程和来源无法增量发布。

### P0：canonical graph 未接通学习状态

- 课程选择使用 canonical node。
- 活动、证据、掌握和复测写入 legacy node。
- `/grow` 通过课程 mapping 与活动标题关系推断状态，不是可靠知识状态。

### P1：AI 只生成临时候选

- 陌生目录分析不会保存候选 course/version/unit/mapping。
- 没有候选审核、发布和拒绝生命周期。
- 没有来源抓取任务、版本 diff 或用户路线影响计算。
- 模型运行 token 固定记录为零；缓存缺 provider、base URL 和 schema version。
- 当前未验证真实 provider 下的结构化输出成功率和成本。

### P1：固定基线仍承担核心判断

- 目标 profile 仍由关键词分成 `literacy / builder / product`。
- 默认 target nodes 与课程偏好由代码数组决定。
- DeepLearning.AI benchmark 证明有限组合规则，但没有证明开放课程世界中的质量判断。

## 7. TDD 与测试审计

### 已证明

- 状态机、owner 隔离、证据退回与修订、掌握确认、复测、周计划保留历史。
- 固定 Course Intelligence baseline 的课程压缩和准确章节活动。
- 无模型配置时不伪造陌生课程分析。
- production build、lint 和类型安全。

### 未证明

- D1 adapter 插入代码基线外课程后参与 curriculum assembly。
- 已有 graph 时新增 source/course/version 的增量 seed。
- 候选课程从分析到审核、发布、回滚的端到端行为。
- learning signal 更新 canonical node，刷新后 `/grow` 一致。
- 真实模型的 timeout、retry、cache schema 变化、token/cost 和 provider 切换。
- 远程 migration 和 production smoke。

当前 209 个测试的主要价值是保护历代行为；它们也提高了删除旧系统的成本。下一阶段测试应围绕新 module interface，而不是继续增加 legacy service 组合测试。

## 8. 双轴 Working Tree Review

### Standards

1. **硬问题**：仓库协议要求会话结束 commit/push，但 8 月 27 日后的大量工作未形成提交。
2. **Divergent Change**：`learning-service.ts` 因多种无关需求持续扩张。
3. **Shotgun Surgery**：同一次产品变化修改 domain、agents、application、frontend、API、CSS、脚本和多份文档。
4. **Primitive Obsession**：大量字符串 node/route/status/profile 充当跨时代领域身份。
5. **Speculative Generality**：Mastra runtime、质量面板、作品流程在正式产品退出后仍保留完整依赖和发布检查。
6. **Single source of truth 违反**：产品身份、部署步骤和 demo 叙事分散在多份当前文档。

### Spec

最新 Course Intelligence 计划中：

- Round 1 的模型网关、表结构和 baseline 已部分完成；真实来源抓取、安全抓取和完整快照仍未完成。
- Round 2 的 graph、Course Genome 与固定映射已完成；AI 候选生成、内部评审和正式发布机制未完成。
- Round 3 的 curriculum assembly 和确认接口已完成 baseline 纵向切片；开放材料无法进入正式组合。
- Round 4 的三态 `/learn` 已完成，但执行态依赖 legacy runtime bridge。
- Round 5 的连续学习能力主要来自旧系统，canonical growth state 未闭合。
- Round 6 的更新检测、迁移、监控、生产交付尚未开始。

所以不能把六轮计划称为已实现；准确状态是“Round 1-4 的固定基线纵向演示，Round 5 借用 legacy 底座，Round 6 未完成”。

## 9. 工程流程复盘

### 做得好的部分

- 每轮实现通常有验收标准、领域测试和浏览器脚本。
- 规则降级、HITL 和结构化判断贯穿多轮，工程价值真实。
- 会话文档详细，能够重建产品演进过程。

### 失败模式

- 没有先建立 issue tracker、glossary 和 ADR consumer rules。
- 长计划没有拆成可独立提交的 tracer-bullet tickets，也没有 blocking edges。
- 多轮开发在同一工作区继续堆叠，失去 fixed point，无法执行可靠双轴 code review。
- 产品讨论尚未稳定时直接进入实现，没有用 prototype 回答关键 UI/状态问题。
- retro 没有把“用户连续指出产品理解错误”转化为流程 guardrail。
- session/handoff 写得很多，但这些文档承担了 issue、spec、ADR 和 changelog 四种职责。

## 10. 37 个 skill 适用性矩阵

| Skill | 本次状态 | 对 Trellis 的结论 |
|---|---|---|
| ask-matt | 已应用 | 应走 huge/foggy effort 的 wayfinder，再进入 spec/tickets/implement |
| setup-matt-pocock-skills | 已审计 | 未配置 issue tracker、domain docs、ADR 布局 |
| grill-me | 不适用 | 有工作目录，应使用 grill-with-docs |
| grill-with-docs | 过程审计 | 历史讨论没有同步维护 glossary/ADR |
| grilling | 过程审计 | 产品质疑充分，但事实、决策和方案没有稳定分层 |
| wayfinder | 强适用 | 当前重构横跨多会话，应该先做 decision map |
| research | 强适用 | 课程来源和领域图需要一手来源研究票，而不是实现时顺手填 baseline |
| prototype | 适用 | 新 intake、课程方案解释和成长状态应先用可抛弃原型验证 |
| to-spec | 强适用 | 现有计划不是可追踪 spec，缺统一 user stories 与 interface 决策 |
| to-tickets | 强适用 | 历史按横向 Round 推进，缺纵向 tracer bullets 与 blocking edges |
| implement | 过程审计 | 实现前缺 agent-ready ticket，完成后缺固定点 review/commit |
| implement-spec | 过程审计 | spec 与实现没有一一对应状态 |
| tdd | 已审计 | 测试丰富，但关键 D1 与 canonical runtime seam 未覆盖 |
| code-review | 已应用 | 已完成 working tree Standards/Spec 双轴审查 |
| codebase-design | 已应用 | 识别 catalog、runtime、application、read model 深化机会 |
| improve-codebase-architecture | 已应用 | 首选 Published Course Catalog，其次 Canonical Learning Runtime |
| domain-modeling | 已应用 | 三代语言并存，缺 canonical glossary 与 ADR |
| retro | 已应用 | 识别无提交增量、文档沉积、流程缺口 |
| writing-for-agents | 已应用 | AGENTS 简短但缺有效 context pointers；文档 single source 失效 |
| handoff | 已审计 | handoff 过度承载产品状态，且没有引用稳定 spec/ticket/commit |
| claude-handoff | 不适用 | 当前不交接给 Claude 后台 agent |
| setup-ts-deep-modules | 设计参考 | 当前还不宜直接安装；先确定 module seam，再考虑边界检查 |
| setup-pre-commit | 适用但未执行 | 可防格式/类型错误，不能解决巨大未提交工作区；应在基线整理后设置 |
| triage | 不适用 | 当前没有已配置的外部 issue intake queue |
| diagnosing-bugs | 不适用 | 本次不是具体红灯 bug 诊断 |
| resolving-merge-conflicts | 不适用 | 当前无 merge/rebase conflict |
| git-guardrails-claude-code | 不适用 | 针对 Claude Code hooks，且本次没有安装诉求 |
| migrate-to-shoehorn | 不适用 | 测试没有提出 shoehorn 迁移需求 |
| scaffold-exercises | 不适用 | Trellis 不是课程练习仓库脚手架任务 |
| wizard | 后续适用 | 远程 D1、密钥和 Cloudflare 人工步骤可生成部署 wizard |
| loop-me | 不适用 | 本次不是设计工作流提示词 |
| teach | 不适用 | 用户需要工程审计，不是教学会话 |
| to-questionnaire | 暂不适用 | 当前关键事实可从仓库获得，未出现必须由第三方回答的决策 |
| wait-what | 反思适用 | 此前多次“响应字面而非重构问题”说明需要在理解失配时主动重述 |
| writing-fragments | 不适用 | 本次不是文章素材探索 |
| writing-beats | 不适用 | 本次不是文章旅程编排 |
| writing-shape | 不适用 | 本次不是协作写作 |

## 11. 推荐工程顺序

### Phase 0：止血与建立 fixed point

1. 把当前工作按产品契约、Course Intelligence、legacy compatibility、UI、测试和文档分组审查。
2. 删除纯临时产物，确认敏感信息检查。
3. 建立一个可构建、可测试的 Course Intelligence baseline commit/tag。
4. 配置 `docs/agents/`、`CONTEXT.md`、`docs/adr/` 和 issue tracker。

### Phase 1：决策地图，而不是继续开发

用 wayfinder 解决四个阻塞决策：

1. canonical knowledge node 是否替代全部 legacy node；
2. D1 published catalog 的 interface 与发布生命周期；
3. learning signal 与 mastery 的首版边界；
4. legacy APIs、Mastra、artifact 和旧测试的退役策略。

### Phase 2：两个 tracer-bullet

1. **真实课程进入 published catalog**：候选解析 → 映射 → 审核 → 发布 → curriculum 可选 → D1 integration test。
2. **canonical 节点完成一次学习循环**：确认 curriculum → 准确章节活动 → 轻反馈 → knowledge state 更新 → `/grow` 一致。

这两条完成前，不增加自动抓取、更多课程、作品路径或新 UI 面板。

### Phase 3：收缩旧系统

- expand-contract 迁移 node identity；
- 切分或退休 `LearningApplicationService`；
- 删除无正式调用的 legacy routes、Mastra dependency 和作品验收；
- 将仍需保留的历史兼容放进明确 adapter。

### Phase 4：生产证明

- 真实 provider benchmark、成本/失败监控；
- 远程 D1 migration、身份边界和生产 smoke；
- 用 3-5 个真实目标与课程目录做人工盲评；
- 最后重做 UI 和作品集叙事。

## 12. 交付判断

Trellis 当前能证明：结构化学习状态、HITL、规则降级、可解释评审和跨周状态的工程能力。

Trellis 当前不能证明：能持续理解真实课程世界、形成可信课程组合，并在同一 canonical knowledge model 上陪用户连续学习。

后者才是当前产品责任，也是下一阶段唯一应该优先证明的能力。

## 13. 安全与隐私审计

### P0：公开生产不能继续使用可伪造 owner header

- `app/api/learning/_shared.ts:15` 直接信任客户端 `x-trellis-owner-id`。
- owner ID 由浏览器 localStorage 生成，不是会话凭证，也没有签名。
- 任意请求者只要猜到或获得另一个 owner ID，就能读取和修改其学习状态。
- 仓库已有 `app/chatgpt-auth.ts`，可以读取托管环境身份 header，但当前没有任何学习页面或学习接口使用它。

单用户本地 MVP 可以保留 anonymous owner；公开 demo 必须在“完全隔离的演示数据”与“可信身份派生 owner”之间做出明确选择，不能把当前实现称为账号隔离。

### P0：legacy BYOK 不适合公开环境

- `learning_api_config.api_key` 把用户 Key 明文存入 D1。
- GET 虽然脱敏，但匿名 owner 可伪造，因此其他请求者可以覆盖目标 owner 的配置。
- 新 Course Intelligence 使用服务端 `TRELLIS_AI_API_KEY`，旧 `/api/learning/api-config` 仍保持可写。

正式方向既然是内置模型默认、BYOK 非必要，部署前应关闭或移除 legacy BYOK 接口；若未来恢复，必须先有真实鉴权、加密和删除/轮换能力。

### P1：错误与滥用控制不足

- `jsonError()` 把底层错误消息原样返回客户端，可能暴露 SQL、模型或运行环境细节。
- 没有 rate limit、调用配额或 owner 级模型预算。
- intake 有 Zod 字段上限，这是好事；但 API 层没有统一 request-size policy。
- secret heuristic 未在仓库中发现明显真实 Key；这不替代 CI secret scanning。

## 14. 数据一致性与迁移审计

### P0：确认课程方案不是原子写入

`confirmCurriculum()` 依次执行：保存 confirmed curriculum、supersede 旧方案、保存 profile、保存 weekly plan、删除开放活动、逐条新增活动和进度。该链路没有 transaction 或 compensating action。

任一 D1 写入失败都可能产生：

- 方案已经 confirmed，但没有完整周计划；
- 旧开放活动已删除，新活动只写入一部分；
- curriculum 与 workspace 指向不同版本。

这条链路需要一个原子 activation module，或至少使用 D1 batch 加幂等 activation 状态，使重试能够收敛。

### P0：迁移账本已经分叉

- `drizzle/meta/_journal.json` 只登记到 `0009`。
- `0010` 至 `0013` 是手工 SQL 文件，没有进入 Drizzle journal。
- 部署文档要求逐文件 `wrangler d1 execute`，而不是统一 migration runner。
- `wrangler.migrate.json` 仍使用 placeholder database ID。

这意味着“本地表存在”不能证明新环境按同样顺序迁移成功。发布前必须确定唯一 migration authority，并在空库和旧库各跑一次完整演练。

### P1：序列化与约束仍偏 demo

- `inputRefs`、`supportingEvidenceIds`、`relatedNodeIds` 使用逗号分隔字符串，不适合包含复杂 ID 或做可靠关系查询。
- Course Intelligence 大量状态字段是无 enum/check 的 text，数据库不能阻止非法发布状态。
- baseline seed 和 curriculum activation 使用多次串行 D1 请求，没有批量一致性。

## 15. 运行性能与可靠性审计

### P0：每个学习请求都重新 seed legacy 内容包

`getLearningService()` 和 `getCourseIntelligenceService()` 每次构造时都会调用 `learningStore.seedContent()`。该方法没有版本哨兵，而是逐条对 route、node、edge、branch、resource、mapping 和 tool 执行 `INSERT OR IGNORE`。

结果是每次读取 workspace、提交反馈或读取课程状态都产生大量无效 D1 写请求。对 Cloudflare D1 而言，这会增加延迟、写配额和失败面。

seed 应迁移到 migration/显式发布流程，运行请求只读已发布版本；最多保留一次轻量版本检查，不能逐条写入。

### P1：模型网关可观测性不完整

- token usage 固定记录为零，无法核算成本。
- cache key 没有 provider、base URL、prompt/schema version。
- 命中旧 cache 后 schema parse 失败会直接抛错，不进入 retry/fallback。
- 未配置真实模型，因此 latency、结构化成功率和 fallback 率均未建立基线。

### P2：前端读模型重复

`/learn` 和 `/grow` 同时请求 intelligence state 与 legacy workspace。除状态不一致外，每次 refresh 会重复触发两套初始化和 seed，放大后端问题。

## 16. CI、测试与发布门禁审计

### P0：CI 没有运行核心领域测试

`.github/workflows/ci.yml` 只运行 `npm test`。当前 `npm test` 等于 production build 加 `tests/*.test.mjs`，不会运行：

- `npm run test:domain` 的 209 个领域测试；
- `npm run lint`；
- `npx tsc --noEmit --incremental false`；
- Course Intelligence 浏览器验收；
- migration smoke。

因此“本地 209/209 通过”不是主分支门禁。CI 应有一个明确 `check` script，至少统一 typecheck、lint、domain test、build test 和 migration test。

### P0：生产依赖存在高危审计项

2026-08-31 执行 `npm audit --omit=dev --audit-level=moderate`：5 个漏洞，其中 4 个 high，涉及 `next`、`postcss`、`sharp` 和 `nanoid`，另有 `@ai-sdk/provider-utils` 资源消耗问题。

修复建议会把 Next 升到当前声明范围之外，不能直接执行 `npm audit fix --force`。应建立独立升级票，完成 build、Cloudflare runtime、API、截图和 production smoke 回归后再发布。

### P1：delivery precheck 只检查“文件存在”

当前 precheck 不验证：

- 文档是否与当前产品一致；
- 截图是否来自当前 commit；
- production URL 是否可访问；
- migration 是否已应用；
- 内置模型是否可用；
- smoke 结果是否存在。

`production-smoke.mjs` 仍主要检查 legacy workspace 和 week-review，没有检查 Course Intelligence state、intake、curriculum confirm 和准确章节活动。

## 17. 前端与可访问性审计

### 当前优势

- 新 Learn 页已经缩为目标、方案、执行三态。
- intake 有字段长度限制和明确错误状态。
- CSS 有 900/620 等响应式断点，基础手机布局不是完全缺失。
- Grow 节点使用 button，侧栏带 `role=dialog` 和 `aria-modal`。

### 仍未达到交付标准

- 所有正式 acceptance viewport 都是 1440px 桌面，没有移动验收。
- Grow dialog 没有焦点捕获、Escape 关闭和关闭后焦点恢复。
- 前端没有离线、请求超时、重试和部分数据失败状态。
- `workspace` 请求失败被 `.catch(() => null)` 静默吞掉，用户可能看到课程方案正常但执行状态消失。
- 2887 行单一 `app/v02.css` 混合多代页面样式，是明显的样式沉积层。

## 18. 文档真实性审计

### P0：文档索引仍把已退出方向列为当前权威文档

`docs/README.md` 声称当前以 V0.2 PRD 为唯一基线，并把 Agentic Learning Companion、Mastra、作品集脚本列为当前权威文档；根 README 又声明 Course Intelligence 为正式中心。Agent 无法从索引判断哪一套有效。

### P1：README 部分表述超过实现

- “课程变化只生成候选版本和影响报告”目前只有比较函数/契约，没有持续更新工作流。
- “课程版本、章节、来源快照、映射、分析任务的 D1 存储”有表结构，但陌生材料分析不会持久化候选。
- “旧固定路线退出正式入口”对 UI 成立，对正式运行链和 API 不成立。

发布材料必须区分 `implemented / baseline-only / designed / deferred`，不能用同一种完成语气描述。

## 19. 风险总表与 Go/No-Go

### P0：继续功能开发前处理

1. 建立可回滚 Git fixed point。
2. 停止每请求 seed。
3. 确定唯一 migration authority，并完成空库/旧库演练。
4. 将 209 个领域测试、lint 和 typecheck 纳入 CI。
5. 关闭公开 legacy BYOK，明确 demo identity 模型。
6. 设计 curriculum activation 的原子/幂等写入。

### P0：Course Intelligence 成立前处理

1. D1 Published Course Catalog 成为运行时真相。
2. canonical node 替代 `bridgeNode()`。
3. 用真实 D1 新课程完成“分析到组合”的纵向测试。
4. 用真实 provider 建立结构化成功率、成本和 fallback benchmark。

### P1：上线前处理

1. 生产依赖安全升级。
2. Course Intelligence production smoke。
3. 文档索引和 README 真实性校正。
4. 错误脱敏、模型限流和基础运行监控。
5. 至少一个移动 viewport 与基础 dialog 可访问性验收。

### 当前发布判断

- **本地工程演示：Go**，固定 baseline 场景可运行。
- **作品集截图：Conditional Go**，必须明确哪些是 baseline 演示、哪些尚未实现。
- **真实用户连续使用：No-Go**，canonical state、原子写入和课程发布链未闭合。
- **公开生产部署：No-Go**，身份、BYOK、依赖漏洞、迁移和 CI 门禁均未满足。
