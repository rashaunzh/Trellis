# Trellis 当前交接

## 2026-09-10 核心重做测试计划已实现并执行

已新增 `npm run acceptance:redesign-core`；两条真实浏览器主链、恢复/调整/异常分支在独立本地D1中运行。当前结果：45项判断自动检查、21项浏览器检查通过；真实模型20个计划试验完成（27条尝试，5条失败或需复核保留）；273领域测试、6渲染测试及完整工程检查通过。详见[执行记录](../../docs/engineering/TRELLIS_REDESIGN_ACCEPTANCE_2026-09-10.md)与[会话](../sessions/2026-09-10-redesign-acceptance.md)。

测试推动修复能力阶段/理由、拒绝调整、取消与刷新恢复、反馈重试唯一约束、旧页面409、跨周外键及学习页反馈呈现。未部署、未改个人路线与偏好。

总体仍未放行：五维语义评分、真实模型反馈（目前规则生成）、完整阶段出口、跨进程故障覆盖、真人三次任务/两类活动/隔日恢复及观察后修改复测、线上真实登录均未完成。准确下一步补齐这些条件，不能把自动计数当成完整产品质量。H1–H4已用于首次验收；若用于调参需补新保留集。

## 2026-09-09 核心产品重做：先行分析

当前重点转为用户要求的独立产品重做；用户明确先完整分析理念、流程和现状。本轮交付[分析与设计提案](../../docs/product/TRELLIS_REDESIGN_PRODUCT_ANALYSIS_2026-09-09.md)，详见[会话](../sessions/2026-09-09-redesign-product-analysis.md)。总体重做仍未完成，尚未交付新操作体验。

已确认：本次工作以真实核心流程可运行为总目标，当前先分析。报告中的新承诺、首个场景和信息层级是建议，未写成正式产品决策，未改个人路线和偏好。源码静态核对显示阶段按课程生成、任务从片段派生、目标与理由模板化；需同时重做判断逻辑和交互。已有位置补充、持久反馈与版本机制可验证复用。

开放问题：新路线的判断质量、用户理解成本、反馈负担与连续使用价值尚未验证。准确下一步：实现目标输入→能力阶段→确认→任务→结果反馈→刷新恢复→调整预览及确认的纵向切片，接真实服务与持久化，再做真人观察复测。不得将本轮静态分析或后续固定样例当作真实体验验收。

## 2026-09-08 私有上线

用户已授权上线，版本10已完成首次发布和数据库升级；版本11补首次登录并发保护。源码445d73d，环境revision 2，保持仅所有者可访问。入口 https://ai-learning-os.rashaunzh.chatgpt.site/learn 。版本11平台最终状态succeeded。

页面浏览器200且无脚本错误；自动化访问凭据不提供真实登录身份，API401，真人登录后完整流程与线上模型尚未验证。下一步正常登录内测，不扩大访问范围。详见[上线会话](../sessions/2026-09-08-private-launch.md)。

## 2026-09-08 上线配置

已核验旧站点实际存在且仅所有者可访问；最新产品尚未发布。线上仅旧三表，结构含 0001 字段。Sites 环境 revision 2 已保存托管身份、精确可信域名、管理员 secret 和 Qwen 主模型配置，需部署后生效。未启用未过质量门的备用模型，未改变访问范围、迁移远端或发布。

下一步核对托管迁移记录/机制与恢复点，准备 0002–0020 升级和准确源码包，再做新版发布与真实登录验收。不能继续照旧文档假设线上已到0012。详见[会话](../sessions/2026-09-08-launch-configuration.md)与[Runbook](../../docs/engineering/DEPLOYMENT_RUNBOOK.md)。

## 2026-09-08 材料到路线闭环补齐

当前继续产品完善。材料修改、公开链接读取、加入个人主课范围、失效版本过滤、路线取舍与专属情景检查已实现，工作台改为两栏审阅。详见[本轮会话](../sessions/2026-09-08-material-route-completion.md)。

真实模型与浏览器完整材料链路、公开页面读取、原12例行为回归通过；不等同独立评分或真人效果。Spec评审发现的三个版本/前置问题已修复并复核。Standards独立代理因用量限制未完成。

