import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCurriculumAssembly,
  type CourseGenome,
  type CurriculumAssembly,
} from "../../lib/learning/intelligence/course-intelligence.ts";

const retrievedAt = "2026-08-30";
const source = (title: string, url: string) => ({
  title,
  url,
  sourceClass: "official_curriculum" as const,
  retrievedAt,
});

const courses: CourseGenome[] = [
  {
    schemaVersion: 1,
    id: "dlai.ai-for-everyone",
    title: "AI for Everyone",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/courses/ai-for-everyone/",
    version: "2026-08-30",
    level: "introductory",
    audiences: ["非技术专业人士", "产品与业务负责人"],
    prerequisites: [],
    learningOutcomes: ["理解 AI 能力与项目机会", "理解 AI 项目和团队基本流程"],
    units: [
      { id: "ai4e.landscape", title: "AI 能力与限制", order: 1, prerequisites: [], learningOutcomes: ["区分 AI 能力与限制"], formats: ["video", "quiz"] },
      { id: "ai4e.projects", title: "AI 项目与机会", order: 2, prerequisites: [], learningOutcomes: ["判断 AI 项目机会"], formats: ["video", "quiz"] },
    ],
    sourceCitations: [source("AI for Everyone", "https://www.deeplearning.ai/courses/ai-for-everyone/")],
  },
  {
    schemaVersion: 1,
    id: "dlai.genai-for-everyone",
    title: "Generative AI for Everyone",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/courses/generative-ai-for-everyone",
    version: "2026-08-30",
    level: "beginner",
    audiences: ["非技术专业人士"],
    prerequisites: [],
    learningOutcomes: ["理解生成式 AI 的能力、限制与应用"],
    units: [
      { id: "genai.capabilities", title: "生成式 AI 的能力与限制", order: 1, prerequisites: [], learningOutcomes: ["判断生成式 AI 的适用边界"], formats: ["video", "quiz"] },
      { id: "genai.business", title: "生成式 AI 项目与业务", order: 2, prerequisites: [], learningOutcomes: ["识别生成式 AI 应用机会"], formats: ["video"] },
    ],
    sourceCitations: [source("Generative AI for Everyone", "https://www.deeplearning.ai/courses/generative-ai-for-everyone")],
  },
  {
    schemaVersion: 1,
    id: "dlai.ml-specialization",
    title: "Machine Learning Specialization",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/specializations/machine-learning",
    version: "2026-08-30",
    level: "beginner",
    audiences: ["机器学习学习者", "软件工程师"],
    prerequisites: ["基础 Python", "高中数学"],
    learningOutcomes: ["构建和评估机器学习模型"],
    units: [
      { id: "mls.supervised", title: "监督学习", order: 1, prerequisites: ["基础 Python"], learningOutcomes: ["训练监督学习模型"], formats: ["video", "lab", "quiz"] },
    ],
    sourceCitations: [source("Machine Learning Specialization", "https://www.deeplearning.ai/specializations/machine-learning")],
  },
  {
    schemaVersion: 1,
    id: "dlai.agentic-ai",
    title: "Agentic AI",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/courses/agentic-ai",
    version: "2026-08-30",
    level: "intermediate",
    audiences: ["Python 开发者", "AI 应用工程师"],
    prerequisites: ["Python", "LLM 基础"],
    learningOutcomes: ["构建并评估 agentic workflow"],
    units: [
      { id: "agentic.intro", title: "Agentic workflow 与自治程度", order: 1, prerequisites: ["LLM 基础"], learningOutcomes: ["判断 Agent 场景和自治程度"], formats: ["video", "quiz"] },
      { id: "agentic.build", title: "用 Python 构建 Agent", order: 2, prerequisites: ["Python"], learningOutcomes: ["实现 Agent 工作流"], formats: ["video", "lab", "project"] },
    ],
    sourceCitations: [source("Agentic AI", "https://www.deeplearning.ai/courses/agentic-ai")],
  },
  {
    schemaVersion: 1,
    id: "dlai.eval-debug",
    title: "Evaluating and Debugging Generative AI",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/courses/evaluating-debugging-generative-ai",
    version: "2026-08-30",
    level: "intermediate",
    audiences: ["Python 与 PyTorch 使用者"],
    prerequisites: ["Python", "PyTorch"],
    learningOutcomes: ["使用 W&B 跟踪和调试生成式 AI 实验"],
    units: [
      { id: "eval.wandb", title: "W&B 实验跟踪", order: 1, prerequisites: ["Python", "PyTorch"], learningOutcomes: ["记录实验指标"], formats: ["video", "lab"] },
    ],
    sourceCitations: [source("Evaluating and Debugging Generative AI", "https://www.deeplearning.ai/courses/evaluating-debugging-generative-ai")],
  },
];

