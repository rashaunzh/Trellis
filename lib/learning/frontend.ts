// V0.2 前端共享：Workspace 类型 + API client
// 前端只围绕一个 workspace 渲染，只调新闭环 API。

// Full Chain Phase 2：analysis 为 runDiagnostic 响应的瞬态字段（type-only 引用，
// 运行期无依赖；前端当前不消费，仅保持类型与 API 响应一致）。
import type { LearningAnalysis } from "./agents/types.ts";
import type {
  LearningEvalReport,
  LearningQualityMonitor,
} from "./agents/learning-quality.ts";
import type { LearningMemorySnapshot } from "./architecture/learning-memory.ts";
import type { NextStagePlan, PortfolioArtifactIteration } from "./agents/next-stage-planner.ts";
import type { TrellisMastraRuntimeReport } from "./agents/mastra-workflow.ts";
import type {
  CurriculumConstraint,
  CurriculumRecord,
  LearningIntake,
  LearningSignalInput,
  PublicScenarioCheck,
} from "./intelligence/course-intelligence.ts";
import type { CourseIntelligenceState, CurrentLearningState, LearningTaskResult, MaterialAnalysisResult, SourceResolution } from "./intelligence/service.ts";
import type { LearningOrchestrationState } from "./intelligence/orchestration.ts";
import type { ContentAnalysis, ContentSource } from "./intelligence/content-source.ts";
import type { ContentSourceDetails } from "./intelligence/service.ts";

export type {
  LearningEvalReport,
  LearningQualityMonitor,
  LearningMemorySnapshot,
  NextStagePlan,
  PortfolioArtifactIteration,
  TrellisMastraRuntimeReport,
  CurriculumRecord,
  LearningIntake,
  CourseIntelligenceState,
  MaterialAnalysisResult,
  CurrentLearningState,
  CurriculumConstraint,
  PublicScenarioCheck,
  SourceResolution,
  LearningTaskResult,
  LearningOrchestrationState,
  ContentSource,
  ContentAnalysis,
  ContentSourceDetails,
};

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

export interface WorkspaceWeekReview {
  weekKey: string;
  completedCount: number;
  acceptedEvidenceCount: number;
  openActivityCount: number;
  revisionCount: number;
  materialMismatchCount: number;
  capacityMinutes: number;
  plannedMinutes: number;
  completionRate: number;
  summary: string;
  nextBestMove: string;
  nextWeekProposal: {
    title: string;
    summary: string;
    actionCount: number;
    canGenerate: boolean;
  };
  archivedAt: string | null;
  generatedNextWeek: boolean;
}

export interface WorkspaceWeeklyPlanSummary {
  weekKey: string;
  status: WorkspacePlan["status"];
  capacityMinutes: number;
  activityCount: number;
  coreActivityCount: number;
  completedCount: number;
  acceptedEvidenceCount: number;
  isCurrentWeek: boolean;
  isFutureWeek: boolean;
  reviewSummary: string | null;
  reviewArchivedAt: string | null;
  generatedFromReview: boolean;
}