最终完整检查通过268领域测试、6渲染测试、21迁移内存验证及类型/lint/构建。当前本机验证入口为 `http://127.0.0.1:3411/workbench`，仅监听本机。

后续验证重点：用户真实材料和观察；由独立人员重新准备保留集并按五维评分；根据失败决定下一轮内容覆盖和体验调整。未执行公开部署、远程迁移或数据重置。下方历史“用户材料只能作为补充”已被本轮主课采用功能替代。

## 2026-09-07 继续完善产品，材料语义审阅

用户明确纠正提前做PPT收尾的方向。当前继续产品完善，不以等待人工观察为由停止独立可推进的工作。

- 来源分析已接入模型网关，展示提供文本的原句、待核验宣传、前置/范围和目标适配建议；没有正文或失败时明确规则降级。读取上限18000字符，来源确认仍由用户触发。
- 路线保存材料引用与宣传风险快照；重分析不改写当前已确认路线。工作台改为输入后通栏审阅。
- 263领域测试、6渲染测试完整检查通过；真实模型合成案例通过，不等同真人或广泛质量验证。
- 下一步继续完善材料读取/更新、取舍和任务评价，暂不扩充展示稿。[会话记录](../sessions/2026-09-07-source-semantic-review.md)。下方“来源分析仍为规则候选”为历史版本状态。

## 2026-09-07 一周投递版首轮交付

本节为当前状态；下方历史记录中的模型通过率、来源置信度和验收结论不代表当前版本。

- 已按用户批准的一周计划实现来源片段引用、草稿与当前路线分离、跨周恢复、不确定反馈保护、重复提交恢复；完成深色绿色核心界面。
- 来源分析仍为规则候选；通用反思不作为能力掌握证据。低于支持容量的明确时间要求返回冲突，不宣称支持30分钟档位。
- 真实模型固定测试 Qwen 8/8、GLM 6/8；五组简单提示词比较保存修复前后结果，不宣称全面优于基线。R4/R5已消耗，需新保留样本。
- 已产出案例、研究、评估证据、8页可编辑展示稿、PDF及自动演示视频。入口：[一周交付](../../docs/product/TRELLIS_WEEK_DELIVERY.md)、[验证报告](../../docs/product/TRELLIS_WEEK_VALIDATION.md)。
- 已确认决策：[双目标与边界](../decisions/2026-09-07-week-delivery.md)。未修改个人长期路线或偏好。
- 最终完整检查通过：258领域测试、6渲染测试、21迁移内存验证、类型、lint和生产构建；455文件密钥扫描通过。

准确下一步：纳入用户真实观察并完成至少一次观察→修改→复测；另取未参与调试的路线样本独立评分；由用户核对个人贡献并练习五项产品判断。跨进程原子事务、任务专属成果量规和公开部署尚未验收，不能把本地受控演示称为完整生产交付。

## 2026-09-05 来源对象与内容拆解

- 新增通用 `ContentSource`、`ContentFragment` 和 `ContentAnalysis` 合同，支持课程、文章、视频、GitHub、Hugging Face、帖子和笔记。
- 新增 D1 `0020_content_sources.sql`、内存仓库/D1 仓库持久化，以及来源创建、列表、详情、分析、确认 API。
- 来源状态固定为 `inbox → needs_review → confirmed/rejected`；规则版拆解只生成候选片段，用户确认后才可作为正式来源对象，不能静默改写路线。
- 工作台新增来源对象区，展示分析状态、片段数量和置信度，并支持分析与确认；旧收集箱接口继续保留兼容。
- 验证：typecheck、lint、242 条领域测试、db verify 21 迁移、production build、5 条渲染测试和本地 HTTP 来源链路通过。
- 本地 D1 的 Wrangler 迁移元数据与旧表状态不一致，本次未重置数据库；只直执行了 0020，远程仍需正式按 0013-0020 迁移流程处理。

准确下一步：执行本人真实 7 场景内测并记录理解/误解，再依据观察决定来源片段 UI 和路线候选接入；不把规则版拆解或脚本通过包装成真实 AI 效果。

