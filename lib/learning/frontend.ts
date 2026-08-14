// V0.2 前端共享：Workspace 类型 + API client
// 前端只围绕一个 workspace 渲染，只调新闭环 API。

export interface WorkspaceProfile {
  id: string;
  ownerId: string;
  goal: string;
  activeRouteId: string;
  weeklyMinutes: number;
  status: "diagnosed" | "proposed" | "confirmed";
}

export interface WorkspaceRoute {
  id: string;
  title: string;
  version: string;
  description: string;
}

export interface AdjacentBranch {
  id: string;
  name: string;
  description: string;
}

export interface WorkspacePlan {
  id: string;
  ownerId: string;
  routeId: string;
  weekKey: string;
  capacityMinutes: number;
  status: "draft" | "confirmed" | "archived";
  rationale: string;
}

export interface WorkspaceActivity {
  id: string;
  ownerId: string;
  weeklyPlanId: string;
  nodeId: string;
  title: string;
  activityType: "build_model" | "follow_demo" | "independent_practice";
  goal: string;
  estimatedMinutes: number;
  isCore: boolean;
  status: "planned" | "in_progress" | "evidence_submitted" | "reviewed" | "completed";
  isSkipValidation: boolean;
  inputRefs: string[];
  steps: string;
  expectedEvidence: string;
  evaluationCriteria: string;
  nextAdvice: string;
  sequence: number;
}

export interface WorkspaceEvidence {
  id: string;
  ownerId: string;
  activityId: string;
  nodeId: string;
  evidenceType: string;
  content: string;
  externalUrl: string;
  status: "draft" | "submitted" | "accepted" | "needs_revision";
  feedback: string;
}

export interface WorkspaceNodeProgress {
  id: string;
  ownerId: string;
  nodeId: string;
  status: "unstarted" | "growing" | "validated";
  confidence: number;
  lastValidatedAt: string | null;
  supportingEvidenceIds: string[];
}

export interface WorkspaceAdjustment {
  id: string;
  ownerId: string;
  routeId: string;
  weeklyPlanId: string | null;
  adjustmentType: "activity_replan" | "weekly_light" | "route_revision";
  reason: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  summary: string;
}

export interface WorkbenchResource {
  resourceId: string;
  title: string;
  url: string;
  sourceType: string;
  credibilityLevel: number;
  summary: string;
  nodeId: string;
  usage: string;
}

export interface WorkbenchTool {
  toolId: string;
  name: string;
  url: string;
  description: string;
  nodeId: string;
  usage: string;
  activityContext: string;
}

export interface Workspace {
  profile: WorkspaceProfile | null;
  route: WorkspaceRoute | null;
  adjacentBranches: AdjacentBranch[];
  edges: WorkspaceEdge[];
  weeklyPlan: WorkspacePlan | null;
  activities: WorkspaceActivity[];
  nodeProgress: WorkspaceNodeProgress[];
  evidence: WorkspaceEvidence[];
  adjustments: WorkspaceAdjustment[];
  workbench: { resources: WorkbenchResource[]; tools: WorkbenchTool[] };
}

// 当前路线的边（前置关系），成长页树状图使用
export interface WorkspaceEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: "prerequisite" | "supports" | "related";
}

export interface AssessmentResult {
  evidenceId: string;
  verdict: "accepted" | "needs_revision";
  confidence: number;
  reasons: string[];
  missing: string[];
  suggestedLevel: number;
  nextAction: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }
  return data;
}

const jsonHeaders = { "content-type": "application/json" };

export async function fetchWorkspace(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(await fetch("/api/learning/workspace"));
  return data.workspace;
}

export async function postDiagnostic(input: {
  goal: string;
  weeklyMinutes: number;
  materialIds?: string[];
  selfReport?: Record<string, number>;
  preference?: "breadth_first" | "build_first";
}): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch("/api/learning/diagnostic", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }),
  );
  return data.workspace;
}

export async function confirmProposal(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch("/api/learning/proposal/confirm", { method: "POST" }),
  );
  return data.workspace;
}

