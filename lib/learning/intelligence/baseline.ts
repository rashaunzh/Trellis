import {
  courseGenomeSchema,
  domainGraphSchema,
  trustedSourceSchema,
  type CourseGenome,
  type DomainGraph,
  type TrustedSource,
  type UnitNodeMapping,
} from "./course-intelligence.ts";

const retrievedAt = "2026-08-30";

type SeedUnit = {
  id: string;
  title: string;
  minutes: number;
  nodes: string[];
  formats?: Array<"video" | "reading" | "quiz" | "lab" | "project" | "discussion">;
};

export interface BaselineCourse {
  genome: CourseGenome;
  tags: string[];
  unitNodes: Record<string, string[]>;
}

const source = (title: string, url: string, sourceClass: TrustedSource["sourceClass"] = "official_curriculum") => ({
  title,
  url,
  sourceClass,
  retrievedAt,
});

function course(input: {
  id: string;
  title: string;
  provider: string;
  url: string;
  level: CourseGenome["level"];
  audiences: string[];
  prerequisites?: string[];
  tags: string[];
  units: SeedUnit[];
  sourceClass?: TrustedSource["sourceClass"];
}): BaselineCourse {
  const citation = source(input.title, input.url, input.sourceClass);
  return {
    genome: courseGenomeSchema.parse({
      schemaVersion: 1,
      id: input.id,
      title: input.title,
      provider: input.provider,
      url: input.url,
      version: retrievedAt,
      level: input.level,
      audiences: input.audiences,
      prerequisites: input.prerequisites ?? [],
      learningOutcomes: Array.from(new Set(input.units.flatMap((unit) => unit.nodes))).map((node) => `理解并应用 ${node}`),
      units: input.units.map((unit, order) => ({
        id: unit.id,
        title: unit.title,
        order,
        estimatedMinutes: unit.minutes,
        prerequisites: order === 0 ? input.prerequisites ?? [] : [],
        learningOutcomes: unit.nodes.map((node) => `形成 ${node} 的可用判断`),
        formats: unit.formats ?? ["video", "quiz"],
      })),
      sourceCitations: [citation],
    }),
    tags: input.tags,
    unitNodes: Object.fromEntries(input.units.map((unit) => [unit.id, unit.nodes])),
  };
}

const C = {
  foundations: "ai-foundations",
  genai: "generative-ai",
  product: "ai-product",
  builder: "ai-builder",
  eval: "evaluation",
  agents: "agents",
  responsible: "responsible-ai",
  ml: "ml-engineering",
};

export const trustedSources: TrustedSource[] = [
  ["src.acm", "ACM/IEEE-CS Computing Curricula", "https://csed.acm.org/", "academic_standard", ["define_domain"]],
  ["src.dlai", "DeepLearning.AI Courses", "https://www.deeplearning.ai/courses/", "official_curriculum", ["teach_systematically", "practice_reference"]],
  ["src.microsoft", "Microsoft Learn AI", "https://learn.microsoft.com/en-us/training/browse/?terms=AI", "official_curriculum", ["teach_systematically", "practice_reference", "tool_update"]],
  ["src.anthropic", "Anthropic Learn", "https://www.anthropic.com/learn", "official_curriculum", ["teach_systematically", "practice_reference", "tool_update"]],
  ["src.langchain", "LangChain Academy", "https://academy.langchain.com/", "official_curriculum", ["practice_reference", "tool_update"]],
  ["src.stanford", "Stanford AI Courses", "https://ai.stanford.edu/courses/", "academic_course", ["define_domain", "teach_systematically"]],
  ["src.mit", "MIT OpenCourseWare AI", "https://ocw.mit.edu/search/?q=artificial+intelligence", "academic_course", ["define_domain", "teach_systematically"]],
  ["src.duke", "Duke AI Product Management", "https://www.coursera.org/specializations/ai-product-management-duke", "academic_course", ["teach_systematically", "practice_reference"]],
  ["src.nist", "NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework", "professional_reference", ["define_domain", "practice_reference", "current_signal"]],
  ["src.books", "Professional AI Product References", "https://www.oreilly.com/library/view/the-ai-product/9781098160114/", "professional_reference", ["define_domain", "practice_reference"]],
].map(([id, title, url, sourceClass, purposes]) => trustedSourceSchema.parse({
  id, title, url, sourceClass, purposes, provider: String(title).split(" ")[0], status: "published", notes: "公开目录与元数据基线",
}));