## 2026-09-05 周任务包与持久任务结果

- 学习页现在明确区分本周能力任务包中的核心任务与可选任务，并展示任务顺序、预计时长、本周完成标准和停止条件。
- `LearningOrchestrationState.weeklyPackage` 增加 `coreTaskIds`、`optionalTaskIds`、`ordering`、`completionCriteria` 和 `stopConditions`，复用既有活动的 `isCore` 与 `sequence`，没有新增编排引擎或数据库迁移。
- 新增 `LearningTaskResult` 读模型与 `GET /api/learning/tasks/:id/result`，从已保存的学习信号、能力状态和调整事实生成可刷新、可回访的任务结果。
- 反馈提交后学习页会优先读取持久结果，展示学到的概念、证据强度、尚未证明的部分、能力变化和下一步原因；接口暂不可读时保留即时反馈响应作为降级。
- 本轮验证：typecheck、lint、241 条领域测试、production build、5 条 rendered HTML 测试通过。构建仍有既有 gray-matter direct eval 与 vinext 路由分类提示。

准确下一步：先用 5 至 7 次人工内测验证用户能否理解“本周能力结果”与任务组合，再实现通用 ContentSource 拆解和工作台三个对象的持久关系；本轮不应宣称完整 PR 已完成。

## 2026-09-05 下一阶段产品闭环首轮实现

- 学习任务读模型从课程标题扩展为能力任务契约：能力问题、为什么现在、学习方式、预期结果、出口检查、停止条件、失败后的动作和路径意义。
- 学习反馈提交后不再直接关闭反馈面板；会展示本次学习结果、能力信号、下一步动作和系统已应用/待确认的变化。
- 学习页新增可展开“为什么这样安排”，展示处境判断、本周优先级和待确认决策的输入摘要、理由与置信度。
- 任务契约与决策依据复用现有 `LearningOrchestrationState`、活动、知识状态和 `DecisionRecord`，没有新增数据库迁移。
- 工作台用户入口统一称为“工作台”，内部继续定位为来源中心、测试机和成果陈列室。
- 领域测试新增任务契约和决策轨迹断言；本地构建、渲染测试、delivery precheck 和浏览器内测验收通过。

准确下一步：人工执行 5 至 7 次内测，观察用户能否复述本周能力结果、解释当前优先级、理解反馈后的能力变化；再依据真实卡点继续调整任务编排，而不是继续堆页面或 Agent。

## 2026-09-05 Archify 架构图正式交付

- 已从公开仓库 `tt-a1i/archify` 取得 Archify 源码，按其 typed JSON IR 规范生成两张正式图：`docs/architecture/archify/trellis-functional.architecture.json` 与 `docs/architecture/archify/trellis-technical.architecture.json`。
- 两张图均通过 Archify `showcase` 校验：9/9 artifact checks、0 errors、0 warnings。
- 两张 HTML 均通过 Archify `visual-check`：1440×900、1600×1000、1920×1080、2048×1320，浅色/深色视图均无横向或纵向溢出，桌面可读性通过。
- 正式功能图使用 `architecture` 类型；原先的 workflow 过程图仍保留作过程版，但不作为首屏正式交付，因为多泳道会造成过高页面占用。
- 交付物位于 `docs/architecture/archify/`，包括 JSON、HTML、visual-check JSON、contact sheet 和截图。

准确下一步：使用已交付 HTML 作为作品集架构展示；不要把 Mermaid 旧图或失败的 workflow 首屏图作为正式图片。产品侧继续进入真实内测，不以架构图代替用户验证。

## 2026-09-03 功能与技术架构图重画

- 按用户要求重画 `docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md`：新增功能架构图、重构技术架构图，并补充“下一最佳学习任务”关键时序。
- 功能架构不再把页面当作产品结构，而是表达处境判断、内容拆解、能力映射、优先级、任务包、证据和动态调整的闭环；工作台明确为来源中心、验证台和成果陈列的学习控制台。
- 技术架构按 Client → HTTP → Application → 可替换智能层 → D1 业务事实源 → 外部系统分层；明确 `LearningOrchestrationState` 是读模型，D1 是业务事实源，模型/工作流只产生结构化候选。
- 当时环境无法通过 Git 克隆 Archify，暂时保留 Mermaid 风格源图；2026-09-05 已改为使用官方仓库源码完成真实 Archify 交付。

