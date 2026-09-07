# Trellis 功能与技术架构图

> 状态：作品集内测版架构图源  
> 日期：2026-09-05  
> 说明：本文保留 Mermaid 迁移前图源；正式 Archify JSON/HTML 位于 `docs/architecture/archify/`

## 工具说明

Archify 官方仓库为 `https://github.com/tt-a1i/archify`。本文件中的 Mermaid 图是迁移前的审阅记录；正式图已经按 Archify typed JSON IR 生成，并通过 `validate`、`deliver` 和浏览器 `visual-check`。

## 一、功能架构

这张图表达 Trellis 的真实产品能力链，而不是把三个页面当作三个孤立模块。页面只是能力的入口，核心价值是持续回答“现在最值得推进什么，以及为什么”。

```mermaid
flowchart LR
  subgraph Input[进入与处境判断]
    Goal[模糊目标]
    Materials[已有材料或零材料]
    Situation[学习处境诊断\n目标假设 / 起点 / 时间 / 不确定性]
  end
  subgraph Knowledge[知识与内容理解]
    Normalize[来源接入与标准化]
    Decompose[内容拆解\n课程 / 文章 / 帖子 → 知识点与活动片段]
    Map[能力地图\n节点 / 前置 / 分支 / 证据标准]
    Coverage[覆盖与缺口判断\n重复 / 缺口 / 可信度 / 时效]
  end
  subgraph Decide[个性化决策]
    Prioritize[下一最佳推进\n目标、能力、时间、状态与时效]
    Compose[周任务包\n核心任务 + 可选任务 + 顺序 + 停止条件]
    Explain[决策解释\n为什么现在做、为什么暂缓、改变了什么]
  end
  subgraph Learn[学习执行]
    Context[任务上下文\n目标 / 片段 / 解释 / 参考材料]
    Practice[理解与练习\n场景题 / 复述 / 真实任务]
    Resume[连续状态\n开始 / 中断 / 暂停 / 恢复 / 定位]
  end
  subgraph Evidence[能力验证与成长]
    Assess[多信号评估\n答案 / 自评 / 作品 / 行为表现]
    Adapt[动态调整\n推进 / 回看 / 缩小 / 补前置]
    Growth[能力画像与路径\n当前阶段 / 分支 / 里程碑 / 边界]
  end
  subgraph Console[学习控制台]
    SourceCenter[来源中心\n输入、映射、分诊、候选]
    TestMachine[验证台\n待测能力、题目、复测、量规]
    Gallery[成果陈列\n作品、判断、证据、可迁移成果]
  end
  Goal --> Situation
  Materials --> Situation
  Situation --> Prioritize
  Materials --> Normalize
  Normalize --> Decompose --> Map
  Map --> Coverage
  Situation --> Coverage
  Coverage --> Prioritize
  Map --> Prioritize
  Prioritize --> Compose --> Explain
  Explain --> Context --> Practice --> Assess
  Context --> Resume
  Practice --> Resume
  Assess --> Adapt --> Compose
  Assess --> Growth
  Growth --> Prioritize
  Normalize --> SourceCenter
  SourceCenter --> Decompose
  TestMachine --> Assess
  Assess --> Gallery
  Gallery --> Growth
  SourceCenter -.辅助引用.-> Context
```

### 功能架构的页面映射

| 用户入口 | 承担的产品职责 | 不应承担的职责 |
|---|---|---|
| `/learn` 学习 | 展示当前处境、本周任务包、任务上下文、反馈和调整 | 让用户自己从课程名称中设计路线 |
| `/grow` 成长 | 展示能力模型、路径分支、阶段、证据和下个里程碑 | 只展示课程完成数或静态卡片目录 |
| `/workbench` 控制台 | 管理来源、验证候选能力、沉淀成果并连接学习上下文 | 充当“所有没地方放的链接”的杂物区 |
| `/internal/course-intelligence` | 审核内容解析、映射、模型运行和发布质量 | 作为普通用户学习入口 |

## 二、技术架构

技术图按“请求读模型”和“业务写入/智能决策”分开，避免把 LLM、Mastra 或页面误当成业务事实源。