const categories = [
  ["foundation", "AI 基础与边界", "理解 AI、机器学习和生成式 AI 的共同基础。"],
  ["use", "AI 使用与协作", "有效使用、判断和负责任地与 AI 协作。"],
  ["product", "AI 产品判断", "从问题、能力、评测到上线运营的产品决策。"],
  ["system", "AI 应用系统", "理解 RAG、Agent、工具调用和生产系统。"],
  ["model", "模型与训练", "面向确有需要的模型构建和训练分支。"],
] as const;

const nodeSeed: Array<[string, string, string, number, string[]]> = [
  ["ai.scope", "AI 的范围与主要范式", "foundation", 1, []],
  ["ai.data-model-inference", "数据、模型与推断", "foundation", 1, ["ai.scope"]],
  ["ai.ml-paradigms", "监督、无监督与强化学习", "foundation", 1, ["ai.data-model-inference"]],
  ["ai.neural-networks", "神经网络与深度学习", "foundation", 1, ["ai.data-model-inference"]],
  ["ai.genai-llm", "生成式 AI 与大语言模型", "foundation", 1, ["ai.data-model-inference"]],
  ["ai.capability-boundary", "能力、限制与不确定性", "foundation", 2, ["ai.genai-llm"]],
  ["ai.evaluation-basics", "评测、实验与基线", "foundation", 2, ["ai.capability-boundary"]],
  ["ai.responsible-use", "负责任 AI 与治理基础", "foundation", 1, ["ai.scope"]],
  ["ai.system-lifecycle", "AI 系统生命周期", "foundation", 1, ["ai.scope"]],
  ["use.delegation", "任务委派与边界设定", "use", 2, ["ai.capability-boundary"]],
  ["use.description", "上下文与清晰描述", "use", 2, ["ai.genai-llm"]],
  ["use.discernment", "结果辨别与核验", "use", 2, ["ai.capability-boundary"]],
  ["use.diligence", "安全、透明与审慎使用", "use", 2, ["ai.responsible-use"]],
  ["use.prompting", "提示与迭代协作", "use", 2, ["use.description"]],
  ["pm.problem-framing", "问题定义与用户价值", "product", 2, ["ai.capability-boundary"]],
  ["pm.use-case-fit", "AI 场景适配判断", "product", 2, ["pm.problem-framing"]],
  ["pm.capability-design", "能力设计与产品边界", "product", 2, ["pm.use-case-fit"]],
  ["pm.data-readiness", "数据可用性与准备度", "product", 2, ["ai.data-model-inference"]],
  ["pm.interaction-fallback", "交互、人工确认与兜底", "product", 2, ["pm.capability-design"]],
  ["pm.failure-taxonomy", "失败类型与风险场景", "product", 2, ["ai.evaluation-basics"]],
  ["pm.eval-design", "产品评测设计", "product", 3, ["pm.failure-taxonomy"]],
  ["pm.metrics-experiment", "指标、实验与决策", "product", 2, ["pm.eval-design"]],
  ["pm.cost-latency", "成本、延迟与体验权衡", "product", 2, ["pm.capability-design"]],
  ["pm.launch-operations", "上线、监控与运营", "product", 2, ["pm.metrics-experiment", "pm.interaction-fallback"]],
  ["pm.strategy", "AI 产品策略与路线", "product", 2, ["pm.launch-operations"]],
  ["app.prompting", "程序化提示与结构化输出", "system", 2, ["ai.genai-llm"]],
  ["app.rag", "检索增强生成", "system", 2, ["app.prompting"]],
  ["app.tools", "工具调用与动作", "system", 2, ["app.prompting"]],
  ["app.agents", "Agent 工作流与自治程度", "system", 2, ["app.tools"]],
  ["app.context-memory", "上下文与记忆", "system", 2, ["app.rag"]],
  ["app.eval-observability", "应用评测与可观测性", "system", 3, ["ai.evaluation-basics", "app.prompting"]],
  ["app.security", "AI 应用安全", "system", 2, ["app.tools", "ai.responsible-use"]],
  ["app.deployment", "部署与生产运维", "system", 2, ["app.eval-observability", "app.security"]],
  ["ml.supervised", "监督学习建模", "model", 3, ["ai.ml-paradigms"]],
  ["ml.deep-learning", "深度学习建模", "model", 3, ["ai.neural-networks", "ml.supervised"]],
  ["ml.training-optimization", "训练与优化", "model", 3, ["ml.deep-learning"]],
];