该阶段的 Mermaid 源图仍保留在本文档中，作为迁移前的审阅记录。

> 旧交接历史因原文件包含非 UTF-8 字节，已原样保存在 `current.legacy-2026-08-30.md`。本文件从 Course Intelligence 重构后重新建立。

## 当前产品中心

Trellis 负责把用户目标和已有课程转化为有限课程组合、准确章节顺序、退出条件和连续学习状态。正式主链为：

`目标/已有课程 → 发布领域图 → Course Genome → 课程取舍 → 用户确认 → 准确章节 → 学习反馈`

## 已完成

- 10 个来源、30 门课程或专业参考、36 个 AI 领域节点的发布基线。
- Course Genome、章节节点映射、课程组合、发布检查和课程版本影响契约。
- 服务端模型网关：OpenAI-compatible、Zod、超时、重试、缓存和分析运行记录；无 Key 时发布基线可用。
- D1 迁移 `0013_course_intelligence.sql` 与 Course Intelligence repository/service。
- 正式 API：intelligence state、intake、material analyze、curriculum read/confirm。
- `/learn` 三态课程编排、`/grow` 长领域图、`/workbench` 辅助空间。
- DeepLearning.AI 总目录范围约束；AI PM 场景不把 ML 专项设为默认前置。
- `npm run acceptance:course-intelligence` 浏览器验收与四张截图。

最终验证：TypeScript 通过；领域测试 212/212；构建产物测试 6/6；lint、production build、课程智能浏览器验收和交付预检全部通过。构建仅有既有 `gray-matter` direct eval 与 vinext 路由分类提示。

## 复用与兼容

继续复用 D1、匿名 owner 隔离、周计划、活动、学习反馈和节点进度。固定 StagePath、假画像、六步展示、前三周动态演示、默认作品、Quality/Eval/Mastra 展示和关键词 Course Slicer 已退出正式入口，但兼容代码和历史数据尚未物理删除。

## 当前边界

- 本地 D1 已应用 0013；远程 D1 尚未迁移。
- 尚未线上部署，production smoke 未运行。
- 自动定期抓取、候选内容内部评审台和生产级私有材料解析尚未完成；服务层已有候选发布质量闸门。
- 内置模型环境变量未配置时运行 baseline 模式；未知课程明确为 `needs_analysis`。
- 课程更新只产生候选版本和影响报告，不自动迁移已确认用户路线。

## 2026-08-31 生产控制面修缮

- 生产学习 API 已切换为 ChatGPT 托管身份；localhost 保留显式测试 owner。旧短 owner 会在首次托管访问时迁移到 128 位 canonical owner。
- Mastra 已成为正式课程智能工作流：intake 创建 draft 并 suspend，curriculum confirm 恢复 run；官方 D1Store 保存快照。
- D1 业务表仍是唯一产品状态；课程激活使用单个 D1 batch，不再留下画像/计划/活动半写入。
- 新增 0015：workflow run、candidate review、source update job 和 owner alias。
- 内部评审页位于 `/internal/course-intelligence`；候选必须 validated 后才能发布。
- 模型网关记录真实 token/延迟，坏缓存自动重算，并限制输入、调用次数和 token 预算。
- `/api/learning/current` 已成为 Course Intelligence 当前状态统一读模型。
- 新增正式 production smoke、真实模型 benchmark、秘密扫描和 Windows/macOS/Linux 可用的 dev/start 脚本。
- 本地验证：16 个迁移、220 项领域测试、production build、6 项构建测试、Course Intelligence 浏览器验收全部通过。
- Cloudflare CLI 当前未登录；远程 D1、部署和线上 smoke 未执行。真实模型 Key 未配置，benchmark 明确跳过。

## 准确下一步

