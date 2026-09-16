// V0.2 learning domain — 学习地图内容包（版本化、只读）
// 首期包含三条相互关联的路线：
//  1. ai-literacy    AI 通识与认知（共同主干）
//  2. ai-app-dev     AI 应用开发
//  3. ai-product     AI 产品经理
// 数学/Python/ML 属于条件性前置，仅当目标需要时展开（MVP 不内置）。

import type {
  LearningBranch,
  LearningContentPack,
  LearningEdge,
  LearningNode,
  LearningResource,
  LearningRoute,
  LearningTool,
  ResourceMapping,
  ToolMapping,
} from "./types.ts";
import { ACTIVITY_TYPES } from "./types.ts";
import { getReviewSignalsForNode } from "./signals.ts";

export const ROUTE_IDS = ["ai-literacy", "ai-app-dev", "ai-product"] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

const routes: LearningRoute[] = [
  {
    id: "ai-literacy",
    version: "1.1.0",
    title: "AI 通识与认知",
    description: "共同主干：解释模型为何有效、为何会失败，以及如何可靠使用 AI。",
  },
  {
    id: "ai-app-dev",
    version: "0.1.0",
    title: "AI 应用开发",
    description: "从使用与判断进入实际实现：提示工程、RAG、工具调用与评测。",
  },
  {
    id: "ai-product",
    version: "0.1.0",
    title: "AI 产品经理",
    description: "从问题定义进入能力设计、评估和产品决策。",
  },
];

// ── 模块定义（内容包内分组）──────────────────────────
export const MODULES = [
  { id: "ai-intro", routeId: "ai-literacy", name: "AI 是什么", order: 1 },
  { id: "ai-methods", routeId: "ai-literacy", name: "AI 的主要方法", order: 2 },
  { id: "ai-practice", routeId: "ai-literacy", name: "AI 的实践入口", order: 3 },
  { id: "ai-app-dev", routeId: "ai-app-dev", name: "AI 应用开发", order: 1 },
  { id: "ai-product", routeId: "ai-product", name: "AI 产品经理", order: 1 },
] as const;

// AI-For-Beginners 课程引用（真实可点击路径）
const AFB = "https://github.com/microsoft/AI-For-Beginners";
const AFB_LESSONS = `${AFB}/tree/main/lessons`;
const AFB_SETUP = `${AFB}/blob/main/lessons/0-course-setup/setup.md`;

