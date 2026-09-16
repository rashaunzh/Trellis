export type Line = "G" | "J" | "B" | "I";
export type Horizon = "active" | "near" | "later" | "paused" | "done" | "proposal";
export type Acceptance = "unreviewed" | "passed" | "rework" | "waived";

export type ConceptCard = {
  id: string;
  title: string;
  module: string;
  officialDefinition: string;
  plainExplanation: string;
  example: string;
  misconception: string;
  sourceUrl: string;
  familiar: boolean;
};

export type TrellisRecord = {
  id: string;
  title: string;
  recordType: "task" | "artifact";
  line: Line;
  module: string;
  projectId: string;
  scheduleRole: "focus" | "support" | "maintain" | "candidate" | "paused";
  status: Horizon;
  estimatedMinutes: number;
  actualMinutes: number;
  coreAction: string;
  learningScope: string;
  executionMethod: string;
  completionCriteria: string;
  evidence: string;
  blockers: string;
  nextStep: string;
  aiReview: string;
  acceptance: Acceptance;
  sourceUrl: string | null;
  notes: string;
};

export const lineMeta: Record<Line, { name:string; short:string; purpose:string; color:string }> = {
  G: { name:"学习成长", short:"成长", purpose:"建立计算机、AI、Agent 与产品化能力", color:"#236f5b" },
  J: { name:"职业发展", short:"职业", purpose:"用真实岗位要求倒推能力、作品证据与职业动作", color:"#805b1d" },
  B: { name:"作品分享", short:"作品", purpose:"通过低成本发布与真实反馈验证方向", color:"#81508f" },
  I: { name:"想法收集", short:"想法", purpose:"连接外部 Inbox，判断想法进入哪条路线", color:"#345f96" },
};

export const horizonMeta: Record<Horizon, { label:string; help:string }> = {
  active: { label:"进行中", help:"已经开始，本周继续推进" },
  near: { label:"短期启动", help:"接下来一至两周可以启动" },
  later: { label:"长期规划", help:"保留方向感，暂不承诺" },
  paused: { label:"暂停", help:"有意识地不投入" },
  done: { label:"完成", help:"已留下可核验结果" },
  proposal: { label:"待确认", help:"AI 或用户提出，尚未成为正式计划" },
};

export const routeStages: Record<Line, Array<{ id:string; order:number; name:string; topics:string }>> = {
  G: [
    { id:"G1", order:1, name:"计算机与开发基础", topics:"Python · Git · CLI · API · SQL · 调试" },
    { id:"G2", order:2, name:"数据、数学与机器学习", topics:"NumPy · Pandas · 经典 ML · 评估" },
    { id:"G3", order:3, name:"深度学习与 PyTorch", topics:"张量 · autograd · 训练 · embeddings" },
    { id:"G4", order:4, name:"NLP、Transformer 与 LLM", topics:"token · attention · 预训练 · 推理" },
    { id:"G5", order:5, name:"LLM 应用工程", topics:"Prompt · API · RAG · 多模态 · Evals" },
    { id:"G6", order:6, name:"Agent 工程", topics:"tools · state · memory · MCP · recovery" },
    { id:"G7", order:7, name:"AI 产品与生产化", topics:"边界 · 指标 · 成本 · 安全 · 监控" },
    { id:"G8", order:8, name:"项目 / JD 驱动选修", topics:"微调 · 部署 · MLOps · 强化学习" },
  ],
  J: [
    { id:"J1", order:1, name:"目标岗位与 JD 样本", topics:"目标岗位 · 岗位分型 · 高频要求" },
    { id:"J2", order:2, name:"能力地图", topics:"产品 · AI · 数据 · 工程协作 · 业务" },
    { id:"J3", order:3, name:"差距与优先级", topics:"必须补齐 · 作品证明 · 加分项" },
    { id:"J4", order:4, name:"作品与证据", topics:"PRD · 原型 · Eval · 数据 · 上线复盘" },
    { id:"J5", order:5, name:"简历与面试叙事", topics:"简历 · STAR · 题库 · 模拟面试" },
    { id:"J6", order:6, name:"投递与反馈闭环", topics:"投递 · 面试反馈 · 路线修正" },
  ],
  B: [
    { id:"B1", order:1, name:"内容创作与发布", topics:"选题 · 最小发布 · 跨平台改写 · 反馈" },
    { id:"B2", order:2, name:"多媒体内容", topics:"脚本 · 分镜 · 剪辑 · 数据复盘" },
    { id:"B3", order:3, name:"待验证产品方向", topics:"研究 · 需求 · 原型 · 验证" },
  ],
  I: [
    { id:"I1", order:1, name:"外部 Inbox", topics:"Obsidian / Hermes 收集、去重与分类" },
    { id:"I2", order:2, name:"判断与连接", topics:"进入路线 · 建立项目 · 暂停 · 放弃" },
  ],
};