1. 登录 Cloudflare 后依次执行远程 D1 `0013/0014/0015`，配置托管环境变量并部署。
2. 在真实 ChatGPT 托管请求中验证身份 header、canonical owner 连续性和 production smoke。
3. 配置一个正式 provider，运行有限模型 benchmark；根据准确性、失败率、延迟和 token 成本决定发布阈值。
4. 人工复核首批代表来源和 candidate，再用真实用户目标验证课程组合质量。
5. 观察历史数据兼容情况后，逐步删除旧固定路线、旧 Evidence 和 Mastra demo 代码。

## 2026-08-31 审计修缮实施

- D1 published catalog 已成为课程、版本和章节映射的运行时真相；baseline 仅负责带 release marker 的首次发布。
- 新增 0014 canonical runtime：活动保留 curriculum/course version/unit/canonical node，轻反馈写入 LearningSignal 与 knowledge state。
- curriculum 激活现在可恢复、可重试；新材料模型分析先保存 candidate，不能直接进入正式路线。
- 浏览器 BYOK 写入和旧 D1 明文 Key 读取已停用；Next 升至 16.3.3，production audit 为 0 high/critical。
- `npm run check` 统一执行 typecheck、lint、15 个迁移、212 项领域测试、production build 和 6 项构建测试。
- 宿主认证邮箱现在映射为稳定、不可逆的 owner id；匿名 owner 仍保留作本地 fallback。
- candidate 已增加服务端发布闸门：低置信、缺失节点或映射不完整时拒绝进入正式 catalog。
- 浏览器验收覆盖下一准确章节推进和 390px；最新本地地址为 `http://127.0.0.1:5179/learn`。
- 实施报告：`docs/engineering/TRELLIS_REMEDIATION_IMPLEMENTATION_2026-08-31.md`。

公开发布仍未完成：远程 D1 0013/0014/0015、托管身份联调、真实模型 benchmark、线上部署和 production smoke 仍是阻塞项。

## 2026-09-01 Agentic 决策内核收口

- 新增 `0016_agentic_decision_kernel.sql`，以 `DecisionRecord` 和 append-only 事件统一课程分析、路线确认、学习调整、来源演进和迁移提案。
- Mastra 正式运行四条可暂停/恢复工作流；D1 继续是唯一业务事实源，普通用户界面不暴露内部 Agent 与模型术语。
- Curriculum Solver v2 已替换固定 profile/课程偏好主导逻辑，使用发布图、合法章节、前置闭包、阶段单主线、显式缺口和确定性评分。
- 正式学习反馈会产生继续、保持开放或高风险调整决策；旧 StagePath/Evidence/Adjustment 写接口在 production 返回 410。
- 模型网关已支持一主一备、同一结构合同、缓存和失败原因记录；无模型时发布目录与确定性链路仍可用。
- candidate 评审台改为结构化字段和 blocking Eval；Worker 每周扫描最多 20 个到期来源，变化只生成候选和影响报告。
- 托管身份仅信任配置为 `chatgpt-hosted` 的可信域名，并拒绝原始 workers.dev 入口伪造邮箱。
- 本地验收：225 项领域测试、6 项构建契约、TypeScript、lint、production build、17 个迁移、秘密扫描、delivery precheck 和 Agentic HTTP 端到端全部通过。

最新外部阻塞：远程 D1 仍需执行 `0013-0017`，ChatGPT 托管身份和线上 smoke 尚未联调；Qwen/GLM 官方 API 凭据未配置，真实模型 benchmark 暂未运行。架构收口完成，下一步直接进入“多课程取舍与方案检查”功能优化，不再开启新的底层架构轮。

## 2026-09-01 模型运行层收口