```mermaid
flowchart TB
  subgraph Client[浏览器与用户入口]
    Learn[/learn\n学习任务包与连续学习]
    Grow[/grow\n能力模型与路径分支]
    Console[/workbench\n来源中心 / 验证台 / 成果]
    Review[/internal/course-intelligence\n内部内容与模型评审]
  end
  subgraph Transport[Next/Vinext HTTP 层]
    ReadRoutes[读路由\ncurrent / workspace / orchestration / intelligence]
    WriteRoutes[写路由\nintake / confirm / start / pause / feedback / evidence]
    SourceRoutes[来源路由\n资源保存 / 附加 / 分诊]
    ReviewRoutes[内部评审路由\ncandidate / model-runs / decisions]
  end
  subgraph Application[应用与领域模块]
    LearningService[LearningApplicationService\n状态机、活动、证据、周复盘]
    IntelligenceService[CourseIntelligenceService\n目录、课程版本、路线确认]
    Orchestration[LearningOrchestrationState\n学习处境 / 任务包 / 能力模型 / 控制台读模型]
    Solver[Curriculum Solver v3\n目标节点、前置闭包、课程片段与缺口]
    Adaptation[Decision Kernel\n信号解释、推进、回看、补前置、提案]
    ContentRules[内容与状态规则\n发布闸门、状态迁移、精度校验]
  end
  subgraph Intelligence[可替换智能层]
    Workflows[Mastra Workflows\n分析 / 编排 / 调整 / 来源演进]
    Gateway[Model Gateway\n结构化合同、grounding、超时、重试、缓存、trace]
    Primary[主模型 Provider\nQwen / OpenAI-compatible]
    Backup[备用模型 Provider\nGLM / OpenAI-compatible]
    Baseline[确定性 Baseline\n无模型密钥仍可运行]
  end
  subgraph Truth[业务事实与审计]
    Catalog[(D1 Published Catalog\n来源、课程版本、章节、节点映射)]
    Runtime[(D1 Learning Runtime\n路线、周计划、活动、信号、知识状态)]
    UserData[(D1 User Context\n资源、附件、个人来源覆盖)]
    Decisions[(D1 Decision Records\n提案、确认、调整、来源演进)]
    WorkflowStore[(Mastra D1Store\n可暂停工作流快照)]
  end
  subgraph Outside[外部系统]
    CourseSites[课程与公开来源\n外部 URL / 课程平台]
    HostedIdentity[ChatGPT 托管身份\n生产 owner 映射]
  end
  Learn --> ReadRoutes
  Grow --> ReadRoutes
  Console --> ReadRoutes
  Review --> ReviewRoutes
  Learn --> WriteRoutes
  Console --> SourceRoutes
  ReadRoutes --> Orchestration
  ReadRoutes --> LearningService
  WriteRoutes --> LearningService
  WriteRoutes --> IntelligenceService
  SourceRoutes --> LearningService
  ReviewRoutes --> IntelligenceService
  LearningService --> ContentRules
  LearningService --> Adaptation
  IntelligenceService --> Solver
  IntelligenceService --> ContentRules
  Orchestration --> LearningService
  Orchestration --> IntelligenceService
  Solver --> Catalog
  Adaptation --> Runtime
  IntelligenceService --> Workflows
  IntelligenceService --> Gateway
  Workflows --> WorkflowStore
  Gateway --> Primary
  Gateway --> Backup
  Gateway --> Baseline
  LearningService --> Runtime
  LearningService --> UserData
  LearningService --> Decisions
  IntelligenceService --> Catalog
  IntelligenceService --> Decisions
  ReadRoutes --> Runtime
  ReadRoutes --> UserData
  ReviewRoutes --> Decisions
  Learn -.打开精确片段.-> CourseSites
  SourceRoutes -.保存来源链接.-> CourseSites
  Transport -.可信身份.-> HostedIdentity
```

## 三、关键时序：一次“下一最佳学习任务”如何产生

```mermaid
sequenceDiagram
  autonumber
  actor User as 用户
  participant UI as /learn
  participant API as Learning HTTP
  participant Read as Orchestration Read Model
  participant LS as LearningApplicationService
  participant CI as CourseIntelligenceService
  participant D1 as D1 业务事实源
  participant Agent as Workflow + Model Gateway
  participant Source as 外部来源
  User->>UI: 输入模糊目标，可选择添加材料
  UI->>API: POST /api/learning/intake
  API->>CI: 创建处境与路线提案
  CI->>D1: 读取发布目录、能力图、课程片段
  CI->>Agent: 解析目标、拆解来源、映射知识点
  Agent-->>CI: 结构化候选结果
  CI->>CI: 确定性校验与课程片段求解
  CI->>D1: 保存 draft、DecisionRecord、候选结果
  API-->>UI: 目标假设、能力缺口、候选任务包
  User->>UI: 确认路线并开始本周任务
  UI->>API: POST /api/learning/curricula/:id/confirm
  API->>LS: 激活路线与周任务包
  LS->>D1: 原子写入活动、计划和确认记录
  UI->>API: GET /api/learning/orchestration
  API->>Read: 组合处境、任务包、能力、控制台
  Read->>D1: 读取活动、信号、资源和知识状态
  API-->>UI: 现在最值得推进的知识点与原因
  User->>UI: 打开任务并学习具体片段
  UI->>API: POST /api/learning/runs/:id/start
  API->>LS: 记录开始、最近打开和来源精度
  LS->>D1: 保存连续学习状态
  UI-->>Source: 打开精确片段或提示补充定位
  User->>UI: 完成任务、提交答案/场景题/自评/作品
  UI->>API: POST /api/learning/runs/:id/feedback
  API->>LS: 记录学习信号与实际用时
  LS->>Agent: 解释信号并生成调整候选
  Agent-->>LS: 推进、回看、缩小或补前置
  LS->>D1: 保存信号、能力状态、调整与 DecisionRecord
  API-->>UI: 学到了什么、能力变化、下一步为何变化
```

## 四、架构判断

- D1 是用户路线、活动、证据、知识状态和决策记录的业务事实源；刷新、重启和跨设备都从这里恢复。
- `LearningOrchestrationState` 是面向页面的稳定读模型，隐藏多个存储和服务的拼装复杂度。
- `CourseIntelligenceService` 负责内容和路线候选；`LearningApplicationService` 负责学习执行、证据和状态迁移；二者通过读模型协作，不把课程标题直接当作学习路线。
- 模型和工作流只能产生结构化候选，发布闸门、状态机和用户确认决定什么能进入正式状态。
- 外部课程平台负责原始内容；Trellis 负责拆解、映射、优先级、任务上下文、反馈和能力证据，不复制受版权保护的全文。
- “智能”不等于一个聊天框，而是连续的判断链：处境判断 → 内容拆解 → 能力映射 → 优先级 → 任务组合 → 证据解释 → 后续调整。

## 五、当前限制

- 当前图源已对应本地实现；仍未生成 Archify 原生 PNG/SVG，因为指定仓库不可访问且本机无渲染命令。
- 来源中心、验证台和成果陈列目前主要由读模型投影；要支持跨刷新编辑、候选确认和外部账号持续同步，还需将这些投影升级为持久对象。
- 生产发布仍受远程 D1 迁移、生产 secrets、托管身份联调和线上 smoke 阻塞；本地图不代表已经部署上线。