export const starterConcepts: ConceptCard[] = [
  {
    id:"C-EVAL-01",
    title:"Evaluation / 评测",
    module:"G5 · LLM 应用工程",
    officialDefinition:"系统地测量 AI 系统在明确任务、数据和指标上的表现，以判断它是否满足预期要求。",
    plainExplanation:"先说清楚要测什么、拿什么题测、怎样算好，再看结果；不是凭一次聊天体验下结论。",
    example:"用固定的 6 道题、同一批资料和四项评分规则测试 Notebook 的回答与引用。",
    misconception:"把模型排行榜分数、主观好不好用或一次成功回答直接当作产品评测。",
    sourceUrl:"https://platform.openai.com/docs/guides/evals",
    familiar:false,
  },
  {
    id:"C-RAG-01",
    title:"RAG / 检索增强生成",
    module:"G5 · LLM 应用工程",
    officialDefinition:"在生成回答前，从外部知识源检索相关内容，并将检索结果作为模型生成时的上下文。",
    plainExplanation:"先找资料，再让模型依据找到的资料回答；关键不只是生成，还包括找得准不准和引用能否核验。",
    example:"Notebook 从导入的论文中找到相关段落，再基于这些段落回答问题并给出引用。",
    misconception:"只要上传了文件就是 RAG；忽略切分、检索、排序、引用和无答案拒答。",
    sourceUrl:"https://arxiv.org/abs/2005.11401",
    familiar:false,
  },
  {
    id:"C-AGENT-01",
    title:"Agent / 智能体",
    module:"G6 · Agent 工程",
    officialDefinition:"能够围绕目标循环地观察状态、选择动作、调用工具并根据结果继续推进的 AI 系统。",
    plainExplanation:"模型不只回答一次，而是知道目标、能用工具、能看结果，并决定下一步。",
    example:"读取当前 Trellis 任务 → 查询资料 → 生成修改提案 → 等待用户确认 → 写入任务。",
    misconception:"把任何带聊天框、提示词链或自动生成文本的应用都叫 Agent。",
    sourceUrl:"https://www.anthropic.com/research/building-effective-agents",
    familiar:false,
  },
  {
    id:"C-MCP-01",
    title:"MCP / Model Context Protocol",
    module:"G6 · Agent 工程",
    officialDefinition:"一种开放协议，用标准化方式让 AI 应用连接外部数据源、工具和工作流。",
    plainExplanation:"给不同 AI 一个共同的插座；Trellis 以后只需公开读取上下文、提出修改和确认写入等标准接口。",
    example:"Codex 或 ChatGPT 通过同一 MCP 工具读取 NB-01，并提交一条待确认的任务更新。",
    misconception:"MCP 本身会提供记忆、推理或自动化；它只是连接协议，能力仍由服务端实现。",
    sourceUrl:"https://modelcontextprotocol.io/introduction",
    familiar:false,
  },
];