export async function startActivity(activityId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch(`/api/learning/activities/${activityId}/start`, { method: "POST" }),
  );
  return data.workspace;
}

export async function submitEvidence(
  activityId: string,
  input: { content: string; externalUrl?: string; evidenceType?: string },
): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch(`/api/learning/activities/${activityId}/evidence`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.workspace;
}

export async function reviewEvidence(evidenceId: string): Promise<{
  workspace: Workspace;
  assessment: AssessmentResult;
}> {
  return readJson<{ workspace: Workspace; assessment: AssessmentResult }>(
    await fetch(`/api/learning/evidence/${evidenceId}/review`, { method: "POST" }),
  );
}

export async function confirmAdjustment(adjustmentId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch(`/api/learning/adjustments/${adjustmentId}/confirm`, { method: "POST" }),
  );
  return data.workspace;
}

export async function proposeAdjustment(input: {
  adjustmentType: WorkspaceAdjustment["adjustmentType"];
  reason: string;
}): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch("/api/learning/adjustments/propose", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.workspace;
}

export async function skipNode(nodeId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch(`/api/learning/nodes/${nodeId}/skip`, { method: "POST" }),
  );
  return data.workspace;
}

export async function resetLearner(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await fetch("/api/learning/reset", { method: "POST" }),
  );
  return data.workspace;
}

// ── LLM API 配置 ────────────────────────────────────
export interface ApiConfigStatus {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
  keyMasked: boolean;
}

export async function fetchApiConfig(): Promise<ApiConfigStatus> {
  const data = await readJson<{ config: ApiConfigStatus }>(
    await fetch("/api/learning/api-config"),
  );
  return data.config;
}

export async function saveApiConfig(input: {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  enabled: boolean;
}): Promise<ApiConfigStatus> {
  const data = await readJson<{ config: ApiConfigStatus }>(
    await fetch("/api/learning/api-config", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.config;
}

// ── 状态文案映射 ──────────────────────────────────────
export const NODE_STATUS_TEXT: Record<WorkspaceNodeProgress["status"], string> = {
  unstarted: "未点亮",
  growing: "成长中",
  validated: "已验证",
};

export const ACTIVITY_STATUS_TEXT: Record<WorkspaceActivity["status"], string> = {
  planned: "待开始",
  in_progress: "进行中",
  evidence_submitted: "待评估",
  reviewed: "已评估",
  completed: "已完成",
};

export const EVIDENCE_STATUS_TEXT: Record<WorkspaceEvidence["status"], string> = {
  draft: "草稿",
  submitted: "待评估",
  accepted: "已接受",
  needs_revision: "需修订",
};

export const ACTIVITY_TYPE_TEXT: Record<WorkspaceActivity["activityType"], string> = {
  build_model: "建立模型",
  follow_demo: "跟随示范",
  independent_practice: "独立练习",
};

export const ADJUSTMENT_TYPE_TEXT: Record<WorkspaceAdjustment["adjustmentType"], string> = {
  activity_replan: "活动重排",
  weekly_light: "周计划微调",
  route_revision: "路线调整",
};

export const NODE_TITLE_BY_ID: Record<string, string> = {
  "ai-literacy.mechanism": "模型机制",
  "ai-literacy.context": "上下文与提示",
  "ai-literacy.fit": "适用边界",
  "ai-literacy.architecture": "AI 应用结构",
  "ai-literacy.evaluation": "评估与质量",
  "ai-literacy.responsibility": "责任与安全",
  "ai-app-dev.prompting": "提示工程",
  "ai-app-dev.rag": "RAG 检索增强",
  "ai-app-dev.tools": "工具调用",
  "ai-app-dev.eval-harness": "评估脚手架",
  "ai-product.problem-def": "问题定义",
  "ai-product.capability-design": "能力设计",
  "ai-product.eval-decision": "评估决策",
};

export function nodeTitle(nodeId: string): string {
  return NODE_TITLE_BY_ID[nodeId] ?? nodeId;
}