export interface WorkspaceActivity {
  id: string;
  ownerId: string;
  weeklyPlanId: string;
  nodeId: string;
  curriculumId?: string;
  courseVersionId?: string;
  courseId?: string;
  unitId?: string;
  canonicalNodeId?: string;
  scope?: {
    segmentId: string;
    sourceUrl?: string;
    locatorLabel: string;
    locatorMissing: boolean;
    manualOverride?: boolean;
    sourceUpdatedAt?: string;
    stopCondition: string;
    completionSignal: string;
    nodeIds: string[];
  };
  title: string;
  activityType: "build_model" | "follow_demo" | "independent_practice" | "quiz" | "reflection" | "integrated_task" | "retest";
  goal: string;
  estimatedMinutes: number;
  isCore: boolean;
  status: "planned" | "in_progress" | "paused" | "evidence_submitted" | "reviewed" | "completed";
  isSkipValidation: boolean;
  inputRefs: string[];
  steps: string;
  expectedEvidence: string;
  evaluationCriteria: string;
  nextAdvice: string;
  sequence: number;
  startedAt?: string | null;
  lastOpenedAt?: string | null;
  pausedAt?: string | null;
  completedAt?: string | null;
  pauseReason?: string;
  actualMinutes?: number | null;
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

export type ContentJudgmentRole = "本周主线" | "只作参考" | "后续再用" | "暂不碰";
export type ActionTier = "主推进" | "补充推进" | "低精力备选" | "暂不碰";
export type ActionFeedbackMode = "light_status" | "scenario_judgment" | "small_template";

export interface WorkspaceConceptHint {
  id: string;
  label: string;
  plainText: string;
}

export interface WorkspaceContentJudgment {
  resourceId: string;
  title: string;
  professionalVerdict: "专业可信" | "基本可用" | "需要谨慎";
  fitVerdict: "适合本周" | "适合稍后" | "仅供参考" | "暂不适合";
  role: ContentJudgmentRole;
  recommendedSegment: string;
  skipReason: string;
  useFor: string;
  qualityRationale: string;
  skipGuidance: string;
  conceptsIntroduced: WorkspaceConceptHint[];
  entersCurrentWeek: boolean;
  rawContent?: string;
}

export interface WorkspaceCourseSlice {
  id: string;
  resourceId: string;
  title: string;
  resourceTitle: string;
  nodeId: string;
  role: ContentJudgmentRole;
  sourceRange: string;
  whyThisSlice: string;
  estimatedMinutes: number;
  difficulty: "入门" | "适中" | "偏难";
  learnerAction: string;
  afterWatchingPrompt: string;
  skipReason: string;
  entersCurrentWeek: boolean;
  activityIds: string[];
}

export interface WorkspaceScenarioQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string; text: string }>;
  preferredOptionId: string;
  diagnosisByOption: Record<string, string>;
  nextActionByOption: Record<string, string>;
}

export interface WorkspaceWeeklyActionCard {
  id: string;
  activityId: string | null;
  weekKey: string;
  title: string;
  tier: ActionTier;
  actionType: "看这一段" | "做一个判断" | "拆一个案例" | "填一个小框架" | "整理一个材料取舍" | "缩小一步";
  whyNow: string;
  materialSlice: string;
  courseSliceIds: string[];
  estimatedMinutes: number;
  conceptHints: WorkspaceConceptHint[];
  feedbackMode: ActionFeedbackMode;
  scenarioQuestion: WorkspaceScenarioQuestion | null;
  nextIfClear: string;
  nextIfStuck: string;
}

export interface WorkspaceLearningOutput {
  id: string;
  kind: "判断记录" | "学习产出" | "作品片段" | "进展记录";
  title: string;
  sourceActionId: string | null;
  weekKey: string;
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
  segmentFocus?: string;
  qualityRationale?: string;
  skipGuidance?: string;
  learnerAction?: string;
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
  weekReview: WorkspaceWeekReview | null;
  weeklyPlanHistory: WorkspaceWeeklyPlanSummary[];
  contentJudgment: WorkspaceContentJudgment[];
  courseSlices: WorkspaceCourseSlice[];
  weeklyActionPlan: WorkspaceWeeklyActionCard[];
  nextAction: WorkspaceWeeklyActionCard | null;
  conceptHints: WorkspaceConceptHint[];
  learningOutputs: WorkspaceLearningOutput[];
  activities: WorkspaceActivity[];
  nodeProgress: WorkspaceNodeProgress[];
  evidence: WorkspaceEvidence[];
  adjustments: WorkspaceAdjustment[];
  nextStagePlan: NextStagePlan | null;
  artifactIteration: PortfolioArtifactIteration;
  userResources: WorkspaceUserResource[];
  dueReviews: Array<{ nodeId: string; title: string; daysSinceValidated: number; nextReviewAt: string | null }>;
  workbench: { resources: WorkbenchResource[]; tools: WorkbenchTool[] };
  // 瞬态分析（仅 runDiagnostic 响应携带；其他端点/刷新为 null）
  analysis: LearningAnalysis | null;
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
  rubricReviews: RubricReview[];
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

export interface RubricReview {
  rubricId: string;
  criterion: string;
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

export async function fetchWorkspace(input: { weekKey?: string } = {}): Promise<Workspace> {
  const query = input.weekKey ? `?weekKey=${encodeURIComponent(input.weekKey)}` : "";
  const data = await readJson<{ workspace: Workspace }>(await apiFetch(`/api/learning/workspace${query}`));
  return data.workspace;
}

export async function fetchLearningQuality(): Promise<LearningQualityMonitor> {
  const data = await readJson<{ quality: LearningQualityMonitor }>(await apiFetch("/api/learning/quality"));
  return data.quality;
}

export async function fetchLearningMemory(): Promise<LearningMemorySnapshot> {
  const data = await readJson<{ memory: LearningMemorySnapshot }>(await apiFetch("/api/learning/memory"));
  return data.memory;
}

export async function fetchPortfolioArtifactIteration(): Promise<PortfolioArtifactIteration> {
  const data = await readJson<{ artifactIteration: PortfolioArtifactIteration }>(
    await apiFetch("/api/learning/artifact"),
  );
  return data.artifactIteration;
}

export async function runPortfolioEval(): Promise<LearningEvalReport> {
  const data = await readJson<{ report: LearningEvalReport }>(
    await apiFetch("/api/learning/eval", { method: "POST" }),
  );
  return data.report;
}

export async function runMastraRuntimeDemo(): Promise<TrellisMastraRuntimeReport> {
  const data = await readJson<{ report: TrellisMastraRuntimeReport }>(
    await apiFetch("/api/learning/mastra-runtime", { method: "POST" }),
  );
  return data.report;
}

export async function postDiagnostic(input: {
  goal: string;
  weeklyMinutes: number;
  materialIds?: string[];
  selfReport?: Record<string, number>;
  preference?: "breadth_first" | "build_first";
  plannerMode?: "legacy" | "adaptive_preview" | "adaptive_existing_content";
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

export async function createPortfolioArtifactActivity(): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/artifact", { method: "POST" }),
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

export async function generateNextWeekPlan(input: { weekKey?: string } = {}): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/week-review", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ weekKey: input.weekKey }),
    }),
  );
  return data.workspace;
}