- Qwen/GLM 使用独立官方 OpenAI-compatible API，通过统一 provider adapter 接入；具体模型可覆盖结构化输出能力。
- 三个正式模型任务为 `learning_intent.v1`、`course_outline.v1` 和 `unit_node_mapping.v1`，均经过 Zod 与 grounding 双重校验。
- timeout、429、5xx 和协议错误允许有限重试与备用切换；虚构章节、未知节点和业务校验失败进入评审，不允许备用绕过。
- 新增 `0017_model_runtime_trace.sql`，模型 attempt 可关联 request、Mastra workflow 和 DecisionRecord；内部评审页新增“模型运行”Trace。
- 真实 benchmark 已改为直接测试模型任务，输出到被忽略的 `outputs/model-benchmark/`；无凭据时明确跳过，不冒充通过。
- Qwen `qwen3.8-flash` 与 GLM `glm-5.3-flash` 均通过 8/8 golden cases；Qwen 20,473ms，GLM 35,115ms，正式确定 Qwen 主、GLM 备。
- 本地密钥只在被 Git 忽略的 `.env.local` 与 `.dev.vars`，秘密扫描通过；生产必须改用托管 secret。
- 真实陌生课程链已验证：目录提取、章节多节点映射、workflow/decision Trace 与 candidate 暂停评审均生效。
- 本地验证：18 个迁移、232 项领域测试、生产构建、6 项构建契约、lint、typecheck、秘密扫描、Agentic HTTP 验收和 delivery precheck 全部通过。
- 模型底座至此冻结；下一步直接进入多课程取舍和方案检查功能，不再新增底层框架。

## 当前准确阻塞

- 远程 D1 尚未执行 `0013-0018`，生产托管 secret、ChatGPT 托管身份和线上 smoke 尚未联调。
- 本地模型与正式链已通过，不再是功能优化阻塞项。

## 2026-09-01 功能学习闭环 V3

- 新增 `0018_functional_learning_loop.sql`，活动持久化准确学习范围，Learning Signal 保存情景题和反馈上下文。
- `LearningIntakeV2` 支持最多 8 门材料；陌生课程可通过 `personal_ready` 只对所属 owner 采用，不进入共享 catalog。
- Curriculum Solver v3 保存课程比较、用户约束和 `StudySegment`；AI PM 当前组合默认不超过 3 门，纯 builder 课程不再作为默认产品前置。
- 新增方案 revision：固定、暂缓、排除课程和指定章节均创建新版本，确认前不覆盖当前路线。
- 正式活动不再使用 `inferProfile / routeFor / bridgeNode`；canonical node 直接进入学习运行时，旧表只承担存储兼容。
- 可选情景题提交前不泄漏答案；课程原测试、卡住和情景判断会物化为推进、针对性回看、缩小范围或前置修复。
- 第一周至少一条有效信号即可生成自动摘要与第二周草案，用户轻确认后继续；历史周、活动和信号保留。
- `/learn` 已重构为多课程输入、有限方案比较、引导式调整、准确片段执行、轻反馈和下一周确认；390px 无严重横向溢出。
- 本地 D1 已直接应用 `0018`；19 个迁移、237 项领域测试、typecheck、lint、秘密扫描、production build、Agentic 两周 HTTP 验收和 Course Intelligence 浏览器验收通过。
- 当前本地预览：`http://127.0.0.1:5176/learn`。

准确下一步：停止新增底层架构；用真实 AI PM 目标和 3–5 组多课程集合做课程取舍质量评审，再细化前端文案与视觉。公开部署前执行远程 `0013-0018`、托管身份联调和 production smoke。

## 2026-09-03 学习处境编排重构

- 新增 `LearningOrchestrationState` 读模型，把现有课程智能、学习状态和用户资源重新组织为学习处境、本周任务包、能力模型和学习控制台。
- 零材料用户成为一等入口：`zero_material` 进入目标假设与起点诊断，不再被误解释为材料过载。
- 学习页从“课程组合/方案版本”转为“判断学习处境、本周只做一件事、能力任务包”；课程名降级为来源片段，任务以知识点和能力为主。
- 成长页新增路径分叉和能力模型：路径深度与能力等级分开呈现，突出当前阶段、能力维度和下一验证。
- 工作台改为学习控制台雏形：来源中心、测试机、成果陈列室，而不是放课程链接的杂物区。
- 新增语义化 API：处境诊断、来源分流、任务包生成、测评提交、成果评审；当前复用现有服务与数据结构，未新增迁移。
- 新增 `docs/product/TRELLIS_HIGH_TRUST_REFERENCE_BASELINE.md`，沉淀高可信跨界参考机制：Khan Academy、Duolingo、Coursera Skills Graph、Open edX、Canvas、Moodle、H5P、Anki/FSRS、OATutor/pyBKT、Linear、Notion、Readwise、GitHub Review、Figma Dev Mode 等。
- 本地验证：`npm run typecheck`、`npm run test:domain`、`npm run check` 全部通过；领域测试 241 项。