function roadmapTask(
  id:string,
  title:string,
  line:Line,
  module:string,
  projectId:string,
  coreAction:string,
  executionMethod:string,
  sourceUrl:string|null = null,
  status:Horizon = "later",
):TrellisRecord {
  return {
    id,title,recordType:"task",line,module,projectId,status,
    scheduleRole:status === "paused" ? "paused" : "candidate",
    estimatedMinutes:30,actualMinutes:0,coreAction,
    learningScope:"这是路线入口任务，只做到能够实践和判断下一步，不要求一次学完本阶段。",
    executionMethod,
    completionCriteria:"留下一份可打开的结果，并据此决定下一项任务。",
    evidence:"",
    blockers:"如果当前项目或 JD 不需要，保持长期规划或暂停，不要为了完整而启动。",
    nextStep:executionMethod.split("→")[0].trim(),
    aiReview:"",
    acceptance:"unreviewed",
    sourceUrl,
    notes:"",
  };
}

const roadmapRecords:TrellisRecord[] = [
  roadmapTask("G-02","完成一个可解释的机器学习基线项目","G","G2 · 数据、数学与机器学习","AI 技术基础","用真实数据走通清洗、建模和评估，建立 ML 直觉。","选择小数据集 → 建立基线 → 解释指标 → 分析一个错误样例","https://developers.google.com/machine-learning/crash-course"),
  roadmapTask("G-03","用 PyTorch 训练并解释第一个模型","G","G3 · 深度学习与 PyTorch","AI 技术基础","把张量、autograd 和训练循环连接成一个能运行的结果。","完成官方 Quickstart → 改一个参数 → 比较结果 → 解释训练循环","https://pytorch.org/tutorials/beginner/basics/quickstart_tutorial.html"),
  roadmapTask("G-04","画出 Transformer 的信息流","G","G4 · NLP、Transformer 与 LLM","AI 技术基础","先建立 token、attention 和层结构的整体图，再决定是否深入公式。","阅读原论文图示 → 画自己的信息流 → 用例子解释 attention → 标出不理解处","https://arxiv.org/abs/1706.03762"),
  roadmapTask("G-06","实现一个带工具与确认节点的 Agent","G","G6 · Agent 工程","Agent 实践","用最小项目理解工具、状态、循环、错误恢复和 human-in-the-loop。","定义单一目标 → 接一个工具 → 保存状态 → 加确认节点 → 制造并恢复一次失败","https://www.anthropic.com/research/building-effective-agents"),
  roadmapTask("G-07","为一个 AI 功能写生产化检查表","G","G7 · AI 产品与生产化","AI 产品实践","把能力边界、指标、成本、延迟、安全和监控落到同一功能。","选择已有 AI 功能 → 写成功指标 → 写失败边界 → 补成本与监控 → 评审取舍","https://github.com/microsoft/Microsoft-AI-Decision-Framework"),
  roadmapTask("G-08","从项目或 JD 选择一个专项选修","G","G8 · 项目 / JD 驱动选修","专项选修","只有真实项目或高频 JD 需要时，才启动微调、部署或 MLOps 专项。","引用触发它的项目或 JD → 写清预期证据 → 比较替代方案 → 决定启动或暂停",null,"paused"),
  roadmapTask("J-02","建立目标岗位能力地图","J","J2 · 能力地图","岗位能力发展","把真实 JD 归并为产品、AI、数据、工程协作与业务能力。","归一 JD 关键词 → 聚类能力 → 记录频率 → 为每项链接现有证据"),
  roadmapTask("J-03","确定三个最优先的能力缺口","J","J3 · 差距与优先级","岗位能力发展","区分必须补齐、需要作品证明和仅属加分的要求。","对照能力地图 → 评估当前证据 → 选三个缺口 → 连接学习或作品任务"),
  roadmapTask("J-05","把 Notebook 测评写成面试故事","J","J5 · 简历与面试叙事","岗位能力发展","将真实过程转换为问题、判断、行动、指标和结果，而不是罗列功能。","写背景与约束 → 说明关键判断 → 链接证据 → 写结果与反思 → 录一次口述"),
  roadmapTask("J-06","建立投递与反馈闭环","J","J6 · 投递与反馈闭环","岗位能力发展","用真实市场反馈修正路线、作品和目标岗位。","记录岗位与版本 → 保存面试反馈 → 区分偶发与重复信号 → 更新一项路线决策"),
  roadmapTask("B-02","把一份真实成果改成首条短视频","B","B2 · 多媒体内容","内容渠道实验","验证脚本和表达，不先建设完整视频流水线。","从现有成果选一个结论 → 写 30 秒脚本 → 做最小剪辑 → 发布或保存待发 → 记录反馈"),
  roadmapTask("B-03","写清待验证产品的首个产品假设","B","B3 · 待验证产品方向","待验证产品","把产品方向当作待验证假设，而不是默认长期运营主线。","选择目标用户 → 写核心问题 → 定义最小方案 → 列验证证据 → 决定是否建立项目"),
  roadmapTask("I-02","判断一批 Inbox 想法的去向","I","I2 · 判断与连接","信息流接口","验证 Trellis 只保存链接、判断和下一步是否足够。","从 Obsidian / Hermes 取 5 条候选 → 去重 → 关联路线 → 进入项目、暂停或放弃"),
];