const graphCitation = source("ACM/IEEE-CS Computing Curricula", "https://csed.acm.org/", "academic_standard");

export const publishedDomainGraph: DomainGraph = domainGraphSchema.parse({
  id: "graph.ai.v1",
  version: "1.0.0",
  title: "AI 学习领域图",
  status: "published",
  categories: categories.map(([id, title, description]) => ({ id, title, description })),
  nodes: nodeSeed.map(([id, title, categoryId, targetDepth, prerequisiteNodeIds]) => ({
    id,
    categoryId,
    title,
    description: `围绕“${title}”形成可解释、可迁移的判断。`,
    outcomes: [`能解释 ${title} 的关键概念`, `能在真实场景中判断何时需要 ${title}`],
    targetDepth,
    confidence: 0.92,
    prerequisiteNodeIds,
    sourceCitations: [graphCitation],
  })),
  publishedAt: retrievedAt,
});

export const baselineCourses: BaselineCourse[] = [
  course({ id: "dlai.ai-for-everyone", title: "AI for Everyone", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/ai-for-everyone/", level: "introductory", audiences: ["产品与业务人员"], tags: [C.foundations, C.product], units: [
    { id: "ai4e.what-ai-can-do", title: "What AI Can and Cannot Do", minutes: 45, nodes: ["ai.scope", "ai.capability-boundary"] },
    { id: "ai4e.ai-projects", title: "Building AI Projects", minutes: 60, nodes: ["pm.problem-framing", "pm.use-case-fit", "ai.system-lifecycle"] },
    { id: "ai4e.company", title: "Building AI in Your Company", minutes: 45, nodes: ["pm.strategy", "pm.launch-operations"] },
  ] }),
  course({ id: "dlai.genai-for-everyone", title: "Generative AI for Everyone", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/generative-ai-for-everyone/", level: "beginner", audiences: ["非技术学习者", "产品人员"], tags: [C.genai, C.product], units: [
    { id: "gaie.genai", title: "Generative AI Fundamentals", minutes: 55, nodes: ["ai.genai-llm", "ai.capability-boundary"] },
    { id: "gaie.projects", title: "Generative AI Projects", minutes: 55, nodes: ["pm.use-case-fit", "pm.capability-design"] },
    { id: "gaie.impact", title: "Business and Society", minutes: 45, nodes: ["ai.responsible-use", "pm.strategy"] },
  ] }),
  course({ id: "dlai.ml-specialization", title: "Machine Learning Specialization", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/machine-learning-specialization/", level: "beginner", audiences: ["开发者", "机器学习学习者"], prerequisites: ["Python", "基础数学"], tags: [C.ml], units: [
    { id: "mls.supervised", title: "Supervised Machine Learning", minutes: 1980, nodes: ["ai.ml-paradigms", "ml.supervised"], formats: ["video", "lab", "quiz"] },
    { id: "mls.advanced", title: "Advanced Learning Algorithms", minutes: 2040, nodes: ["ai.neural-networks", "ml.deep-learning"], formats: ["video", "lab"] },
    { id: "mls.unsupervised", title: "Unsupervised Learning and Recommenders", minutes: 1620, nodes: ["ai.ml-paradigms", "ml.training-optimization"], formats: ["video", "lab"] },
  ] }),
  course({ id: "dlai.deep-learning-specialization", title: "Deep Learning Specialization", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/deep-learning-specialization/", level: "intermediate", audiences: ["机器学习工程师"], prerequisites: ["Python", "线性代数", "机器学习"], tags: [C.ml], units: [
    { id: "dls.nn", title: "Neural Networks and Deep Learning", minutes: 1200, nodes: ["ai.neural-networks", "ml.deep-learning"], formats: ["video", "lab"] },
    { id: "dls.optimize", title: "Improving Deep Neural Networks", minutes: 1200, nodes: ["ml.training-optimization"] },
    { id: "dls.sequence", title: "Sequence Models", minutes: 1200, nodes: ["ml.deep-learning", "ai.genai-llm"] },
  ] }),
  course({ id: "dlai.ai-python", title: "AI Python for Beginners", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/ai-python-for-beginners/", level: "beginner", audiences: ["Python 初学者"], tags: [C.builder], units: [
    { id: "aipy.basics", title: "Python and AI-assisted coding", minutes: 90, nodes: ["app.prompting"] },
    { id: "aipy.data", title: "Working with data", minutes: 90, nodes: ["ai.data-model-inference"] },
  ] }),
  course({ id: "dlai.prompt-engineering", title: "ChatGPT Prompt Engineering for Developers", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/", level: "beginner", audiences: ["开发者", "技术产品人员"], tags: [C.builder, C.genai], units: [
    { id: "pe.guidelines", title: "Prompting Guidelines", minutes: 40, nodes: ["use.prompting", "app.prompting"] },
    { id: "pe.iterative", title: "Iterative Prompt Development", minutes: 35, nodes: ["use.discernment", "app.prompting"] },
    { id: "pe.applications", title: "Transforming, Expanding and Chatbot", minutes: 70, nodes: ["pm.capability-design", "app.prompting"] },
  ] }),
  course({ id: "dlai.building-systems", title: "Building Systems with the ChatGPT API", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/building-systems-with-chatgpt/", level: "intermediate", audiences: ["Python 开发者"], prerequisites: ["Python", "API 基础"], tags: [C.builder], units: [
    { id: "systems.chain", title: "Chaining and Classification", minutes: 55, nodes: ["app.prompting", "pm.capability-design"] },
    { id: "systems.safety", title: "Moderation and Safety", minutes: 40, nodes: ["app.security", "pm.interaction-fallback"] },
    { id: "systems.eval", title: "Evaluation", minutes: 45, nodes: ["app.eval-observability", "pm.eval-design"] },
  ] }),
  course({ id: "dlai.langchain-dev", title: "LangChain for LLM Application Development", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/langchain-for-llm-application-development/", level: "intermediate", audiences: ["Python 开发者"], prerequisites: ["Python"], tags: [C.builder, C.agents], units: [
    { id: "lcd.chains", title: "Chains", minutes: 45, nodes: ["app.tools"] },
    { id: "lcd.memory", title: "Memory", minutes: 45, nodes: ["app.context-memory"] },
    { id: "lcd.qa", title: "Question Answering over Documents", minutes: 55, nodes: ["app.rag"] },
    { id: "lcd.agents", title: "Agents", minutes: 45, nodes: ["app.agents"] },
  ] }),
  course({ id: "dlai.functions-tools-agents", title: "Functions, Tools and Agents with LangChain", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/functions-tools-agents-langchain/", level: "intermediate", audiences: ["AI 应用开发者"], prerequisites: ["Python", "LLM API"], tags: [C.builder, C.agents], units: [
    { id: "fta.functions", title: "OpenAI Function Calling", minutes: 45, nodes: ["app.tools", "app.prompting"] },
    { id: "fta.agents", title: "Agent and Tool Selection", minutes: 55, nodes: ["app.agents", "pm.capability-design"] },
  ] }),
  course({ id: "dlai.eval-debug", title: "Evaluating and Debugging Generative AI", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/evaluating-debugging-generative-ai/", level: "intermediate", audiences: ["Python 与实验平台使用者"], prerequisites: ["Python", "PyTorch"], tags: [C.eval, C.builder], units: [
    { id: "ed.instrument", title: "Instrument W&B", minutes: 45, nodes: ["app.eval-observability"] },
    { id: "ed.diffusion", title: "Evaluate Diffusion Models", minutes: 55, nodes: ["ai.evaluation-basics", "ml.deep-learning"] },
    { id: "ed.llm", title: "Evaluate LLMs", minutes: 55, nodes: ["app.eval-observability", "pm.failure-taxonomy"] },
  ] }),
  course({ id: "dlai.advanced-rag", title: "Building and Evaluating Advanced RAG Applications", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/building-evaluating-advanced-rag/", level: "intermediate", audiences: ["AI 应用开发者"], prerequisites: ["Python", "RAG 基础"], tags: [C.builder, C.eval], units: [
    { id: "arag.sentence-window", title: "Advanced Retrieval", minutes: 55, nodes: ["app.rag"] },
    { id: "arag.eval", title: "RAG Evaluation", minutes: 60, nodes: ["app.eval-observability", "pm.eval-design"] },
  ] }),
  course({ id: "dlai.agentic-ai", title: "Agentic AI", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/agentic-ai/", level: "intermediate", audiences: ["Python 开发者", "AI 应用工程师"], prerequisites: ["Python", "LLM 基础"], tags: [C.agents, C.builder], units: [
    { id: "agentic.intro", title: "Agentic Workflows and Autonomy", minutes: 50, nodes: ["app.agents", "pm.capability-design"] },
    { id: "agentic.reflection", title: "Reflection and Tool Use", minutes: 90, nodes: ["app.tools", "app.eval-observability"] },
    { id: "agentic.build", title: "Build Multi-step Agents", minutes: 180, nodes: ["app.agents", "app.context-memory"], formats: ["video", "lab", "project"] },
  ] }),
  course({ id: "dlai.mcp", title: "MCP: Build Rich-Context AI Apps", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/", level: "intermediate", audiences: ["AI 应用开发者"], prerequisites: ["Python 或 TypeScript"], tags: [C.builder, C.agents], units: [
    { id: "mcp.protocol", title: "MCP Architecture", minutes: 45, nodes: ["app.tools", "app.context-memory"] },
    { id: "mcp.server", title: "Build an MCP Server", minutes: 75, nodes: ["app.tools", "app.security"] },
  ] }),
  course({ id: "ms.ai-concepts", title: "AI Concepts for Developers and Technology Professionals", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/ai-concepts/", level: "beginner", audiences: ["技术人员", "产品人员"], tags: [C.foundations, C.genai], units: [
    { id: "msai.intro", title: "Introduction to AI Concepts", minutes: 40, nodes: ["ai.scope", "ai.ml-paradigms", "ai.responsible-use"] },
    { id: "msai.genai", title: "Introduction to Generative AI and Agents", minutes: 37, nodes: ["ai.genai-llm", "app.agents"] },
    { id: "msai.rag", title: "Introduction to RAG Concepts", minutes: 34, nodes: ["app.rag"] },
  ] }),
  course({ id: "ms.business-value", title: "Explore the Business Value of Generative AI Solutions", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/explore-business-value-generative-ai-solutions/", level: "beginner", audiences: ["业务负责人", "产品人员"], tags: [C.product, C.genai], units: [
    { id: "msbv.value", title: "Create Business Value with Generative AI", minutes: 32, nodes: ["pm.problem-framing", "pm.use-case-fit", "pm.strategy"] },
    { id: "msbv.readiness", title: "Build Reliable and Responsible Solutions", minutes: 30, nodes: ["pm.data-readiness", "ai.responsible-use", "pm.cost-latency"] },
  ] }),
  course({ id: "ms.genai-apps", title: "Develop Generative AI Apps in Azure", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/develop-generative-ai-apps/", level: "intermediate", audiences: ["AI 工程师"], prerequisites: ["编程", "Azure AI 基础"], tags: [C.builder], units: [
    { id: "msga.models", title: "Select and Deploy Models", minutes: 65, nodes: ["ai.capability-boundary", "pm.cost-latency"] },
    { id: "msga.optimize", title: "Optimize Model Performance", minutes: 135, nodes: ["app.prompting", "app.rag"] },
    { id: "msga.responsible", title: "Responsible Generative AI", minutes: 45, nodes: ["app.security", "ai.responsible-use"] },
  ] }),
  course({ id: "ms.ai-agents", title: "Develop AI Agents on Azure", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/develop-ai-agents-on-azure/", level: "intermediate", audiences: ["AI 工程师"], prerequisites: ["编程", "Azure Foundry"], tags: [C.agents, C.builder], units: [
    { id: "msagent.foundations", title: "Agent Fundamentals", minutes: 60, nodes: ["app.agents", "pm.capability-design"] },
    { id: "msagent.tools", title: "Connect Tools and Knowledge", minutes: 120, nodes: ["app.tools", "app.rag"] },
    { id: "msagent.orchestrate", title: "Orchestrate Multiple Agents", minutes: 120, nodes: ["app.agents", "app.context-memory"] },
  ] }),
  course({ id: "ms.genaiops", title: "Operationalize Generative AI Applications", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/operationalize-gen-ai-apps/", level: "intermediate", audiences: ["AI 工程师", "产品技术负责人"], prerequisites: ["生成式 AI 应用基础"], tags: [C.eval, C.builder, C.product], units: [
    { id: "ops.plan", title: "Plan a GenAIOps Solution", minutes: 46, nodes: ["ai.system-lifecycle", "pm.launch-operations"] },
    { id: "ops.evaluate", title: "Evaluate and Optimize Agents", minutes: 60, nodes: ["app.eval-observability", "pm.eval-design"] },
    { id: "ops.monitor", title: "Monitor Performance and Cost", minutes: 60, nodes: ["pm.metrics-experiment", "pm.cost-latency"] },
  ] }),
  course({ id: "anthropic.ai-fluency", title: "AI Fluency: Framework and Foundations", provider: "Anthropic", url: "https://www.anthropic.com/learn/claude-for-you", level: "introductory", audiences: ["所有 AI 使用者"], tags: [C.foundations, C.responsible], units: [
    { id: "fluency.genai", title: "What Is Generative AI?", minutes: 30, nodes: ["ai.genai-llm", "ai.capability-boundary"] },
    { id: "fluency.delegation", title: "Delegation", minutes: 35, nodes: ["use.delegation"] },
    { id: "fluency.description", title: "Description", minutes: 35, nodes: ["use.description", "use.prompting"] },
    { id: "fluency.discernment", title: "Discernment", minutes: 35, nodes: ["use.discernment"] },
    { id: "fluency.diligence", title: "Diligence", minutes: 35, nodes: ["use.diligence", "ai.responsible-use"] },
  ] }),
  course({ id: "anthropic.prompting", title: "Prompt Engineering Tutorial", provider: "Anthropic", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview", level: "beginner", audiences: ["Claude 使用者", "开发者"], tags: [C.genai, C.builder], units: [
    { id: "ap.clear", title: "Be Clear and Direct", minutes: 30, nodes: ["use.description", "use.prompting"] },
    { id: "ap.examples", title: "Use Examples and Structure", minutes: 40, nodes: ["app.prompting"] },
    { id: "ap.chain", title: "Chain Complex Prompts", minutes: 40, nodes: ["app.prompting", "app.tools"] },
  ], sourceClass: "official_documentation" }),
  course({ id: "langchain.intro", title: "Introduction to LangChain", provider: "LangChain Academy", url: "https://academy.langchain.com/", level: "beginner", audiences: ["AI 应用开发者"], prerequisites: ["Python 或 TypeScript"], tags: [C.builder], units: [
    { id: "lc.models", title: "Models, Messages and Structured Output", minutes: 60, nodes: ["app.prompting"] },
    { id: "lc.tools", title: "Tools and Retrieval", minutes: 75, nodes: ["app.tools", "app.rag"] },
  ] }),
  course({ id: "langchain.langgraph", title: "LangGraph Essentials", provider: "LangChain Academy", url: "https://academy.langchain.com/", level: "intermediate", audiences: ["Agent 开发者"], prerequisites: ["LangChain 基础"], tags: [C.agents, C.builder], units: [
    { id: "lg.state", title: "State and Graph Workflows", minutes: 75, nodes: ["app.agents", "app.context-memory"] },
    { id: "lg.hitl", title: "Human-in-the-loop", minutes: 60, nodes: ["pm.interaction-fallback", "app.agents"] },
  ] }),
  course({ id: "langchain.langsmith", title: "LangSmith Essentials", provider: "LangChain Academy", url: "https://academy.langchain.com/", level: "beginner", audiences: ["Agent 产品与开发团队"], tags: [C.eval, C.builder], units: [
    { id: "ls.trace", title: "Tracing and Observability", minutes: 45, nodes: ["app.eval-observability"] },
    { id: "ls.eval", title: "Datasets and Evaluations", minutes: 60, nodes: ["pm.eval-design", "app.eval-observability"] },
  ] }),
  course({ id: "langchain.deep-agents", title: "Introduction to Deep Agents", provider: "LangChain Academy", url: "https://academy.langchain.com/", level: "intermediate", audiences: ["Agent 开发者"], prerequisites: ["LangGraph"], tags: [C.agents, C.builder], units: [
    { id: "da.harness", title: "Agent Harnesses", minutes: 60, nodes: ["app.agents", "app.context-memory"] },
    { id: "da.long-running", title: "Long-running Workflows", minutes: 75, nodes: ["app.agents", "app.deployment"] },
  ] }),
  course({ id: "stanford.cs221", title: "CS221: Artificial Intelligence: Principles and Techniques", provider: "Stanford University", url: "https://stanford-cs221.github.io/", level: "intermediate", audiences: ["计算机专业学习者"], prerequisites: ["编程", "概率", "离散数学"], tags: [C.foundations, C.ml], units: [
    { id: "cs221.search", title: "Search and Decision Making", minutes: 600, nodes: ["ai.scope", "ai.ml-paradigms"] },
    { id: "cs221.ml", title: "Machine Learning", minutes: 600, nodes: ["ai.data-model-inference", "ml.supervised"] },
    { id: "cs221.uncertainty", title: "Uncertainty", minutes: 600, nodes: ["ai.capability-boundary"] },
  ], sourceClass: "academic_course" }),
  course({ id: "stanford.cs229", title: "CS229: Machine Learning", provider: "Stanford University", url: "https://cs229.stanford.edu/", level: "advanced", audiences: ["机器学习工程师", "研究学习者"], prerequisites: ["线性代数", "概率", "编程"], tags: [C.ml], units: [
    { id: "cs229.supervised", title: "Supervised Learning", minutes: 1200, nodes: ["ml.supervised"] },
    { id: "cs229.deep", title: "Deep Learning", minutes: 600, nodes: ["ml.deep-learning"] },
    { id: "cs229.rl", title: "Reinforcement Learning", minutes: 600, nodes: ["ai.ml-paradigms", "ml.training-optimization"] },
  ], sourceClass: "academic_course" }),
  course({ id: "mit.6034", title: "6.034 Artificial Intelligence", provider: "MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/6-034-artificial-intelligence-fall-2010/", level: "intermediate", audiences: ["计算机专业学习者"], prerequisites: ["编程", "离散数学"], tags: [C.foundations, C.ml], units: [
    { id: "6034.search", title: "Search", minutes: 600, nodes: ["ai.scope"] },
    { id: "6034.learning", title: "Learning", minutes: 900, nodes: ["ai.ml-paradigms", "ai.neural-networks"] },
    { id: "6034.probability", title: "Probabilistic Inference", minutes: 600, nodes: ["ai.data-model-inference"] },
  ], sourceClass: "academic_course" }),
  course({ id: "duke.ai-product", title: "AI Product Management Specialization", provider: "Duke University", url: "https://www.coursera.org/specializations/ai-product-management-duke", level: "beginner", audiences: ["产品经理", "业务负责人"], tags: [C.product, C.foundations], units: [
    { id: "duke.ml-foundations", title: "Machine Learning Foundations for Product Managers", minutes: 720, nodes: ["ai.ml-paradigms", "ai.capability-boundary", "pm.use-case-fit"] },
    { id: "duke.managing", title: "Managing Machine Learning Projects", minutes: 720, nodes: ["pm.problem-framing", "pm.data-readiness", "pm.metrics-experiment"] },
    { id: "duke.human-factors", title: "Human Factors in AI", minutes: 600, nodes: ["pm.interaction-fallback", "ai.responsible-use", "pm.failure-taxonomy"] },
  ], sourceClass: "academic_course" }),
  course({ id: "book.ai-product-manager", title: "The AI Product Manager's Handbook", provider: "Professional Reference", url: "https://www.oreilly.com/library/view/the-ai-product/9781098160114/", level: "beginner", audiences: ["AI 产品经理"], tags: [C.product], units: [
    { id: "book.opportunity", title: "AI Product Opportunities", minutes: 120, nodes: ["pm.problem-framing", "pm.use-case-fit"] },
    { id: "book.lifecycle", title: "AI Product Lifecycle", minutes: 180, nodes: ["ai.system-lifecycle", "pm.launch-operations"] },
    { id: "book.metrics", title: "Evaluation and Metrics", minutes: 150, nodes: ["pm.eval-design", "pm.metrics-experiment"] },
  ], sourceClass: "professional_reference" }),
  course({ id: "nist.ai-rmf", title: "NIST AI Risk Management Framework", provider: "NIST", url: "https://www.nist.gov/itl/ai-risk-management-framework", level: "intermediate", audiences: ["产品负责人", "风险与治理人员"], tags: [C.responsible, C.product], units: [
    { id: "rmf.govern", title: "Govern", minutes: 90, nodes: ["ai.responsible-use", "pm.strategy"] },
    { id: "rmf.map", title: "Map", minutes: 90, nodes: ["pm.failure-taxonomy", "pm.data-readiness"] },
    { id: "rmf.measure", title: "Measure", minutes: 90, nodes: ["pm.eval-design", "pm.metrics-experiment"] },
    { id: "rmf.manage", title: "Manage", minutes: 90, nodes: ["pm.interaction-fallback", "pm.launch-operations"] },
  ], sourceClass: "professional_reference" }),
];

export function baselineMappingsFor(courseIds?: Set<string>): UnitNodeMapping[] {
  return baselineCourses
    .filter((item) => !courseIds || courseIds.has(item.genome.id))
    .flatMap((item) => item.genome.units.flatMap((unit) =>
      (item.unitNodes[unit.id] ?? []).map((nodeId, index) => ({
        courseId: item.genome.id,
        unitId: unit.id,
        nodeId,
        depth: publishedDomainGraph.nodes.find((node) => node.id === nodeId)?.targetDepth ?? 1,
        relation: index === 0 ? "core" as const : "supporting" as const,
        confidence: 0.88,
        sourceCitations: item.genome.sourceCitations,
      })),
    ));
}