const assembly: CurriculumAssembly = {
  schemaVersion: 1,
  id: "benchmark.dlai.ai-pm",
  learnerIntent: "以产品判断为目标理解生成式 AI 与 Agent，不以成为 ML 工程师为前置",
  targetNodeIds: ["ai.capability-boundary", "ai.project-opportunity", "genai.capability-boundary", "agent.autonomy"],
  decisions: [
    { courseId: "dlai.ai-for-everyone", role: "anchor", selectedUnitIds: ["ai4e.landscape", "ai4e.projects"], rationale: "承担非技术 AI 全景和项目机会判断。", confidence: 0.92, exitCriteria: ["能区分 AI 能力限制并判断一个项目机会"], sourceCitations: courses[0]!.sourceCitations },
    { courseId: "dlai.genai-for-everyone", role: "selected_units", selectedUnitIds: ["genai.capabilities"], rationale: "只补生成式 AI 能力边界，避免重复业务导论。", confidence: 0.89, exitCriteria: ["能说明生成式 AI 的适用与不适用场景"], sourceCitations: courses[1]!.sourceCitations },
    { courseId: "dlai.ml-specialization", role: "defer", selectedUnitIds: [], rationale: "课程系统但偏模型构建，当前 AI PM 目标不要求先完成约百小时 ML 训练。", confidence: 0.9, exitCriteria: [], sourceCitations: courses[2]!.sourceCitations },
    { courseId: "dlai.agentic-ai", role: "selected_units", selectedUnitIds: ["agentic.intro"], rationale: "采用 Agent 概念和自治程度判断，暂缓 Python 构建部分。", confidence: 0.88, exitCriteria: ["能判断一个工作流需要怎样的 Agent 自治程度"], sourceCitations: courses[3]!.sourceCitations },
    { courseId: "dlai.eval-debug", role: "exclude", selectedUnitIds: [], rationale: "课程重点是 W&B、Python 和 PyTorch 实验工具，不适合作为 AI PM 评测入门。", confidence: 0.93, exitCriteria: [], sourceCitations: courses[4]!.sourceCitations },
  ],
  mappings: [
    { courseId: "dlai.ai-for-everyone", unitId: "ai4e.landscape", nodeId: "ai.capability-boundary", depth: 1, relation: "core", confidence: 0.91, sourceCitations: courses[0]!.sourceCitations },
    { courseId: "dlai.ai-for-everyone", unitId: "ai4e.projects", nodeId: "ai.project-opportunity", depth: 1, relation: "core", confidence: 0.9, sourceCitations: courses[0]!.sourceCitations },
    { courseId: "dlai.genai-for-everyone", unitId: "genai.capabilities", nodeId: "genai.capability-boundary", depth: 1, relation: "core", confidence: 0.9, sourceCitations: courses[1]!.sourceCitations },
    { courseId: "dlai.agentic-ai", unitId: "agentic.intro", nodeId: "agent.autonomy", depth: 1, relation: "core", confidence: 0.87, sourceCitations: courses[3]!.sourceCitations },
  ],
  stages: [
    { id: "stage.landscape", title: "AI 与项目判断", objective: "先形成 AI 能力边界和项目机会判断。", unitRefs: [{ courseId: "dlai.ai-for-everyone", unitId: "ai4e.landscape" }, { courseId: "dlai.ai-for-everyone", unitId: "ai4e.projects" }], exitCriteria: ["能解释一个适合和一个不适合 AI 的产品问题"] },
    { id: "stage.genai", title: "生成式 AI 与 Agent 判断", objective: "理解生成式 AI 能力以及 Agent 自治程度。", unitRefs: [{ courseId: "dlai.genai-for-everyone", unitId: "genai.capabilities" }, { courseId: "dlai.agentic-ai", unitId: "agentic.intro" }], exitCriteria: ["能为一个工作流选择合适的生成式 AI 和 Agent 边界"] },
  ],
  unresolvedGaps: ["人机交互", "产品评测框架", "风险与人工兜底"],
  rationale: "用一门通识主课建立全景，只从其他课程采用目标相关模块，并明确 DeepLearning.AI 目录不能单独覆盖完整 AI PM 路线。",
  generatedAt: retrievedAt,
};

test("DeepLearning.AI benchmark：课程目录被压缩为一门主课和少量指定章节", () => {
  const report = evaluateCurriculumAssembly({ courses, assembly });
  assert.equal(report.passed, true, JSON.stringify(report.issues));
  assert.equal(report.metrics.targetCoverage, 1);
  assert.equal(report.metrics.decisionTraceability, 1);
  assert.equal(report.metrics.mappingTraceability, 1);
  assert.ok(report.metrics.selectedCourseRatio < 1, "不能把课程目录全部标记为当前采用");
});

test("Course Intelligence Eval：局部采用却未指定章节时阻止发布", () => {
  const broken: CurriculumAssembly = {
    ...assembly,
    decisions: assembly.decisions.map((decision) => decision.courseId === "dlai.agentic-ai"
      ? { ...decision, selectedUnitIds: [] }
      : decision),
  };
  const report = evaluateCurriculumAssembly({ courses, assembly: broken });
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "missing_selected_units"));
});

test("Course Intelligence Eval：进入阶段的章节必须有知识节点映射", () => {
  const broken: CurriculumAssembly = { ...assembly, mappings: assembly.mappings.filter((mapping) => mapping.unitId !== "agentic.intro") };
  const report = evaluateCurriculumAssembly({ courses, assembly: broken });
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "unmapped_stage_unit"));
});