准确下一步：先跑 `/learn`、`/grow`、`/workbench` 桌面与 390px 浏览器验收，清掉旧“课程方案/路线管理/Course Intelligence”外显文案残留；再把来源中心、测试机和成果陈列室从投影视图升级为持久对象，并决定是否引入 `ts-fsrs`、H5P/xAPI 或轻量 BKT。公开部署仍未完成，阻塞是远程 D1、生产 secrets、ChatGPT 托管身份联调和线上 smoke。

## 2026-09-02 连续学习体验 MVP

- 新增 `0019_learning_continuity.sql`，正式活动支持未开始、进行中、暂停、完成、最近打开、实际用时与暂停原因。
- 新增 start、pause、location、resource attachment API；`/api/learning/current` 返回 `resumeState`、`sourceResolution`、`latestAdaptation`、路线摘要和附加资源。
- 点击课程来源只记录开始；刷新和跨设备读取仍恢复同一片段。来源分 `exact / course_root / missing`，用户补充位置不污染共享课程。
- 反馈后的推进、保持开放、缩范围和补前置结果会持久显示，不再只在一次响应中消失。
- `/learn` 已按路线状态、课程层叠、当前片段、适配说明、连续进度和下一周重构；方案检查保持浅色阅读面，反馈与路线调整使用抽屉。
- `/grow` 默认当前路线和真实能力信号；计划中节点不算成长。`/workbench` 可附加辅助内容到当前片段，但不改变课程取舍。
- 桌面、1024 与 390 视口通过，无严重横向溢出；新截图为 `docs/acceptance-continuous-learning-*.png`。
- 完整本地发布门通过：`npm run check`、239 项领域测试、20 个迁移、6 项构建契约、Course Intelligence 浏览器验收与 `delivery:precheck`。

当前本地预览：`http://127.0.0.1:5175/learn`。公开发布仍需远程 D1 `0013-0019`、ChatGPT 托管身份联调、生产 secrets、部署和线上 smoke。下一轮应直接做真实 AI PM 多课程组合的产品质量评审与功能优化，不再扩 Agent 架构。

## 2026-09-02 真实使用断点优化

- `/learn` 已补齐真实恢复状态：未开始、已打开未反馈、暂停、继续和完成均有明确原因与下一步动作。
- 来源定位从技术 kind 转为用户可读精度：缺少可打开位置、只能到课程主页、可直达片段、个人补充的准确位置。
- 反馈后的系统变化不再只闪现一次，改为 `adaptationTimeline`：触发信号、变更摘要、是否已应用可跨刷新查看。
- 学习页新增常驻但克制的路线管理摘要：已采用、暂缓、排除、固定、待确认版本；详细操作仍在二级面板。
- `/grow` 默认当前路线视角，突出当前阶段、最近能力信号、下一里程碑、节点为何在当前阶段和下一次验证方式。
- `/workbench` 的收藏资源已能显示学习上下文状态：已附加当前片段、已关联当前节点、可转课程候选、未整理。
- 移动端验收覆盖主学习动作、导航可达和无严重横向溢出。
- 本地验证：`npm run test:domain`、`npm test`、`npm run acceptance:course-intelligence`、`npm run check` 全部通过。

下一步不新增页面或 Agent；优先用真实 AI PM 目标和 3-5 组多课程集合做质量评审，然后再决定是否微调课程取舍、文案和路线管理交互。公开发布阻塞仍是远程 D1 `0013-0019`、生产 secrets、ChatGPT 托管身份联调、部署和线上 smoke。

## 2026-09-02 内测闭环与作品集完善