export const starterRecords: TrellisRecord[] = [
  {
    id:"NB-01", title:"确定 Notebook 测评对象与核心资料", recordType:"task", line:"G", module:"G5 · LLM 应用工程 · 1/6",
    projectId:"Notebook 测评", scheduleRole:"focus", status:"active", estimatedMinutes:30, actualMinutes:0,
    coreAction:"先固定一个可访问的 Notebook 和 3–5 份资料，避免评测对象持续变化。",
    learningScope:"只需要知道资料范围、版本和预期用途；暂不研究全部评测理论。",
    executionMethod:"选择 NotebookLM 或 Gemini Notebook → 粘贴 Notebook 页面链接 → 列出 3–5 份核心资料及版本 → 写一句希望它完成的工作",
    completionCriteria:"留下 Notebook 链接、资料清单和一句测评目标。",
    evidence:"", blockers:"如果还没有 Notebook，就先新建一个并放入两份最熟悉的资料。", nextStep:"用固定资料设计首批测试题。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:"https://notebooklm.google.com/", notes:""
  },
  {
    id:"NB-02", title:"设计首批 6 道可复现测试题", recordType:"task", line:"G", module:"G5 · LLM 应用工程 · 2/6",
    projectId:"Notebook 测评", scheduleRole:"focus", status:"near", estimatedMinutes:45, actualMinutes:0,
    coreAction:"用少量题目覆盖事实、无答案拒答、跨来源综合与引用定位。",
    learningScope:"先做 L1–L3，不追求完整 benchmark。",
    executionMethod:"写 2 道事实题 → 写 1 道资料中无答案的题 → 写 2 道跨来源综合题 → 写 1 道引用定位题 → 为每题补标准答案和证据位置",
    completionCriteria:"6 道题均有题型、来源、标准答案、证据位置和通过条件。",
    evidence:"", blockers:"答案不确定时回到原资料，不用模型生成的答案当标准答案。", nextStep:"定义本轮只会使用的四个指标。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:"https://allenai.org/data/qasper", notes:""
  },
  {
    id:"NB-03", title:"建立四项指标与 Bad Case 标签", recordType:"task", line:"G", module:"G5 · LLM 应用工程 · 3/6",
    projectId:"Notebook 测评", scheduleRole:"support", status:"near", estimatedMinutes:45, actualMinutes:0,
    coreAction:"只定义本轮会实际打分的指标，保证每项都能人工复核。",
    learningScope:"引用可核验率、拒答正确率、跨来源完整率、冲突识别率。",
    executionMethod:"为每项指标写一句定义 → 写计算或判断方法 → 写通过样例 → 写失败样例 → 设计 Bad Case 标签",
    completionCriteria:"一页指标字典，每项指标都有定义、判断规则和正反例。",
    evidence:"", blockers:"延迟和成本没有可靠日志时只记录观察，不纳入总分。", nextStep:"按同一输入条件执行全部测试。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:"https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/", notes:""
  },
  {
    id:"NB-04", title:"执行测试并保存逐题证据", recordType:"task", line:"G", module:"G5 · LLM 应用工程 · 4/6",
    projectId:"Notebook 测评", scheduleRole:"focus", status:"later", estimatedMinutes:60, actualMinutes:0,
    coreAction:"在相同资料和提示条件下运行 6 道题，保存原回答、引用与人工评分。",
    learningScope:"执行优先，不在测试中途修改指标。",
    executionMethod:"记录输入条件 → 逐题提问 → 保存回答和引用 → 按冻结规则评分 → 标注 Bad Case → 记录实际用时",
    completionCriteria:"6 道题都有原始输出、引用、得分、问题标签和复核备注。",
    evidence:"", blockers:"中途发现规则不清时先记录，不回头改已完成题目的口径。", nextStep:"聚类 Bad Case 并形成结论。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:""
  },
  {
    id:"NB-05", title:"形成测评结论与产品建议", recordType:"task", line:"J", module:"J4 · 作品与证据 · 5/6",
    projectId:"Notebook 测评", scheduleRole:"focus", status:"later", estimatedMinutes:45, actualMinutes:0,
    coreAction:"从证据中回答适合什么、不适合什么、下一版该改什么。",
    learningScope:"区分事实、推断和建议。",
    executionMethod:"汇总四项指标 → 聚类 Bad Case → 写三条结论 → 写适用边界 → 写三条产品建议 → 链接证据",
    completionCriteria:"一份可被第三方复核的结论页，所有关键判断都能回到逐题证据。",
    evidence:"", blockers:"没有证据支撑的体验感受单独标为观察。", nextStep:"把完整过程整理成作品与复盘。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:"https://github.com/microsoft/Microsoft-AI-Decision-Framework", notes:""
  },
  {
    id:"NB-06", title:"发布 Notebook 测评作品与复盘", recordType:"artifact", line:"B", module:"B1 · 内容创作与发布 · 6/6",
    projectId:"Notebook 测评", scheduleRole:"maintain", status:"later", estimatedMinutes:60, actualMinutes:0,
    coreAction:"将真实测评过程转成作品页面，并提炼一份适合社交平台的短内容。",
    learningScope:"作品保留方法与证据，公开内容只讲一个清晰结论。",
    executionMethod:"整理目标与范围 → 放入测试集和指标 → 展示代表性 Bad Case → 写结论与建议 → 生成一条短内容 → 保存发布链接",
    completionCriteria:"一个完整作品链接和至少一份可发布内容草稿。",
    evidence:"", blockers:"涉及隐私或受限资料时只放脱敏截图和结构。", nextStep:"在周复盘中判断这条链路是否值得继续。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:""
  },
  {
    id:"J-01", title:"收集目标岗位的真实 JD 样本", recordType:"task", line:"J", module:"J1 · 目标岗位与 JD 样本",
    projectId:"岗位能力发展", scheduleRole:"support", status:"near", estimatedMinutes:60, actualMinutes:0,
    coreAction:"先用少量真实岗位校准方向，不把高级岗位的要求误当作入门基线。",
    learningScope:"目标城市与岗位类型；目标岗位及相邻岗位。",
    executionMethod:"保存岗位链接和原文 → 标注行业、年限、职责与技能 → 去掉重复招聘 → 标出入门可达与明显高级岗位",
    completionCriteria:"8 份有效 JD 及一页岗位分型。",
    evidence:"", blockers:"招聘链接失效时保存必要摘录和访问日期。", nextStep:"提取高频能力并建立证据映射。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:""
  },
  {
    id:"G-01", title:"完成 Python 与命令行基线自评", recordType:"task", line:"G", module:"G1 · 计算机与开发基础",
    projectId:"AI 技术基础", scheduleRole:"support", status:"later", estimatedMinutes:30, actualMinutes:0,
    coreAction:"用可执行小题判断真实起点，避免从头囤课程或跳过关键基础。",
    learningScope:"变量、函数、文件、HTTP API、Git 和命令行。",
    executionMethod:"运行或口述 6 个小任务 → 标记独立完成/需提示/未接触 → 保存卡点 → 选择一项最小补齐任务",
    completionCriteria:"一张基线表和下一项明确的基础任务。",
    evidence:"", blockers:"只判断能否完成，不因为语法不熟自我否定。", nextStep:"按基线选择 CS50P 或项目式补齐。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:"https://cs50.harvard.edu/python/", notes:""
  },
  {
    id:"B-01", title:"确定首个最小发布实验", recordType:"task", line:"B", module:"B1 · 内容创作与发布",
    projectId:"内容渠道实验", scheduleRole:"maintain", status:"later", estimatedMinutes:30, actualMinutes:0,
    coreAction:"从真实学习或项目中选一个结论，用最低成本发布并观察反馈。",
    learningScope:"只验证选题和表达，不先搭完整内容系统。",
    executionMethod:"选择一个已有过程 → 定义目标读者 → 写长文版 → 改写社区短帖版 → 发布或保存待发 → 记录反馈",
    completionCriteria:"两个平台版本、发布链接或待发稿，以及一次反馈记录。",
    evidence:"", blockers:"没有成熟成果也可以发布过程性发现，但必须明确它仍是实验。", nextStep:"根据反馈决定重复、调整或停止。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:""
  },
  {
    id:"I-01", title:"连接 Obsidian / Hermes Inbox", recordType:"task", line:"I", module:"I1 · 外部 Inbox",
    projectId:"信息流接口", scheduleRole:"candidate", status:"paused", estimatedMinutes:45, actualMinutes:0,
    coreAction:"定义外部 Inbox 向 Trellis 提交链接、摘要和去向判断的最小接口。",
    learningScope:"Trellis 不复制剪藏、全文或批量分类功能。",
    executionMethod:"列出现有 Inbox 字段 → 选择最小交换格式 → 生成一条示例 → 定义进入路线/项目/暂停的判断 → 保留未来 API 入口",
    completionCriteria:"一份最小交换格式和一条真实样例。",
    evidence:"", blockers:"Notebook 测评链路未验证前不开发自动同步。", nextStep:"先用手工粘贴验证字段是否够用。",
    aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:""
  },
  ...roadmapRecords,
];