const nodes: LearningNode[] = [
  // ── AI 通识与认知（主干，内容样本：Microsoft AI-For-Beginners）──
  {
    id: "ai-literacy.mechanism",
    routeId: "ai-literacy",
    moduleId: "ai-intro",
    title: "AI 基本概念与能力边界",
    titleEn: "Introduction to AI",
    description: "AI 是什么：AI 与传统程序的区别、弱 AI 与强 AI、AI 能做什么不能做什么。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "用自己的话区分 AI 与普通程序（学习 vs 指令）",
      "举例说明 AI 擅长与不擅长的任务各至少 2 个",
      "解释弱 AI（窄能力）与强 AI（通用智能）的差异",
    ],
    signals: getReviewSignalsForNode("ai-literacy.mechanism"),
    sourceRefs: [
      { label: "AI-For-Beginners · Lesson 1 Intro（课程与预习）", url: `${AFB_LESSONS}/1-Intro/README.md` },
      { label: "Lesson 1 作业 assignment", url: `${AFB_LESSONS}/1-Intro/assignment.md` },
      { label: "课程总览（12 周结构）", url: AFB },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能用自己的话定义 AI 并说明其学习本质；能给出至少 2 个 AI 能做/不能做的对比例子；能区分弱 AI 与强 AI，并指出当前主流 AI 属于弱 AI。",
  },
  {
    id: "ai-literacy.history",
    routeId: "ai-literacy",
    moduleId: "ai-intro",
    title: "AI 发展史：从符号主义到深度学习",
    titleEn: "History of AI",
    description: "AI 的三次浪潮：符号主义与专家系统、统计学习、深度学习，以及为什么 2012 年后深度学习爆发。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "按时间线说出 AI 发展的关键阶段",
      "解释专家系统为何受限（知识获取难、规则组合爆炸）",
      "说明深度学习兴起的三个条件（数据、算力、算法）",
    ],
    signals: getReviewSignalsForNode("ai-literacy.history"),
    sourceRefs: [
      { label: "AI-For-Beginners · Lesson 2 Symbolic（符号主义）", url: `${AFB_LESSONS}/2-Symbolic/README.md` },
      { label: "符号主义 Notebook：家族本体", url: `${AFB_LESSONS}/2-Symbolic/FamilyOntology.ipynb` },
      { label: "符号主义 Notebook：动物分类规则", url: `${AFB_LESSONS}/2-Symbolic/Animals.ipynb` },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能画出 AI 发展时间线（符号主义→统计学习→深度学习）；能解释专家系统的两个局限；能说出深度学习爆发的三个条件。",
  },
  {
    id: "ai-literacy.fit",
    routeId: "ai-literacy",
    moduleId: "ai-methods",
    title: "神经网络与深度学习",
    titleEn: "Neural Networks and Deep Learning",
    description: "从感知机到神经网络：模型如何从数据学习，规则方法与学习方法各自的适用场景。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "用感知机例子解释“从数据中学习”的含义",
      "对比规则方法（符号主义）与学习方法（神经网络）的适用场景",
      "解释训练与推理的区别",
    ],
    signals: getReviewSignalsForNode("ai-literacy.fit"),
    sourceRefs: [
      { label: "AI-For-Beginners · Lesson 3 Neural Networks（含感知机 Notebook）", url: `${AFB_LESSONS}/3-NeuralNetworks/README.md` },
      { label: "感知机 Notebook 与 lab", url: `${AFB_LESSONS}/3-NeuralNetworks/03-Perceptron/Perceptron.ipynb` },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能用感知机示例解释权重学习过程；能针对给定问题判断适合规则法还是学习法并给出理由；能区分训练阶段与推理阶段。",
  },
  {
    id: "ai-literacy.context",
    routeId: "ai-literacy",
    moduleId: "ai-methods",
    title: "数据、模型与训练",
    titleEn: "Data, Models and Training",
    description: "数据集、特征与标签如何塑造模型；训练与推理；数据分布对泛化与偏差的影响。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "说明数据集、特征、标签在训练中的作用",
      "解释“模型学到的是数据分布中的规律，不是事实”",
      "指出数据偏差如何导致模型偏见",
    ],
    signals: getReviewSignalsForNode("ai-literacy.context"),
    sourceRefs: [
      { label: "AI-For-Beginners · Lesson 3 自建框架（训练原理）", url: `${AFB_LESSONS}/3-NeuralNetworks/04-OwnFramework` },
      { label: "课程环境配置（Notebook 运行）", url: AFB_SETUP },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能说清训练数据如何影响模型行为；能用例子解释泛化与过拟合的直观含义；能指出至少一种数据偏差导致的风险。",
  },
  {
    id: "ai-literacy.architecture",
    routeId: "ai-literacy",
    moduleId: "ai-practice",
    title: "AI 实践环境与工具链",
    titleEn: "AI Practice: Notebooks and Tooling",
    description: "用 Notebook/Python 环境跑通一个 AI 示例：环境搭建、运行 notebook、理解一个分类或文本分析案例。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "在 Notebook 环境运行一个 AI 示例并解释输出",
      "理解 notebook/lab 式的动手学习流程",
      "复述一个简单分类或文本分析案例中模型做了什么",
    ],
    signals: getReviewSignalsForNode("ai-literacy.architecture"),
    sourceRefs: [
      { label: "课程环境搭建指南 setup", url: AFB_SETUP },
      { label: "AI-For-Beginners · Lesson 4 Computer Vision", url: `${AFB_LESSONS}/4-ComputerVision/README.md` },
      { label: "AI-For-Beginners · Lesson 5 NLP（文本分析）", url: `${AFB_LESSONS}/5-NLP/README.md` },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能运行一个 notebook 并用自己的话解释输出；能说明该案例中模型输入是什么、输出是什么、依据什么训练。",
  },
  {
    id: "ai-literacy.evaluation",
    routeId: "ai-literacy",
    moduleId: "ai-practice",
    title: "评测与实验验证",
    titleEn: "Evaluation and Verification",
    description: "用样例、指标和失败检查评估 AI 输出；理解“看起来对 ≠ 正确”；设计人工确认点。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "针对一个 AI 输出给出评估依据（对在哪、错在哪）",
      "设计至少一个失败检查（拒答/越界/幻觉）",
      "说明为什么关键决策需要人工确认",
    ],
    signals: getReviewSignalsForNode("ai-literacy.evaluation"),
    sourceRefs: [
      { label: "Lesson 1 作业（评估式练习）", url: `${AFB_LESSONS}/1-Intro/assignment.md` },
      { label: "Microsoft Learn：AI 基础模块", url: "https://learn.microsoft.com/ai" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能对给定 AI 输出给出具体评估依据而非笼统评价；能设计一个可执行的失败检查；能说明人工确认在什么场景必须。",
  },
  {
    id: "ai-literacy.responsibility",
    routeId: "ai-literacy",
    moduleId: "ai-practice",
    title: "AI 伦理与负责任使用",
    titleEn: "Responsible AI and Ethics",
    description: "识别隐私、偏见、滥用与自动化风险；负责任 AI 的实践原则；对具体场景做风险判断。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "识别一个具体 AI 应用的至少 2 类风险",
      "为每类风险给出缓解措施",
      "区分系统责任与使用者责任",
    ],
    signals: getReviewSignalsForNode("ai-literacy.responsibility"),
    sourceRefs: [
      { label: "AI-For-Beginners · Lesson 7 Ethics", url: `${AFB_LESSONS}/7-Ethics/README.md` },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能对具体 AI 场景识别 2 类以上风险并给出缓解措施；能区分系统责任与使用者责任；能说明偏见如何从数据进入模型。",
  },
  // ── AI 应用开发分支 ──────────────────────────────────
  {
    id: "ai-app-dev.prompting",
    routeId: "ai-app-dev",
    moduleId: "ai-app-dev",
    title: "提示工程基础",
    titleEn: "Prompting Fundamentals",
    description: "用任务说明、材料边界和输出格式稳定控制模型输出。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "写出包含任务、边界、格式三要素的提示",
      "对比不同提示对同一任务的输出差异",
    ],
    signals: getReviewSignalsForNode("ai-app-dev.prompting"),
    sourceRefs: [
      { label: "Google AI for Developers: Prompting Strategies", url: "https://ai.google.dev/gemini-api/docs/prompting-strategies" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "提示包含明确任务、材料边界与输出格式；能解释提示改动为何改变输出。",
  },
  {
    id: "ai-app-dev.rag",
    routeId: "ai-app-dev",
    moduleId: "ai-app-dev",
    title: "检索增强生成（RAG）",
    titleEn: "Retrieval-Augmented Generation",
    description: "把受控知识源接入模型：切分、检索、引用与无答案处理。",
    targetLevel: 2,
    isKeyMilestone: true,
    outcomes: [
      "画出 RAG 的检索→增强→生成链路",
      "说明引用与无答案处理为什么必要",
    ],
    signals: getReviewSignalsForNode("ai-app-dev.rag"),
    sourceRefs: [
      { label: "Google AI for Developers: RAG 相关指南", url: "https://ai.google.dev/gemini-api/docs/retrieval" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能说清 RAG 各环节作用；能指出不引用/不拒答的风险。",
  },
  {
    id: "ai-app-dev.tools",
    routeId: "ai-app-dev",
    moduleId: "ai-app-dev",
    title: "工具调用与动作",
    titleEn: "Tool Use and Actions",
    description: "让模型读取实时数据或执行受控动作，并处理权限边界。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "说明工具调用中权限边界与确认点的作用",
    ],
    signals: getReviewSignalsForNode("ai-app-dev.tools"),
    sourceRefs: [
      { label: "Google AI for Developers: Tools", url: "https://ai.google.dev/gemini-api/docs/function-calling" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能说明工具调用链路与权限边界；能指出高风险动作必须人工确认。",
  },
  {
    id: "ai-app-dev.eval-harness",
    routeId: "ai-app-dev",
    moduleId: "ai-app-dev",
    title: "最小评测集搭建",
    titleEn: "Minimal Eval Harness",
    description: "为应用搭建固定样例评测集，比较版本并拦截关键红线。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "为给定应用设计 5 个以上评测样例",
      "说明评测集如何拦截回归",
    ],
    signals: getReviewSignalsForNode("ai-app-dev.eval-harness"),
    sourceRefs: [
      { label: "OpenAI Evals Guide", url: "https://cookbook.openai.com/examples/evaluation" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "评测样例覆盖正常/边界/失败三类；能说明评测结果如何驱动版本决策。",
  },
  // ── AI 产品经理分支 ──────────────────────────────────
  {
    id: "ai-product.problem-def",
    routeId: "ai-product",
    moduleId: "ai-product",
    title: "问题定义与用户价值",
    titleEn: "Problem Definition",
    description: "从用户问题出发界定 AI 产品要解决的真实问题与成功标准。",
    targetLevel: 2,
    isKeyMilestone: false,
    outcomes: [
      "把一个用户诉求拆成可验证的问题陈述",
      "定义成功标准（而非功能清单）",
    ],
    signals: getReviewSignalsForNode("ai-product.problem-def"),
    sourceRefs: [
      { label: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "问题陈述包含用户、场景、痛点与成功标准；不把解决方案当需求。",
  },
  {
    id: "ai-product.capability-design",
    routeId: "ai-product",
    moduleId: "ai-product",
    title: "能力设计与边界",
    titleEn: "Capability Design",
    description: "把需求拆成可评测的能力，明确模型行为边界与人工兜底。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "把需求拆成可评测的能力清单",
      "为每项能力定义边界与兜底",
    ],
    signals: getReviewSignalsForNode("ai-product.capability-design"),
    sourceRefs: [
      { label: "NIST AI 600-1（生成式 AI 概况）", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "能力可评测（有输入输出与判定）；边界与人工兜底明确。",
  },
  {
    id: "ai-product.eval-decision",
    routeId: "ai-product",
    moduleId: "ai-product",
    title: "评估与产品决策",
    titleEn: "Evaluation-Driven Decisions",
    description: "用评测结果做上线/回滚/迭代决策，区分用户感知与系统指标。",
    targetLevel: 3,
    isKeyMilestone: true,
    outcomes: [
      "用评测结果给出上线/回滚/迭代决策",
      "区分用户感知指标与系统指标",
    ],
    signals: getReviewSignalsForNode("ai-product.eval-decision"),
    sourceRefs: [
      { label: "OpenAI Evals Guide", url: "https://cookbook.openai.com/examples/evaluation" },
    ],
    activityTemplates: ["build_model", "follow_demo", "independent_practice", "quiz", "reflection", "integrated_task"],
    assessmentRubric: "决策有评测数据支撑；能解释系统指标与用户感知的差异。",
  },
];

const edges: LearningEdge[] = [
  // 通识内部前置
  { sourceNodeId: "ai-literacy.mechanism", targetNodeId: "ai-literacy.fit", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.mechanism", targetNodeId: "ai-literacy.history", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.mechanism", targetNodeId: "ai-literacy.context", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.fit", targetNodeId: "ai-literacy.architecture", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.context", targetNodeId: "ai-literacy.architecture", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.context", targetNodeId: "ai-literacy.evaluation", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.architecture", targetNodeId: "ai-literacy.evaluation", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.fit", targetNodeId: "ai-literacy.responsibility", relationType: "prerequisite" },
  // 应用开发分支：通识主干 → 分支节点
  { sourceNodeId: "ai-literacy.context", targetNodeId: "ai-app-dev.prompting", relationType: "prerequisite" },
  { sourceNodeId: "ai-app-dev.prompting", targetNodeId: "ai-app-dev.rag", relationType: "prerequisite" },
  { sourceNodeId: "ai-app-dev.rag", targetNodeId: "ai-app-dev.tools", relationType: "supports" },
  { sourceNodeId: "ai-literacy.evaluation", targetNodeId: "ai-app-dev.eval-harness", relationType: "prerequisite" },
  { sourceNodeId: "ai-app-dev.rag", targetNodeId: "ai-app-dev.eval-harness", relationType: "supports" },
  // 产品经理分支：通识主干 → 分支节点
  { sourceNodeId: "ai-literacy.mechanism", targetNodeId: "ai-product.problem-def", relationType: "prerequisite" },
  { sourceNodeId: "ai-product.problem-def", targetNodeId: "ai-product.capability-design", relationType: "prerequisite" },
  { sourceNodeId: "ai-literacy.evaluation", targetNodeId: "ai-product.eval-decision", relationType: "prerequisite" },
  { sourceNodeId: "ai-product.capability-design", targetNodeId: "ai-product.eval-decision", relationType: "supports" },
  // 相邻分支关联（related）：应用开发 ↔ 产品经理共享能力
  { sourceNodeId: "ai-app-dev.eval-harness", targetNodeId: "ai-product.eval-decision", relationType: "related" },
  { sourceNodeId: "ai-app-dev.rag", targetNodeId: "ai-product.capability-design", relationType: "related" },
];

const branches: LearningBranch[] = [
  {
    id: "branch.ai-literacy",
    routeId: "ai-literacy",
    name: "AI 通识主干",
    description: "所有学习者的共同起点。",
    mainNodeId: "ai-literacy.mechanism",
  },
  {
    id: "branch.ai-app-dev",
    routeId: "ai-app-dev",
    name: "AI 应用开发",
    description: "主分支：从使用与判断进入实际实现。",
    mainNodeId: "ai-app-dev.prompting",
  },
  {
    id: "branch.ai-product",
    routeId: "ai-product",
    name: "AI 产品经理",
    description: "相邻分支：从问题定义进入能力设计与产品决策。",
    mainNodeId: "ai-product.problem-def",
  },
];

const resources: LearningResource[] = [
  {
    id: "res.gml-crash-course",
    title: "Machine Learning Crash Course",
    url: "https://developers.google.com/machine-learning/crash-course",
    sourceType: "official_docs",
    credibilityLevel: 5,
    summary: "Google 官方 ML 入门，解释训练、推理与泛化的基础机制。",
  },
  {
    id: "res.nist-ai-rmf",
    title: "NIST AI Risk Management Framework",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    sourceType: "standard",
    credibilityLevel: 5,
    summary: "AI 风险管理的权威框架：治理、映射、测量与管理。",
  },
  {
    id: "res.gemini-prompting",
    title: "Gemini API Prompting Strategies",
    url: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
    sourceType: "official_docs",
    credibilityLevel: 5,
    summary: "提示工程官方指南：任务说明、材料边界、输出格式与引用。",
  },
  {
    id: "res.openai-evals",
    title: "OpenAI Evals Guide",
    url: "https://platform.openai.com/docs/guides/evals",
    sourceType: "official_docs",
    credibilityLevel: 5,
    summary: "评测集设计：先定义失败，再设计测试，固定样例比较版本。",
  },
  {
    id: "res.nist-ai-600-1",
    title: "NIST AI 600-1",
    url: "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf",
    sourceType: "standard",
    credibilityLevel: 5,
    summary: "生成式 AI 风险管理：隐私、安全、偏见、版权与自动化边界。",
  },
  {
    id: "res.unsplash-docs",
    title: "Google AI for Developers: Tools",
    url: "https://ai.google.dev/gemini-api/docs/tools",
    sourceType: "official_docs",
    credibilityLevel: 5,
    summary: "工具调用官方文档：函数声明、执行与权限控制。",
  },
];

const resourceMappings: ResourceMapping[] = [
  {
    resourceId: "res.gml-crash-course",
    nodeId: "ai-literacy.mechanism",
    usage: "理解训练、推理与泛化机制",
    segmentFocus: "只看监督学习、训练/推理和泛化相关小节；先不追求公式推导。",
    qualityRationale: "Google 官方材料，概念定义稳定，适合给 AI PM 建立机制底座。",
    skipGuidance: "先跳过高级特征工程和数学细节，避免入门阶段被实现细节拖住。",
    learnerAction: "用 3 句话区分训练、推理、幻觉风险，并举一个产品判断例子。",
  },
  {
    resourceId: "res.nist-ai-rmf",
    nodeId: "ai-literacy.fit",
    usage: "界定 AI 与非 AI 方案的成功标准与失败代价",
    segmentFocus: "只看 Map / Measure 的定义，关注风险、收益和使用场景匹配。",
    qualityRationale: "NIST 标准材料，适合建立风险和适配判断，不适合作为操作教程。",
    skipGuidance: "治理章节先不精读，当前只拿它做“该不该用 AI”的判断框架。",
    learnerAction: "写出一个适合 AI、一个不适合 AI 的场景，并说明失败代价。",
  },
  {
    resourceId: "res.gemini-prompting",
    nodeId: "ai-literacy.context",
    usage: "组织任务、材料、输出格式与引用",
    segmentFocus: "只看任务说明、上下文材料、输出格式和引用要求相关小节。",
    qualityRationale: "官方 API 文档，能帮助用户理解模型依赖上下文而非真实理解任务。",
    skipGuidance: "先不看多轮工具链和复杂参数，避免把提示工程当成咒语集合。",
    learnerAction: "把一个模糊提问改写成含任务、背景、材料、输出格式的请求。",
  },
  {
    resourceId: "res.openai-evals",
    nodeId: "ai-literacy.evaluation",
    usage: "设计样例、指标与人工升级机制",
    segmentFocus: "只看 eval 的任务定义、样例集、评分器和失败分析，不先搭完整平台。",
    qualityRationale: "官方评测指南，直接连接 AI 产品是否可靠的判断，而不是泛泛体验。",
    skipGuidance: "先跳过自动化流水线和复杂实验管理，入门阶段只要会定义失败样例。",
    learnerAction: "为一个 AI 功能写 3 个失败样例、1 个通过标准和人工升级条件。",
  },
  {
    resourceId: "res.nist-ai-600-1",
    nodeId: "ai-literacy.responsibility",
    usage: "识别隐私、安全、偏见与权限风险",
    segmentFocus: "只看生成式 AI 风险类别和治理建议摘要，先抓常见风险语言。",
    qualityRationale: "NIST 生成式 AI 风险材料，适合补齐上线边界和责任意识。",
    skipGuidance: "先不进入法规细节，避免把责任学习变成合规背诵。",
    learnerAction: "给当前 AI 场景列出 3 个风险和一个人工兜底策略。",
  },
  {
    resourceId: "res.unsplash-docs",
    nodeId: "ai-app-dev.tools",
    usage: "工具调用实现与权限边界",
    segmentFocus: "只看 function calling / tools 的声明、调用和结果返回流程。",
    qualityRationale: "官方工具调用文档，适合理解 Agent 能做什么和不能自动做什么。",
    skipGuidance: "先不追求完整后端实现，重点看权限、确认和失败处理。",
    learnerAction: "画出一个工具调用的输入、执行、返回和人工确认链路。",
  },
  {
    resourceId: "res.openai-evals",
    nodeId: "ai-app-dev.eval-harness",
    usage: "搭建固定样例评测集",
    segmentFocus: "只看固定测试样例、评分方式和版本对比；先不用复杂 CI。",
    qualityRationale: "官方评测指南，可直接转成最小 eval harness 的设计。",
    skipGuidance: "先不自动化大规模测试，避免工具搭建压过学习目标。",
    learnerAction: "写出 5 条固定样例，并说明每条测什么失败类型。",
  },
  {
    resourceId: "res.openai-evals",
    nodeId: "ai-product.eval-decision",
    usage: "用评测结果做产品决策",
    segmentFocus: "只看如何定义任务、收集失败样例、比较版本和解释结果。",
    qualityRationale: "官方评测指南，能支撑 AI PM 把体验反馈转成上线/回滚/补人工的决策。",
    skipGuidance: "先不搭实验平台，重点是从失败样例推出产品动作。",
    learnerAction: "把 3 个失败样例分别转成继续上线、限制范围或人工兜底建议。",
  },
];

const tools: LearningTool[] = [
  {
    id: "tool.feishu-docs",
    name: "飞书文档",
    url: "https://www.feishu.cn",
    description: "记录学习笔记、画概念关系图、沉淀可复用的方案。",
  },
  {
    id: "tool.gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    description: "对话式学习工作台：解释、比较、起草与核验。",
  },
  {
    id: "tool.codex",
    name: "Codex",
    url: "https://openai.com/codex",
    description: "执行工作台：把学习转化为可运行代码或原型。",
  },
];

const toolMappings: ToolMapping[] = [
  {
    toolId: "tool.feishu-docs",
    nodeId: "ai-literacy.mechanism",
    usage: "绘制概念关系图并保存判断标准",
    activityContext: "建立模型活动：解释一个概念并画出关系",
  },
  {
    toolId: "tool.gemini",
    nodeId: "ai-literacy.context",
    usage: "练习组织任务说明与引用格式",
    activityContext: "独立练习：设计一段可复核的任务说明",
  },
  {
    toolId: "tool.codex",
    nodeId: "ai-app-dev.rag",
    usage: "实现最小 RAG 原型并验证引用",
    activityContext: "独立练习：完成一个小产出",
  },
  {
    toolId: "tool.gemini",
    nodeId: "ai-product.problem-def",
    usage: "澄清用户问题并对比方案",
    activityContext: "跟随示范：分析一个例子为什么有效",
  },
];

export const learningContentPack: LearningContentPack = {
  version: "0.1.0",
  routes,
  nodes,
  edges,
  branches,
  resources,
  resourceMappings,
  tools,
  toolMappings,
};

// ── 内容模型校验 ──────────────────────────────────────
// 1. 节点 ID 唯一
// 2. 三条路线存在
// 3. 前置关系合法（引用的节点存在、无环）
// 4. 当前路线能找到相邻分支
// 5. 每个节点有完整学习字段：outcomes / sourceRefs(可点击 URL) / activityTemplates / assessmentRubric
export function validateContentPack(pack: LearningContentPack = learningContentPack): void {
  // 节点 ID 唯一
  const nodeIds = new Set(pack.nodes.map((n) => n.id));
  if (nodeIds.size !== pack.nodes.length) {
    throw new Error("内容包校验失败：节点 ID 重复");
  }
  // 三条路线存在
  for (const routeId of ROUTE_IDS) {
    if (!pack.routes.some((r) => r.id === routeId)) {
      throw new Error(`内容包校验失败：缺少路线 ${routeId}`);
    }
  }
  // 节点属于存在的路线
  const routeIds = new Set(pack.routes.map((r) => r.id));
  for (const node of pack.nodes) {
    if (!routeIds.has(node.routeId)) {
      throw new Error(`内容包校验失败：节点 ${node.id} 属于不存在的路线 ${node.routeId}`);
    }
  }
  // 每个节点具备完整学习字段（内容样本工程要求）
  const allActivityTypes = new Set<string>(ACTIVITY_TYPES);
  for (const node of pack.nodes) {
    if (!node.moduleId) throw new Error(`内容包校验失败：节点 ${node.id} 缺少 moduleId`);
    if (!node.titleEn) throw new Error(`内容包校验失败：节点 ${node.id} 缺少 titleEn`);
    if (!Array.isArray(node.outcomes) || node.outcomes.length === 0) {
      throw new Error(`内容包校验失败：节点 ${node.id} 缺少 outcomes`);
    }
    if (!Array.isArray(node.signals) || node.signals.length === 0) {
      throw new Error(`内容包校验失败：节点 ${node.id} 缺少 signals`);
    }
    if (!Array.isArray(node.sourceRefs) || node.sourceRefs.length === 0) {
      throw new Error(`内容包校验失败：节点 ${node.id} 缺少 sourceRefs`);
    }
    for (const ref of node.sourceRefs) {
      if (!ref.label || !ref.url || !/^https?:\/\//.test(ref.url)) {
        throw new Error(`内容包校验失败：节点 ${node.id} 的 sourceRef 必须是可点击 http(s) 链接`);
      }
    }
    if (!Array.isArray(node.activityTemplates) || node.activityTemplates.length === 0) {
      throw new Error(`内容包校验失败：节点 ${node.id} 缺少 activityTemplates`);
    }
    for (const t of node.activityTemplates) {
      if (!allActivityTypes.has(t)) {
        throw new Error(`内容包校验失败：节点 ${node.id} 引用未知活动模板 ${t}`);
      }
    }
    if (!node.assessmentRubric || node.assessmentRubric.trim().length === 0) {
      throw new Error(`内容包校验失败：节点 ${node.id} 缺少 assessmentRubric`);
    }
  }
  // 前置关系合法：引用的节点存在
  for (const edge of pack.edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      throw new Error(`内容包校验失败：边 ${edge.sourceNodeId}→${edge.targetNodeId} 的源节点不存在`);
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      throw new Error(`内容包校验失败：边 ${edge.sourceNodeId}→${edge.targetNodeId} 的目标节点不存在`);
    }
  }
  // 前置关系无环（仅检查 prerequisite 边）
  const adjacency = new Map<string, string[]>();
  for (const node of pack.nodes) adjacency.set(node.id, []);
  for (const edge of pack.edges) {
    if (edge.relationType === "prerequisite") {
      adjacency.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`内容包校验失败：前置关系存在环，涉及节点 ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prereq of adjacency.get(id) ?? []) visit(prereq);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of pack.nodes) visit(node.id);
}

// ── 相邻分支查询 ──────────────────────────────────────
// 通过 related 边找到与当前路线相连的其他分支
export function findAdjacentBranches(
  routeId: RouteId,
  pack: LearningContentPack = learningContentPack,
): LearningBranch[] {
  if (routeId === "ai-literacy") {
    return pack.branches.filter((b) => b.routeId !== routeId);
  }
  // 当前路线的主干节点
  const mainBranch = pack.branches.find((b) => b.routeId === routeId);
  if (!mainBranch) return [];
  // 所有 related 边
  const relatedEdges = pack.edges.filter((e) => e.relationType === "related");
  // 与当前路线节点相连的 related 边的另一端点
  const routeNodeIds = new Set(pack.nodes.filter((n) => n.routeId === routeId).map((n) => n.id));
  const neighborNodeIds = new Set<string>();
  for (const edge of relatedEdges) {
    if (routeNodeIds.has(edge.sourceNodeId)) neighborNodeIds.add(edge.targetNodeId);
    if (routeNodeIds.has(edge.targetNodeId)) neighborNodeIds.add(edge.sourceNodeId);
  }
  // 相邻节点所在的分支：分支内任一节点与当前路线有 related 边即算相邻
  return pack.branches.filter((b) => {
    if (b.routeId === routeId) return false;
    const branchNodeIds = new Set(
      pack.nodes.filter((n) => n.routeId === b.routeId).map((n) => n.id),
    );
    for (const nodeId of neighborNodeIds) {
      if (branchNodeIds.has(nodeId)) return true;
    }
    return false;
  });
}

// ── 前置满足查询 ──────────────────────────────────────
export function getPrerequisiteNodeIds(nodeId: string, pack: LearningContentPack = learningContentPack): string[] {
  return pack.edges
    .filter((e) => e.relationType === "prerequisite" && e.targetNodeId === nodeId)
    .map((e) => e.sourceNodeId);
}

export function prerequisitesSatisfied(
  nodeId: string,
  nodeStatusById: Record<string, string>,
  pack: LearningContentPack = learningContentPack,
): boolean {
  return getPrerequisiteNodeIds(nodeId, pack).every(
    (prereqId) => nodeStatusById[prereqId] === "validated",
  );
}