- 新增中高级作品集内测基线：`docs/product/TRELLIS_INTERNAL_TEST_PLAN.md`，覆盖首次进入、开始学习、来源定位、中断恢复、反馈变化和工作台资料引用。
- 新增 `docs/product/TRELLIS_INTERNAL_TEST_LOG.md`，作为真实人工内测记录入口；自动验收只作为基线，不替代用户观察。
- 新增 `docs/product/TRELLIS_PORTFOLIO_EVIDENCE_MATRIX.md`，把作品集主张映射到产品证据、工程证据和内测观察。
- `docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md` 已从旧课程切片叙事更新为“连续学习编排”叙事。
- 新增 `docs/engineering/TRELLIS_DEPLOYMENT_DECISION.md`：产品本体继续采用 Cloudflare Workers + D1；Vercel/GitHub Pages 只适合静态作品集展示，不承载当前动态应用。
- 新增 `npm run acceptance:internal-test-loop`，自动覆盖 5 条内测剧本骨架并生成 `docs/acceptance-internal-test-*.png`。
- `delivery:precheck` 已纳入内测文档、部署决策、内部验收脚本和内测截图。
- 本地验证：`npm run acceptance:internal-test-loop`、`npm run check`、`npm run acceptance:course-intelligence`、`npm run delivery:precheck`、`npm run lint` 全部通过。

下一步优先执行真实人工内测记录，至少 5 条；根据卡点做小范围 UI/文案调整，再整理 5-8 分钟作品集讲述稿。公开测试仍后置。

## 2026-09-02 Archify 风格架构图

- 本机未找到 `archtify`、`archify` 或 Mermaid CLI `mmdc` 命令，因此未生成 PNG/SVG 渲染产物。
- 新增 `docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md`，作为可审阅、可渲染的图源文档。
- 图源包含技术架构图、学习闭环时序图、工作台资料闭环时序图、内测与准发布时序图。
- `docs/README.md` 已加入该架构图入口。
- `delivery:precheck` 已把 `docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md` 纳入交付资产。
- 本地验证：`npm run delivery:precheck`、`npm run lint` 通过。

后续如果要生成作品集 PNG/SVG，需要安装或提供 archtify/archify 渲染工具；当前 Mermaid 源图可直接用于支持 Mermaid 的文档平台。

## 2026-08-31 仓库整理

- 已创建 `codex/trellis-production-remediation`，相对 `origin/main` 拆成三笔可审阅提交：运行时、产品界面、交付证据。
- 本地工作树干净；`npm run check`、`acceptance:course-intelligence` 和 `delivery:precheck` 全部通过。
- `.agents/`、`AGENTS.local.md`、`skills-lock.json` 与旧生成截图已隔离为本地工具/产物，不进入 Trellis 产品提交。
- 用户已确认远端为私有并授权同步 `memory/`；`codex/trellis-production-remediation` 已推送，仍未自动合并 `main`。
- 脚本已按 `acceptance / release / compatibility / legacy / lib` 分类，当前 Course Intelligence 不再依赖旧作品集验收模块。
- 文档索引已按当前契约、当前工程、交付、历史兼容和归档重写；本地临时浏览器产物已清理。
- 已安全删除完全并入 main 且远端已删除的 `feat/evidence-review-engine-v03` 本地分支；其他未合并分支保留。

## 2026-08-30 全工程审计

- 已按用户要求安装并完整盘点 `mattpocock/skills` 的 37 个 skill；这些 skill 只用于 Trellis 工程分析，不作为产品功能灵感。
- 完整报告：`docs/engineering/TRELLIS_FULL_ENGINEERING_AUDIT_2026-08-30.md`。
- 当前最大风险是 48 个 tracked 修改和 104 个 untracked 项未形成可回滚版本。
- Course Intelligence 的主要工程断点是 D1 catalog 仍依赖代码 baseline，以及 canonical graph 被桥接回 legacy node。
- 补充发布阻塞：每请求 seed、curriculum activation 非原子、迁移 journal 分叉、CI 未运行领域测试、legacy BYOK 明文存储、生产依赖 4 个 high 漏洞。
- 当前判断：本地 baseline 演示 Go；真实用户连续使用和公开生产部署 No-Go。
- 下一步先建立 fixed point、glossary/ADR 和 decision map，再处理发布阻塞并实现 published catalog 与 canonical learning runtime 两条 tracer-bullet。
