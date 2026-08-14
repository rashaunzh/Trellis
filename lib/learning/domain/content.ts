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

const nodes: LearningNode[] = [
  // ── AI 通识与认知（主干）────────────────────────────
  {
    id: "ai-literacy.mechanism",
    routeId: "ai-literacy",
    title: "机制与边界",
    description: "解释模型为何有效、为何会失败，以及概率性输出意味着什么。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-literacy.fit",
    routeId: "ai-literacy",
    title: "问题适配与人机职责",
    description: "判断问题是否适合 AI，并界定成功结果、失败边界与人工责任。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
  {
    id: "ai-literacy.context",
    routeId: "ai-literacy",
    title: "上下文与可核验使用",
    description: "组织指令、上下文、工具和来源，完成可复核任务。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-literacy.architecture",
    routeId: "ai-literacy",
    title: "应用架构选择",
    description: "区分直接生成、RAG、工具调用与 Agent，并选择基础架构。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-literacy.evaluation",
    routeId: "ai-literacy",
    title: "评测与人工确认",
    description: "设计样例、指标、拒答、失败检查与人工升级机制。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
  {
    id: "ai-literacy.responsibility",
    routeId: "ai-literacy",
    title: "责任与约束",
    description: "识别隐私、安全、偏见、版权、权限、成本和自动化风险。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
  // ── AI 应用开发分支 ──────────────────────────────────
  {
    id: "ai-app-dev.prompting",
    routeId: "ai-app-dev",
    title: "提示工程基础",
    description: "用任务说明、材料边界和输出格式稳定控制模型输出。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-app-dev.rag",
    routeId: "ai-app-dev",
    title: "检索增强生成（RAG）",
    description: "把受控知识源接入模型：切分、检索、引用与无答案处理。",
    targetLevel: 2,
    isKeyMilestone: true,
  },
  {
    id: "ai-app-dev.tools",
    routeId: "ai-app-dev",
    title: "工具调用与动作",
    description: "让模型读取实时数据或执行受控动作，并处理权限边界。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-app-dev.eval-harness",
    routeId: "ai-app-dev",
    title: "最小评测集搭建",
    description: "为应用搭建固定样例评测集，比较版本并拦截关键红线。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
  // ── AI 产品经理分支 ──────────────────────────────────
  {
    id: "ai-product.problem-def",
    routeId: "ai-product",
    title: "问题定义与用户价值",
    description: "从用户问题出发界定 AI 产品要解决的真实问题与成功标准。",
    targetLevel: 2,
    isKeyMilestone: false,
  },
  {
    id: "ai-product.capability-design",
    routeId: "ai-product",
    title: "能力设计与边界",
    description: "把需求拆成可评测的能力，明确模型行为边界与人工兜底。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
  {
    id: "ai-product.eval-decision",
    routeId: "ai-product",
    title: "评估与产品决策",
    description: "用评测结果做上线/回滚/迭代决策，区分用户感知与系统指标。",
    targetLevel: 3,
    isKeyMilestone: true,
  },
];

const edges: LearningEdge[] = [
  // 通识内部前置
  { sourceNodeId: "ai-literacy.mechanism", targetNodeId: "ai-literacy.fit", relationType: "prerequisite" },
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
  { resourceId: "res.gml-crash-course", nodeId: "ai-literacy.mechanism", usage: "理解训练、推理与泛化机制" },
  { resourceId: "res.nist-ai-rmf", nodeId: "ai-literacy.fit", usage: "界定 AI 与非 AI 方案的成功标准与失败代价" },
  { resourceId: "res.gemini-prompting", nodeId: "ai-literacy.context", usage: "组织任务、材料、输出格式与引用" },
  { resourceId: "res.openai-evals", nodeId: "ai-literacy.evaluation", usage: "设计样例、指标与人工升级机制" },
  { resourceId: "res.nist-ai-600-1", nodeId: "ai-literacy.responsibility", usage: "识别隐私、安全、偏见与权限风险" },
  { resourceId: "res.unsplash-docs", nodeId: "ai-app-dev.tools", usage: "工具调用实现与权限边界" },
  { resourceId: "res.openai-evals", nodeId: "ai-app-dev.eval-harness", usage: "搭建固定样例评测集" },
  { resourceId: "res.openai-evals", nodeId: "ai-product.eval-decision", usage: "用评测结果做产品决策" },
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
