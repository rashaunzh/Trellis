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
  activityType: "build_model" | "follow_demo" | "independent_practice" | "quiz" | "reflection" | "integrated_task" | "retest";
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

export interface WorkspaceUserResource {
  id: string;
  title: string;
  type: "link" | "note" | "tool" | "resource";
  content: string;
  sourceUrl: string;
  relatedNodeIds: string[];
  createdAt: string;
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
  extractedJson: string;
  reviewJson: string;
}

export interface WorkspaceNodeProgress {
  id: string;
  ownerId: string;
  nodeId: string;
  title: string; // 中文标题（workspace 聚合注入，来自内容包）
  status: "unstarted" | "growing" | "pending_confirmation" | "validated";
  confidence: number;
  lastValidatedAt: string | null;
  supportingEvidenceIds: string[];
}

export interface WorkspaceAdjustment {
  id: string;
  ownerId: string;
  routeId: string;
  weeklyPlanId: string | null;
  adjustmentType: "activity_replan" | "weekly_light" | "route_revision" | "mastery_confirm";
  reason: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  summary: string;
  actionJson: string;
  missingSignals?: string[];
  partialSignals?: string[];
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
  userResources: WorkspaceUserResource[];
  dueReviews: Array<{ nodeId: string; title: string; daysSinceValidated: number; nextReviewAt: string | null }>;
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
  score: number;
  evidenceCard: EvidenceCard;
  signalReviews: SignalReview[];
  dimensionScores: ReviewDimensionScore[];
  reasons: string[];
  missing: string[];
  rationale: string;
  credibilityNote: string;
  suggestedLevel: number;
  nextAction: string;
}

export interface EvidenceCard {
  title: string;
  artifactUrl: string;
  artifactType: string;
  summary: string;
  extractedItems: string[];
  sourceReadability: string;
}

export interface SignalReview {
  signalId: string;
  label: string;
  status: "covered" | "partial" | "missing";
  reason: string;
  evidenceRefs: string[];
}

export interface ReviewDimensionScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }
  return data;
}

const jsonHeaders = { "content-type": "application/json" };

// ── 匿名 owner 隔离（demo，非鉴权）──────────────────
// 浏览器首次访问生成稳定 ownerId 存 localStorage，随请求头发给后端；
// 每个浏览器一个独立学习状态，互不干扰。
// SSR（无 localStorage）不带 header → 后端回退 DEFAULT_OWNER（首帧为 loading 态，无数据依赖）。
const OWNER_ID_KEY = "trellis.anonymousOwnerId";

export function getOwnerId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    let id = localStorage.getItem(OWNER_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `trellis-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(OWNER_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const ownerId = getOwnerId();
  if (ownerId) headers.set("x-trellis-owner-id", ownerId);
  return fetch(input, { ...init, headers });
}

export async function fetchWorkspace(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(await apiFetch("/api/learning/workspace"));
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
    await apiFetch("/api/learning/diagnostic", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }),
  );
  return data.workspace;
}

export async function confirmProposal(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/proposal/confirm", { method: "POST" }),
  );
  return data.workspace;
}

export async function startActivity(activityId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/activities/${activityId}/start`, { method: "POST" }),
  );
  return data.workspace;
}

export async function submitEvidence(
  activityId: string,
  input: { content: string; externalUrl?: string; evidenceType?: string },
): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/activities/${activityId}/evidence`, {
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
    await apiFetch(`/api/learning/evidence/${evidenceId}/review`, { method: "POST" }),
  );
}

export async function confirmAdjustment(adjustmentId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/adjustments/${adjustmentId}/confirm`, { method: "POST" }),
  );
  return data.workspace;
}

export async function rejectAdjustment(adjustmentId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/adjustments/${adjustmentId}/reject`, { method: "POST" }),
  );
  return data.workspace;
}

export async function proposeAdjustment(input: {
  adjustmentType: WorkspaceAdjustment["adjustmentType"];
  reason: string;
}): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/adjustments/propose", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.workspace;
}

export async function skipNode(nodeId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/nodes/${nodeId}/skip`, { method: "POST" }),
  );
  return data.workspace;
}

export async function resetLearner(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/reset", { method: "POST" }),
  );
  return data.workspace;
}

export async function replanCurrentWeek(input: { weeklyMinutes?: number } = {}): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/replan", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
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

export async function fetchInboxResources(): Promise<WorkspaceUserResource[]> {
  const data = await readJson<{ resources: WorkspaceUserResource[] }>(
    await apiFetch("/api/learning/resources/inbox"),
  );
  return data.resources;
}

export async function confirmMastery(
  nodeId: string,
  input: { decision: "confirmed" | "corrected"; note?: string },
): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/nodes/${nodeId}/confirm-mastery`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.workspace;
}

export async function retestNode(nodeId: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch(`/api/learning/nodes/${nodeId}/retest`, { method: "POST" }),
  );
  return data.workspace;
}

export async function addInboxResource(input: {
  title: string;
  type: WorkspaceUserResource["type"];
  content?: string;
  sourceUrl?: string;
}): Promise<{ resources: WorkspaceUserResource[] }> {
  return readJson<{ resources: WorkspaceUserResource[] }>(
    await apiFetch("/api/learning/resources/inbox", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchApiConfig(): Promise<ApiConfigStatus> {
  const data = await readJson<{ config: ApiConfigStatus }>(
    await apiFetch("/api/learning/api-config"),
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
    await apiFetch("/api/learning/api-config", {
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
  pending_confirmation: "待确认",
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
  follow_demo: "阅读与示范",
  independent_practice: "动手实践",
  quiz: "小测验",
  reflection: "反思总结",
  integrated_task: "综合情境",
  retest: "延迟复测",
};

export const ADJUSTMENT_TYPE_TEXT: Record<WorkspaceAdjustment["adjustmentType"], string> = {
  activity_replan: "活动重排",
  weekly_light: "周计划微调",
  route_revision: "路线调整",
  mastery_confirm: "掌握确认",
};

// 节点中文标题由 workspace 聚合注入（内容包为唯一真相），前端不再维护映射表。