export async function archiveWeekReview(weekKey?: string): Promise<Workspace> {
  const data = await readJson<{ workspace: Workspace }>(
    await apiFetch("/api/learning/week-review", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ weekKey, generateNextWeek: false }),
    }),
  );
  return data.workspace;
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
  relatedNodeIds?: string[];
}): Promise<{ resources: WorkspaceUserResource[] }> {
  return readJson<{ resources: WorkspaceUserResource[] }>(
    await apiFetch("/api/learning/resources/inbox", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchCourseIntelligenceState(): Promise<CourseIntelligenceState> {
  const data = await readJson<{ state: CourseIntelligenceState }>(
    await apiFetch("/api/learning/intelligence/state"),
  );
  return data.state;
}

export async function fetchContentSources(): Promise<ContentSourceDetails[]> {
  const data = await readJson<{ sources: ContentSourceDetails[] }>(await apiFetch("/api/learning/sources"));
  return data.sources;
}

export async function createContentSource(input: { title: string; type?: ContentSource["type"]; canonicalUrl?: string | null; rawContent?: string | null }): Promise<ContentSource> {
  const data = await readJson<{ source: ContentSource }>(await apiFetch("/api/learning/sources", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }));
  return data.source;
}

export async function fetchContentSource(sourceId: string): Promise<ContentSourceDetails> {
  return readJson<ContentSourceDetails>(await apiFetch(`/api/learning/sources/${sourceId}`));
}

export async function updateContentSource(sourceId: string, input: { title: string; canonicalUrl: string | null; rawContent: string | null; expectedUpdatedAt: string }): Promise<ContentSourceDetails> {
  return readJson<ContentSourceDetails>(await apiFetch(`/api/learning/sources/${sourceId}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(input) }));
}

export async function adoptContentSource(sourceId: string, analysisVersion: number): Promise<{ status: string; message: string }> {
  return readJson(await apiFetch(`/api/learning/sources/${sourceId}/adopt`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ analysisVersion }) }));
}

export async function analyzeContentSource(sourceId: string): Promise<ContentSourceDetails> {
  return readJson<ContentSourceDetails>(await apiFetch(`/api/learning/sources/${sourceId}/analyze`, { method: "POST" }));
}

export async function confirmContentFragments(sourceId: string, input: { fragmentIds: string[]; decision: "confirmed" | "rejected" }): Promise<ContentSourceDetails> {
  return readJson<ContentSourceDetails>(await apiFetch(`/api/learning/sources/${sourceId}/confirm`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }));
}

export async function createCurriculum(input: LearningIntake, signal?: AbortSignal): Promise<CurriculumRecord> {
  const data = await readJson<{ curriculum: CurriculumRecord }>(
    await apiFetch("/api/learning/intake", {
      signal,
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.curriculum;
}

export async function analyzeCourseMaterial(input: LearningIntake["materials"][number]): Promise<MaterialAnalysisResult> {
  const data = await readJson<{ analysis: MaterialAnalysisResult }>(
    await apiFetch("/api/learning/materials/analyze", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  );
  return data.analysis;
}

export async function confirmCurriculum(id: string): Promise<CurriculumRecord> {
  const data = await readJson<{ curriculum: CurriculumRecord }>(
    await apiFetch(`/api/learning/curricula/${id}/confirm`, { method: "POST" }),
  );
  return data.curriculum;
}

export async function reviseCurriculum(id: string, constraints: CurriculumConstraint[]) {
  return readJson<{ curriculum: CurriculumRecord }>(
    await apiFetch(`/api/learning/curricula/${id}/revise`, {
      method: "POST", headers: jsonHeaders, body: JSON.stringify({ constraints }),
    }),
  );
}

export async function fetchCurrentLearning(): Promise<CurrentLearningState> {
  const data = await readJson<{ current: CurrentLearningState }>(await apiFetch("/api/learning/current"));
  return data.current;
}

export async function fetchLearningOrchestration(): Promise<LearningOrchestrationState> {
  const data = await readJson<{ orchestration: LearningOrchestrationState }>(
    await apiFetch("/api/learning/orchestration"),
  );
  return data.orchestration;
}

export async function startLearningActivity(activityId: string) {
  return readJson<{ activity: WorkspaceActivity; sourceResolution: SourceResolution }>(
    await apiFetch(`/api/learning/runs/${activityId}/start`, { method: "POST" }),
  );
}

export async function pauseLearningActivity(activityId: string, reason = "") {
  return readJson<{ activity: WorkspaceActivity }>(await apiFetch(`/api/learning/runs/${activityId}/pause`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ reason }),
  }));
}

export async function updateLearningLocation(activityId: string, input: { sourceUrl: string; locatorLabel: string }) {
  return readJson<{ activity: WorkspaceActivity; sourceResolution: SourceResolution }>(
    await apiFetch(`/api/learning/runs/${activityId}/location`, {
      method: "PATCH", headers: jsonHeaders, body: JSON.stringify(input),
    }),
  );
}

export async function attachWorkbenchResource(resourceId: string, input: { activityId: string; nodeId?: string }) {
  return readJson(await apiFetch(`/api/learning/resources/${resourceId}/attachments`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(input),
  }));
}

export async function detachWorkbenchResource(resourceId: string, activityId: string) {
  return readJson(await apiFetch(`/api/learning/resources/${resourceId}/attachments`, {
    method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ activityId }),
  }));
}

const pendingFeedback = new Map<string, string>();
export async function rejectCurriculumDecision(decisionId: string) {
  return readJson(await apiFetch(`/api/learning/decisions/${decisionId}/reject`, { method: "POST", headers: jsonHeaders, body: "{}" }));
}
export async function recordLearningSignal(activityId: string, input: LearningSignalInput) {
  const key = JSON.stringify([activityId, input]);
  const storageKey = `trellis.pendingFeedback.${getOwnerId()}.${key}`;
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(storageKey); } catch { /* 存储不可用时仍允许提交 */ }
  const submissionId = input.submissionId ?? pendingFeedback.get(key) ?? saved ?? crypto.randomUUID();
  pendingFeedback.set(key, submissionId);
  try { sessionStorage.setItem(storageKey, submissionId); } catch { /* 仅保留内存重试标识 */ }
  const response = await readJson(await apiFetch(`/api/learning/runs/${activityId}/feedback`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ ...input, submissionId }),
  }));
  pendingFeedback.delete(key);
  try { sessionStorage.removeItem(storageKey); } catch { /* 不影响已保存结果 */ }
  return response;
}

export async function fetchScenarioCheck(activityId: string): Promise<PublicScenarioCheck> {
  const data = await readJson<{ check: PublicScenarioCheck }>(
    await apiFetch(`/api/learning/runs/${activityId}/check`, { method: "POST" }),
  );
  return data.check;
}

export async function fetchLearningTaskResult(activityId: string): Promise<LearningTaskResult> {
  const data = await readJson<{ result: LearningTaskResult }>(await apiFetch(`/api/learning/tasks/${activityId}/result`));
  return data.result;
}

export async function closeLearningWeek(weekKey: string) {
  return readJson(await apiFetch(`/api/learning/weeks/${encodeURIComponent(weekKey)}/close`, { method: "POST" }));
}

export async function confirmLearningWeek(weekKey: string) {
  return readJson(await apiFetch(`/api/learning/weeks/${encodeURIComponent(weekKey)}/confirm`, { method: "POST" }));
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
  paused: "已暂停",
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