export function normalizeHorizon(value: string): Horizon {
  const legacy: Record<string, Horizon> = {
    inbox:"proposal", backlog:"later", this_week:"near", in_progress:"active",
    pending_review:"active", cancelled:"paused",
  };
  return value in horizonMeta ? value as Horizon : legacy[value] ?? "later";
}

export function stars(minutes:number) {
  return Math.max(0.5, Math.round(minutes / 15) * 0.5);
}

export function firstStep(method:string, fallback:string) {
  return method.split(/\s*(?:→|\n)\s*/).map((item) => item.trim()).filter(Boolean)[0] || fallback;
}

export function contextPacket(item:TrellisRecord) {
  return [
    "# Trellis 任务上下文",
    `任务：${item.title}`,
    `主线：${lineMeta[item.line].name}`,
    `阶段：${item.module}`,
    `状态：${horizonMeta[item.status].label}`,
    `时间预算：${stars(item.estimatedMinutes)} 星（${item.estimatedMinutes} 分钟）`,
    `为什么现在做：${item.coreAction}`,
    `范围：${item.learningScope}`,
    `前置/卡点：${item.blockers || "无"}`,
    `下一步：${firstStep(item.executionMethod,item.nextStep)}`,
    `完成标准：${item.completionCriteria}`,
    `核心资料：${item.sourceUrl || "暂无"}`,
    "",
    "请先回答我的问题；如果建议修改任务或路线，把修改单独写成“待确认提案”，不要直接视为已确认。",
  ].join("\n");
}
