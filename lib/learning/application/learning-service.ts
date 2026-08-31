// V0.2 learning application — 用例服务
// 编排闭环：诊断 → 路线确认 → 活动开始 → 证据提交 → 评估 → 节点状态 → 调整建议。
// 只依赖 LearningStore 接口与 Agent 接口，不直接触碰数据库实现。

import {
  learningContentPack,
  prerequisitesSatisfied,
  findAdjacentBranches,
  getPrerequisiteNodeIds,
} from "../domain/content.ts";
import {
  transitionActivity,
  transitionEvidence,
  transitionNode,
  nodeEventOfEvidence,
  decideSkip,
} from "../domain/state-machine.ts";
import type {
  AdjustmentRecord,
  AdjustmentType,
  Evidence,
  LearningActivity,
  LearningNode,
  UserResource,
  NodeProgress,
  NodeStatus,
  WeeklyPlan,
} from "../domain/types.ts";
import type {
  AgentRegistry,
  ActivityDraft,
  AdjustmentSuggestion,
  EvidenceAssessment,
  LearningAnalysis,
  MaterialReview,
  PlannerMode,
} from "../agents/types.ts";
import type { AdaptivePlan } from "../agents/adaptive-types.ts";
import type { LearningStore, LearnerProfile, WeekReviewRecord } from "../persistence/store.ts";
import { InMemoryLearningStore } from "../persistence/in-memory.ts";
import { createRuleAgents } from "../agents/index.ts";
import { adaptiveDraftToActivity } from "../agents/adapters.ts";
import { planPortfolioStagePath, simulateDynamicSprint } from "../agents/stage-path-planner.ts";
import { summarizeLearningQuality, type LearningQualityMonitor } from "../agents/learning-quality.ts";
import {
  buildPortfolioNextStagePlan,
  isPortfolioNextStageAdjustment,
  summarizePortfolioArtifactIteration,
  type NextStagePlan,
  type PortfolioArtifactIteration,
} from "../agents/next-stage-planner.ts";
import { TrellisCoreKernel } from "../architecture/kernel.ts";
import type { LearningMemorySnapshot } from "../architecture/learning-memory.ts";

// ── 稳定 ID（与 V0.1 learning-server 同算法，前缀区分）────────
function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

// 学习内容包标识（learning_diagnostics.content_pack_id；内容包本身无 id 字段）
const LEARNING_PACK_ID = "trellis-learning-pack-v0.2";

type AdjustmentAction = AdjustmentSuggestion["actions"][number];

function parseAdjustmentActions(actionJson: string): AdjustmentAction[] {
  try {
    const parsed = JSON.parse(actionJson || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AdjustmentAction =>
      item &&
      typeof item === "object" &&
      typeof item.action === "string",
    );
  } catch {
    return [];
  }
}

function parseAdjustmentGapSignals(reason: string): Pick<AdjustmentRecord, "missingSignals" | "partialSignals"> {
  return {
    missingSignals: parseSignalSegment(reason, "缺少能力信号："),
    partialSignals: parseSignalSegment(reason, "部分信号需补强："),
  };
}

function isPortfolioArtifactActivity(activity: LearningActivity): boolean {
  return activity.activityType === "integrated_task"
    && /作品任务|AI Agent 产品 PRD|案例拆解报告|portfolio/i.test(
      `${activity.title} ${activity.goal} ${activity.expectedEvidence}`,
    );
}

function parseSignalSegment(reason: string, marker: string): string[] {
  const segment = reason.split(marker)[1]?.split(/[。；;]/)[0];
  if (!segment) return [];
  return segment.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
}

// ── 诊断快照 JSON 解析（Full Chain Phase 3；容错，解析失败回默认值）──
function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonNumberRecord(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function parseAnswersJson(value: string): {
  plannerMode: PlannerMode;
  preference: "breadth_first" | "build_first";
} {
  try {
    const parsed = JSON.parse(value || "{}") as Partial<{ plannerMode: unknown; preference: unknown }>;
    const plannerMode: PlannerMode =
      parsed.plannerMode === "adaptive_preview" || parsed.plannerMode === "adaptive_existing_content"
        ? parsed.plannerMode
        : "legacy";
    const preference = parsed.preference === "build_first" ? "build_first" : "breadth_first";
    return { plannerMode, preference };
  } catch {
    return { plannerMode: "legacy", preference: "breadth_first" };
  }
}

// 最近一条历史失败证据（非本次、needs_revision、reviewJson 可解析）的缺失信号。
// 无时间字段时以 listEvidenceByNode 返回顺序末尾为最近；解析失败返回 []，不抛错。
function lastMissingSignalsFrom(history: Evidence[], currentEvidenceId: string): string[] {
  const prev = history
    .filter((e) => e.id !== currentEvidenceId && e.status === "needs_revision")
    .at(-1);
  if (!prev) return [];
  try {
    const parsed = JSON.parse(prev.reviewJson) as Partial<EvidenceAssessment>;
    if (!Array.isArray(parsed.signalReviews)) return [];
    return parsed.signalReviews
      .filter((s) => s.status === "missing")
      .map((s) => s.label);
  } catch {
    return [];
  }
}

// ── 当前周键（ISO 周）───────────────────────────────────
export function currentWeekKey(now = new Date()): string {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function nextWeekKey(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return currentWeekKey(new Date(Date.now() + 7 * 86400000));
  const year = Number(match[1]);
  const week = Number(match[2]);
  return week >= 52 ? `${year + 1}-W01` : `${year}-W${String(week + 1).padStart(2, "0")}`;
}

function normalizeWeekKey(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-W\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseWeekReviewJson(value: string, fallback: WeekReviewRecord): WeekReview {
  try {
    const parsed = JSON.parse(value || "{}") as Partial<WeekReview>;
    if (parsed.weekKey && parsed.summary && parsed.nextBestMove && parsed.nextWeekProposal) {
      return {
        weekKey: parsed.weekKey,
        completedCount: parsed.completedCount ?? fallback.completedCount,
        acceptedEvidenceCount: parsed.acceptedEvidenceCount ?? fallback.acceptedEvidenceCount,
        openActivityCount: parsed.openActivityCount ?? fallback.openActivityCount,
        revisionCount: parsed.revisionCount ?? fallback.revisionCount,
        materialMismatchCount: parsed.materialMismatchCount ?? 0,
        capacityMinutes: parsed.capacityMinutes ?? 0,
        plannedMinutes: parsed.plannedMinutes ?? 0,
        completionRate: parsed.completionRate ?? 0,
        summary: parsed.summary,
        nextBestMove: parsed.nextBestMove,
        nextWeekProposal: parsed.nextWeekProposal,
        archivedAt: fallback.updatedAt,
        generatedNextWeek: parsed.generatedNextWeek ?? false,
      };
    }
  } catch {
    // fall through to record fields
  }
  return {
    weekKey: fallback.weekKey,
    completedCount: fallback.completedCount,
    acceptedEvidenceCount: fallback.acceptedEvidenceCount,
    openActivityCount: fallback.openActivityCount,
    revisionCount: fallback.revisionCount,
    materialMismatchCount: 0,
    capacityMinutes: 0,
    plannedMinutes: 0,
    completionRate: 0,
    summary: fallback.summary,
    nextBestMove: fallback.nextBestMove,
    nextWeekProposal: {
      title: `生成 ${nextWeekKey(fallback.weekKey)} 计划`,
      summary: "基于已归档复盘继续推进。",
      actionCount: 1,
      canGenerate: true,
    },
    archivedAt: fallback.updatedAt,
    generatedNextWeek: false,
  };
}

function nodeFor(id: string): LearningNode | undefined {
  return learningContentPack.nodes.find((node) => node.id === id);
}

function conceptHintsForNode(nodeId: string): ConceptHint[] {
  const node = nodeFor(nodeId);
  if (!node) return [];
  return [
    {
      id: stableId("concept", `${node.id}:title`),
      label: node.title,
      plainText: node.description || `先用这个概念完成当前判断，不需要一次学完全部术语。`,
    },
    ...node.signals.slice(0, 1).map((signal) => ({
      id: stableId("concept", `${node.id}:${signal}`),
      label: signal,
      plainText: `这是判断「${node.title}」是否真的理解的一条表现信号：能在当前行动中用出来即可。`,
    })),
  ].slice(0, 2);
}

function normalizeActionMinutes(minutes: number): number {
  return Math.max(30, Math.round(minutes / 15) * 15);
}

function actionTypeOf(activity: LearningActivity): WeeklyActionCard["actionType"] {
  if (activity.activityType === "build_model" || activity.activityType === "follow_demo") return "看这一段";
  if (activity.activityType === "quiz") return "做一个判断";
  if (activity.activityType === "reflection") return "整理一个材料取舍";
  if (activity.activityType === "integrated_task") return "填一个小框架";
  if (activity.activityType === "retest") return "做一个判断";
  return "拆一个案例";
}

function feedbackModeOf(activity: LearningActivity): ActionFeedbackMode {
  if (activity.activityType === "reflection") return "light_status";
  if (activity.activityType === "integrated_task") return "small_template";
  return "scenario_judgment";
}

function actionCardTitleOf(activity: LearningActivity): string {
  const nodeTitle = nodeFor(activity.nodeId)?.title ?? activity.title.replace(/^[^：]+：/, "");
  if (activity.activityType === "build_model") return `先搞懂：${nodeTitle}`;
  if (activity.activityType === "follow_demo") return `看例子：${nodeTitle}`;
  if (activity.activityType === "independent_practice") return `做一版：${nodeTitle}`;
  if (activity.activityType === "quiz") return `判断题：${nodeTitle}`;
  if (activity.activityType === "reflection") return `收个口：${nodeTitle}`;
  if (activity.activityType === "integrated_task") return `小框架：${nodeTitle}`;
  if (activity.activityType === "retest") return `复测：${nodeTitle}`;
  return activity.title;
}

// ── 领域错误 ───────────────────────────────────────────
export class LearningError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── Workspace 读模型 ──────────────────────────────────
export interface Workspace {
  profile: LearnerProfile | null;
  route: {
    id: string;
    title: string;
    version: string;
    description: string;
  } | null;
  adjacentBranches: Array<{ id: string; name: string; description: string }>;
  // 当前路线的边（前置关系），成长页树状图使用
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType: "prerequisite" | "supports" | "related";
  }>;
  weeklyPlan: WeeklyPlan | null;
  weekReview: WeekReview | null;
  weeklyPlanHistory: WeeklyPlanSummary[];
  contentJudgment: ContentJudgment[];
  courseSlices: CourseSlice[];
  weeklyActionPlan: WeeklyActionCard[];
  nextAction: WeeklyActionCard | null;
  conceptHints: ConceptHint[];
  learningOutputs: LearningOutput[];
  activities: LearningActivity[];
  // 节点进度带中文标题（内容包为唯一真相，前端不再维护标题映射）
  nodeProgress: Array<NodeProgress & { title: string }>;
  evidence: Evidence[];
  adjustments: AdjustmentRecord[];
  nextStagePlan: NextStagePlan | null;
  artifactIteration: PortfolioArtifactIteration;
  // 工作台：资源/工具与节点的映射
  userResources: UserResource[];
  // 到期复测节点（延迟复测提醒）
  dueReviews: Array<{ nodeId: string; title: string; daysSinceValidated: number; nextReviewAt: string | null }>;
  // 工作台：资源/工具与节点的映射
  workbench: {
    resources: Array<{
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
    }>;
    tools: Array<{
      toolId: string;
      name: string;
      url: string;
      description: string;
      nodeId: string;
      usage: string;
      activityContext: string;
    }>;
  };
  // Full Chain Phase 2：前半段智能链路瞬态产物（不落库）。
  // 仅在 runDiagnostic 响应上附带；getWorkspace 与其他端点返回 null。
  analysis: LearningAnalysis | null;
}

export type ContentJudgmentRole = "本周主线" | "只作参考" | "后续再用" | "暂不碰";
export type ActionTier = "主推进" | "补充推进" | "低精力备选" | "暂不碰";
export type ActionFeedbackMode = "light_status" | "scenario_judgment" | "small_template";

export interface ConceptHint {
  id: string;
  label: string;
  plainText: string;
}

export interface ContentJudgment {
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
  conceptsIntroduced: ConceptHint[];
  entersCurrentWeek: boolean;
  rawContent?: string;
}

export interface CourseSlice {
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

export interface ScenarioQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string; text: string }>;
  preferredOptionId: string;
  diagnosisByOption: Record<string, string>;
  nextActionByOption: Record<string, string>;
}

export interface WeeklyActionCard {
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
  conceptHints: ConceptHint[];
  feedbackMode: ActionFeedbackMode;
  scenarioQuestion: ScenarioQuestion | null;
  nextIfClear: string;
  nextIfStuck: string;
}

export interface LearningOutput {
  id: string;
  kind: "判断记录" | "学习产出" | "作品片段" | "进展记录";
  title: string;
  sourceActionId: string | null;
  weekKey: string;
  summary: string;
}

export interface WeekReview {
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

export interface WeeklyPlanSummary {
  weekKey: string;
  status: WeeklyPlan["status"];
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

export class LearningApplicationService {
  private store: LearningStore;
  private agents: AgentRegistry;
  private kernel: TrellisCoreKernel;

  constructor(store: LearningStore, agents: AgentRegistry) {
    this.store = store;
    this.agents = agents;
    this.kernel = new TrellisCoreKernel(agents);
  }

  // ── GET /api/learning/workspace ─────────────────────
  async getWorkspace(ownerId: string, input: { weekKey?: string } = {}): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) {
      return {
        profile: null,
        route: null,
        adjacentBranches: [],
        edges: [],
        weeklyPlan: null,
        weekReview: null,
        weeklyPlanHistory: [],
        contentJudgment: [],
        courseSlices: [],
        weeklyActionPlan: [],
        nextAction: null,
        conceptHints: [],
        learningOutputs: [],
        activities: [],
        nodeProgress: [],
        evidence: [],
        adjustments: [],
        nextStagePlan: null,
        artifactIteration: summarizePortfolioArtifactIteration({
          activities: [],
          evidence: [],
          adjustments: [],
          nextStagePlan: null,
        }),
        userResources: [],
        dueReviews: [],
        workbench: { resources: [], tools: [] },
        analysis: null,
      };
    }

    const route = learningContentPack.routes.find((r) => r.id === profile.activeRouteId) ?? null;
    const adjacentBranches = route
      ? findAdjacentBranches(route.id as never).map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
        }))
      : [];

    const selectedWeekKey = normalizeWeekKey(input.weekKey) ?? currentWeekKey();
    const weeklyPlan = await this.store.getWeeklyPlanByWeek(
      ownerId,
      profile.activeRouteId,
      selectedWeekKey,
    );
    const activities = weeklyPlan
      ? await this.store.listActivitiesByPlan(weeklyPlan.id)
      : [];
    const nodeProgress = (await this.store.listNodeProgress(ownerId)).map((p) => ({
      ...p,
      // 中文标题来自内容包（单一真相），不落库
      title: learningContentPack.nodes.find((n) => n.id === p.nodeId)?.title ?? p.nodeId,
    }));
    const evidence: Evidence[] = [];
    for (const activity of activities) {
      evidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
    }
    const adjustments = (await this.store.listAdjustments(ownerId)).map((adjustment) => ({
      ...adjustment,
      ...parseAdjustmentGapSignals(adjustment.reason),
    }));
    const nextStagePlan = adjustments
      .map((adjustment) => buildPortfolioNextStagePlan(adjustment))
      .find((plan): plan is NextStagePlan => Boolean(plan)) ?? null;
    const artifactIteration = summarizePortfolioArtifactIteration({
      activities,
      evidence,
      adjustments,
      nextStagePlan,
    });
    const archivedReview = weeklyPlan
      ? await this.store.getWeekReview(ownerId, profile.activeRouteId, weeklyPlan.weekKey)
      : null;
    const weekReview = weeklyPlan
      ? this.buildWeekReview(weeklyPlan, activities, evidence, adjustments, archivedReview)
      : null;
    const userResources = await this.store.listUserResources(ownerId);
    const weeklyPlanHistory = await this.buildWeeklyPlanHistory(ownerId, profile.activeRouteId);
    // 到期复测：validated 节点且 nextReviewAt 已过（或 lastValidatedAt + 间隔已过）
    const now = Date.now();
    const dueReviews = nodeProgress
      .filter((p) => p.status === "validated")
      .map((p) => {
        const node = learningContentPack.nodes.find((n) => n.id === p.nodeId);
        const dueAt = p.nextReviewAt
          ? new Date(p.nextReviewAt).getTime()
          : p.lastValidatedAt
            ? new Date(p.lastValidatedAt).getTime() + p.reviewIntervalDays * 86400000
            : Infinity;
        return {
          nodeId: p.nodeId,
          title: node?.title ?? p.nodeId,
          daysSinceValidated: p.lastValidatedAt
            ? Math.floor((now - new Date(p.lastValidatedAt).getTime()) / 86400000)
            : 0,
          nextReviewAt: p.nextReviewAt,
          dueAt,
        };
      })
      .filter((d) => d.dueAt <= now)
      .map(({ dueAt: _dueAt, ...rest }) => rest);

    // 工作台映射
    const resources = learningContentPack.resourceMappings
      .filter((m) => route && learningContentPack.nodes.some((n) => n.id === m.nodeId && n.routeId === route.id))
      .map((m) => {
        const resource = learningContentPack.resources.find((r) => r.id === m.resourceId)!;
        return {
          resourceId: resource.id,
          title: resource.title,
          url: resource.url,
          sourceType: resource.sourceType,
          credibilityLevel: resource.credibilityLevel,
          summary: resource.summary,
          nodeId: m.nodeId,
          usage: m.usage,
          segmentFocus: m.segmentFocus,
          qualityRationale: m.qualityRationale,
          skipGuidance: m.skipGuidance,
          learnerAction: m.learnerAction,
        };
      });
    const tools = learningContentPack.toolMappings
      .filter((m) => route && learningContentPack.nodes.some((n) => n.id === m.nodeId && n.routeId === route.id))
      .map((m) => {
        const tool = learningContentPack.tools.find((t) => t.id === m.toolId)!;
        return {
          toolId: tool.id,
          name: tool.name,
          url: tool.url,
          description: tool.description,
          nodeId: m.nodeId,
          usage: m.usage,
          activityContext: m.activityContext,
        };
      });

    // 当前路线的边（前置/支持/相关），成长页树状图使用
    const routeNodeIds = new Set(
      learningContentPack.nodes.filter((n) => n.routeId === route?.id).map((n) => n.id),
    );
    const edges = learningContentPack.edges
      .filter((e) => routeNodeIds.has(e.sourceNodeId) && routeNodeIds.has(e.targetNodeId))
      .map((e) => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        relationType: e.relationType,
      }));
    const snapshot = await this.store.getDiagnostic(ownerId);
    const materialReviews = snapshot
      ? this.buildAnalysis({
          goal: snapshot.goal,
          weeklyMinutes: snapshot.weeklyMinutes,
          materialIds: parseJsonStringArray(snapshot.materialsJson),
          selfReport: parseJsonNumberRecord(snapshot.selfReportJson),
          preference: parseAnswersJson(snapshot.answersJson).preference,
          plannerMode: parseAnswersJson(snapshot.answersJson).plannerMode,
        }).materialReviews
      : [];
    const contentJudgment = this.buildContentJudgment({
      routeId: route?.id ?? "",
      activities,
      resources,
      userResources,
      materialReviews,
    });
    const courseSlices = this.buildCourseSlices({
      activities,
      contentJudgment,
    });
    const weeklyActionPlan = weeklyPlan
      ? this.buildWeeklyActionPlan({
          weeklyPlan,
          activities,
          contentJudgment,
          courseSlices,
          evidence,
        })
      : [];
    const nextAction = this.pickNextAction(weeklyActionPlan, activities, evidence);
    const conceptHints = this.collectConceptHints(weeklyActionPlan, contentJudgment);
    const learningOutputs = weeklyPlan
      ? this.buildLearningOutputs(weeklyPlan, activities, evidence)
      : [];

    return {
      profile,
      route,
      adjacentBranches,
      edges,
      weeklyPlan,
      weekReview,
      weeklyPlanHistory,
      contentJudgment,
      courseSlices,
      weeklyActionPlan,
      nextAction,
      conceptHints,
      learningOutputs,
      activities,
      nodeProgress,
      evidence,
      adjustments,
      nextStagePlan,
      artifactIteration,
      userResources,
      dueReviews,
      workbench: { resources, tools },
      // Full Chain Phase 2：analysis 仅在 runDiagnostic 响应上附带（见 buildAnalysis）
      analysis: null,
    };
  }

  private async getWorkspaceForPlan(ownerId: string, weeklyPlanId: string | null): Promise<Workspace> {
    if (!weeklyPlanId) return this.getWorkspace(ownerId);
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return this.getWorkspace(ownerId);
    const plans = await this.store.listWeeklyPlans(ownerId, profile.activeRouteId);
    const plan = plans.find((item) => item.id === weeklyPlanId);
    return this.getWorkspace(ownerId, plan ? { weekKey: plan.weekKey } : {});
  }

  // ── POST /api/learning/diagnostic ───────────────────
  async runDiagnostic(input: {
    ownerId: string;
    goal: string;
    weeklyMinutes: number;
    materialIds?: string[];
    selfReport?: Record<string, number>;
    preference?: "breadth_first" | "build_first";
    // Full Chain Phase 3：受控 adaptive 激活（默认 legacy，不改变既有行为）
    plannerMode?: PlannerMode;
  }): Promise<Workspace> {
    const plannerMode = input.plannerMode ?? "legacy";
    const proposal = this.agents.planner.planLearningRoute({
      goal: input.goal,
      weeklyMinutes: input.weeklyMinutes,
      materialIds: input.materialIds ?? [],
      selfReport: input.selfReport ?? {},
      preference: input.preference ?? "breadth_first",
    });

    const profile: LearnerProfile = {
      id: stableId("profile", input.ownerId),
      ownerId: input.ownerId,
      goal: input.goal,
      activeRouteId: proposal.routeId,
      weeklyMinutes: input.weeklyMinutes,
      status: "proposed",
    };
    await this.store.saveProfile(profile);

    // 初始化节点进度：路线节点全部 unstarted（自评 >=2 的置 growing）
    for (const node of learningContentPack.nodes.filter((n) => n.routeId === proposal.routeId)) {
      const self = input.selfReport?.[node.id] ?? 0;
      const status: NodeStatus = self >= 2 ? "growing" : "unstarted";
      const existing = await this.store.getNodeProgress(input.ownerId, node.id);
      if (!existing) {
        await this.store.saveNodeProgress({
          id: stableId("nprogress", `${input.ownerId}:${node.id}`),
          ownerId: input.ownerId,
          nodeId: node.id,
          status,
          confidence: self,
          lastValidatedAt: null,
          supportingEvidenceIds: [],
          confirmedAt: null,
          reviewIntervalDays: 14,
          nextReviewAt: null,
          reviewCount: 0,
        });
      }
    }

    // Full Chain Phase 3：持久化诊断输入快照（learning_diagnostics，无 schema 变更）。
    // 保存 goal/weeklyMinutes/selfReport/materials/preference/plannerMode，使
    // confirmProposal 能按诊断时的模式与输入重建 analysis / adaptivePlan。
    await this.store.saveDiagnostic({
      id: stableId("diagnostic", `${input.ownerId}:${LEARNING_PACK_ID}:${learningContentPack.version}`),
      ownerId: input.ownerId,
      contentPackId: LEARNING_PACK_ID,
      contentPackVersion: learningContentPack.version,
      goal: input.goal,
      weeklyMinutes: input.weeklyMinutes,
      selfReportJson: JSON.stringify(input.selfReport ?? {}),
      materialsJson: JSON.stringify(input.materialIds ?? []),
      answersJson: JSON.stringify({ plannerMode, preference: input.preference ?? "breadth_first" }),
      status: "submitted",
    });

    // Full Chain Phase 2：前半段智能链路（goalAnalyzer → courseAnalyzer →
    // capabilityMapper → adaptiveRoutePlanner）产物作为 transient analysis 返回。
    // 不落库、不改变默认流程：profile.activeRouteId 仍为 legacy route，
    // confirmProposal / replanCurrentWeek 不读取本产物（legacy 行为不变）。
    const analysis = this.buildAnalysis({
      goal: input.goal,
      weeklyMinutes: input.weeklyMinutes,
      materialIds: input.materialIds ?? [],
      selfReport: input.selfReport ?? {},
      preference: input.preference ?? "breadth_first",
      plannerMode,
    });
    analysis.decisionTrace = this.kernel.traceDiagnostic(input.ownerId, analysis);
    const workspace = await this.getWorkspace(input.ownerId);
    workspace.analysis = analysis;
    return workspace;
  }

  // ── POST /api/learning/proposal/confirm ─────────────
  // Full Chain Phase 3：受控 adaptive 激活。默认 legacy（行为与既有实现一致）；
  // 仅当诊断快照请求 adaptive_existing_content 且重建分析命中 existing_content
  // 时，才用 adaptivePlan 驱动本周计划；否则回退 legacy 并在 rationale 标记。
  async confirmProposal(ownerId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status === "confirmed") throw new LearningError("路线已确认，无需重复确认", 400);

    profile.status = "confirmed";
    await this.store.saveProfile(profile);

    const weekKey = currentWeekKey();
    const snapshot = await this.store.getDiagnostic(ownerId);
    const requestedMode = snapshot ? parseAnswersJson(snapshot.answersJson).plannerMode : "legacy";

    if (requestedMode === "adaptive_existing_content") {
      const answers = parseAnswersJson(snapshot!.answersJson);
      const analysis = this.buildAnalysis({
        goal: snapshot!.goal || profile.goal,
        weeklyMinutes: snapshot!.weeklyMinutes ?? profile.weeklyMinutes,
        materialIds: parseJsonStringArray(snapshot!.materialsJson),
        selfReport: parseJsonNumberRecord(snapshot!.selfReportJson),
        preference: answers.preference,
        plannerMode: "adaptive_existing_content",
      });
      const items = analysis.adaptivePlan.weeklyPlan.activities;
      const canDriveAdaptive =
        analysis.capabilityMap.strategy === "existing_content"
        && items.length > 0
        && analysis.adaptivePlan.activities.length === items.length;
      if (canDriveAdaptive) {
        const weeklyPlan: WeeklyPlan = {
          id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
          ownerId,
          routeId: profile.activeRouteId,
          weekKey,
          capacityMinutes: profile.weeklyMinutes,
          status: "confirmed",
          rationale: analysis.adaptivePlan.weeklyPlan.rationale,
        };
        await this.store.saveWeeklyPlan(weeklyPlan);
        await this.createAdaptiveActivities(ownerId, weeklyPlan, analysis.adaptivePlan);
        return this.getWorkspace(ownerId);
      }
      // adaptive 不可用（generic fallback / 空计划）：回退 legacy 并标记，不崩
      await this.confirmLegacyWeeklyPlan(
        ownerId,
        profile,
        weekKey,
        "adaptive 计划不可用（目标未命中内容包或计划为空），已回退 legacy 编排。",
      );
      return this.getWorkspace(ownerId);
    }

    // legacy 默认路径（行为与既有实现完全一致）
    await this.confirmLegacyWeeklyPlan(ownerId, profile, weekKey);
    return this.getWorkspace(ownerId);
  }

  // legacy 首周计划（确定性，seed 42；从 confirmProposal 抽出，行为不变）
  private async confirmLegacyWeeklyPlan(
    ownerId: string,
    profile: LearnerProfile,
    weekKey: string,
    fallbackNote?: string,
  ): Promise<void> {
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) {
      nodeStatusById[p.nodeId] = p.status;
    }
    const planDraft = this.agents.planner.composeWeeklyPlan({
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: profile.weeklyMinutes,
      nodeStatusById,
      prerequisiteSatisfied: (nodeId) =>
        prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack),
      seed: 42,
    });

    const weeklyPlan: WeeklyPlan = {
      id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: profile.weeklyMinutes,
      status: "confirmed",
      rationale: fallbackNote ? `${planDraft.rationale} ${fallbackNote}` : planDraft.rationale,
    };
    await this.store.saveWeeklyPlan(weeklyPlan);

    await this.createActivitiesFromPlanDraft(ownerId, weeklyPlan, planDraft.activities, 0);
  }

  // ── POST /api/learning/replan ──────────────────────
  // 温和重排：保留节点进度、证据和已产生证据的活动，只清理本周未产生证据的开放活动。
  async replanCurrentWeek(ownerId: string, input: { weeklyMinutes?: number } = {}): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能重排本周", 400);

    const nextWeeklyMinutes = input.weeklyMinutes
      ? Math.min(1200, Math.max(30, Math.round(input.weeklyMinutes / 15) * 15))
      : profile.weeklyMinutes;
    profile.weeklyMinutes = nextWeeklyMinutes;
    await this.store.saveProfile(profile);

    const weekKey = currentWeekKey();
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) {
      nodeStatusById[p.nodeId] = p.status;
    }
    const planDraft = this.agents.planner.composeWeeklyPlan({
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: nextWeeklyMinutes,
      nodeStatusById,
      prerequisiteSatisfied: (nodeId) =>
        prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack),
      seed: Date.now(),
    });

    const weeklyPlan: WeeklyPlan = {
      id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: nextWeeklyMinutes,
      status: "confirmed",
      rationale: `${planDraft.rationale} 本周已按用户请求重新编排；已提交证据与已完成记录保留。`,
    };
    await this.store.saveWeeklyPlan(weeklyPlan);

    await this.store.clearOpenActivitiesForPlan(ownerId, weeklyPlan.id);
    const existing = await this.store.listActivitiesByPlan(weeklyPlan.id);
    const nextSequence = existing.length
      ? Math.max(...existing.map((activity) => activity.sequence)) + 1
      : 0;
    await this.createActivitiesFromPlanDraft(ownerId, weeklyPlan, planDraft.activities, nextSequence);

    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${weeklyPlan.id}:replan:${Date.now()}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: weeklyPlan.id,
      adjustmentType: "activity_replan",
      reason: "用户主动重排本周计划",
      status: "accepted",
      summary: `本周计划已重排为 ${planDraft.coreActivityCount} 个核心活动、${planDraft.optionalActivityCount} 个可选活动；保留已产生证据的学习记录。`,
      actionJson: "[]",
    };
    await this.store.saveAdjustment(adjustment);

    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/activities/:id/start ─────────
  async startActivity(ownerId: string, activityId: string): Promise<Workspace> {
    const activity = await this.getOwnedActivity(ownerId, activityId);
    const next = transitionActivity(activity.status, { type: "start" });
    activity.status = next;
    await this.store.saveActivity(activity);
    // 节点进入成长中（已验证节点开始复测活动不降级，保持 validated）
    const progress = await this.getOrCreateNodeProgress(ownerId, activity.nodeId);
    if (progress.status !== "validated") {
      progress.status = transitionNode(progress.status, { type: "beginLearning" });
      await this.store.saveNodeProgress(progress);
    }
    return this.getWorkspaceForPlan(ownerId, activity.weeklyPlanId);
  }

  // ── POST /api/learning/activities/:id/evidence ──────
  async submitEvidence(
    ownerId: string,
    activityId: string,
    input: { content: string; externalUrl?: string; evidenceType?: Evidence["evidenceType"] },
  ): Promise<Workspace> {
    const activity = await this.getOwnedActivity(ownerId, activityId);
    if (!input.content.trim()) throw new LearningError("证据内容不能为空", 400);

    // 创建证据（draft → submitted）
    const evidence: Evidence = {
      id: stableId("evidence", `${activityId}:${input.content.length}:${Date.now()}`),
      ownerId,
      activityId,
      nodeId: activity.nodeId,
      evidenceType: input.evidenceType ?? "explanation",
      content: input.content,
      externalUrl: input.externalUrl ?? "",
      status: transitionEvidence("draft", { type: "submit" }),
      feedback: "",
      extractedJson: "{}",
      reviewJson: "{}",
    };
    await this.store.saveEvidence(evidence);

    // 活动进入 evidence_submitted
    const next = transitionActivity(activity.status, { type: "submitEvidence" });
    activity.status = next;
    await this.store.saveActivity(activity);

    return this.getWorkspaceForPlan(ownerId, activity.weeklyPlanId);
  }

  // ── POST /api/learning/evidence/:id/review ──────────
  async reviewEvidence(ownerId: string, evidenceId: string): Promise<{
    workspace: Workspace;
    assessment: EvidenceAssessment;
  }> {
    const evidence = await this.store.getEvidence(evidenceId);
    if (!evidence || evidence.ownerId !== ownerId) {
      throw new LearningError("证据不存在", 404);
    }
    if (evidence.status !== "submitted") {
      throw new LearningError(`证据状态 ${evidence.status} 不允许评估`, 400);
    }
    const activity = await this.store.getActivity(evidence.activityId);
    if (!activity) throw new LearningError("活动不存在", 404);
    const node = learningContentPack.nodes.find((n) => n.id === evidence.nodeId);
    if (!node) throw new LearningError("节点不存在", 404);

    // 旧 evidence 链只保留规则降级；模型增强统一由 Course Intelligence 服务端网关承担。
    const llm = undefined;
    const assessment = await this.agents.evidenceEvaluator.evaluateEvidence({
      evidenceId,
      nodeId: evidence.nodeId,
      nodeTitle: node.title,
      targetLevel: node.targetLevel,
      evidenceType: evidence.evidenceType,
      content: evidence.content,
      externalUrl: evidence.externalUrl,
      criteria: activity.evaluationCriteria,
      capabilitySignals: node.signals,
      isSkipValidation: activity.isSkipValidation,
    }, llm);

    // 证据状态迁移
    if (assessment.verdict === "accepted") {
      evidence.status = transitionEvidence(evidence.status, { type: "accept" });
      activity.status = transitionActivity(activity.status, { type: "reviewAccepted" });
    } else {
      evidence.status = transitionEvidence(evidence.status, { type: "requestRevision" });
      activity.status = transitionActivity(activity.status, { type: "reviewNeedsRevision" });
      // 复测失败：节点降级回 growing + 熟练等级 -1（能力被证明不足）
      if (activity.activityType === "retest") {
        const progress = await this.getOrCreateNodeProgress(ownerId, evidence.nodeId);
        progress.status = transitionNode(progress.status, { type: "evidenceInvalidated" });
        progress.confidence = Math.max(0, progress.confidence - 1);
        progress.reviewCount += 1;
        await this.store.saveNodeProgress(progress);
      }
    }
    evidence.feedback = assessment.rationale || assessment.reasons.join("；") || assessment.missing.join("；");
    evidence.extractedJson = JSON.stringify(assessment.evidenceCard);
    evidence.reviewJson = JSON.stringify(assessment);
    await this.store.saveEvidence(evidence);
    await this.store.saveActivity(activity);

    // 节点状态：证据 accepted 后驱动节点迁移
    // 综合任务/复测驱动的首次验证需用户确认（pending_confirmation）；
    // 复测通过（节点已 validated）不重复确认，直接顺延下次复测
    const progress = await this.getOrCreateNodeProgress(ownerId, evidence.nodeId);
    // 综合任务 = 最终裁决，永远需用户确认（即便节点已 validated 再次验证）；
    // 复测 = 复核机制，仅首次验证需确认（通过后直接顺延）
    const requiresConfirmation =
      activity.activityType === "integrated_task" ||
      (activity.activityType === "retest" && progress.status !== "validated");
    if (assessment.verdict === "accepted") {
      const nodeEvent = nodeEventOfEvidence(evidence.status, { requiresConfirmation });
      // 需确认的活动（综合任务）无条件迁移（含 validated → pending 再确认）；
      // 免确认活动在 validated 节点上跳过迁移（复测通过保持状态只顺延）
      if (nodeEvent && (requiresConfirmation || progress.status !== "validated")) {
        progress.status = transitionNode(progress.status, nodeEvent);
        progress.confidence = Math.max(progress.confidence, assessment.suggestedLevel);
        progress.lastValidatedAt =
          progress.status === "validated" ? new Date().toISOString() : progress.lastValidatedAt;
        progress.supportingEvidenceIds = [
          ...new Set([...progress.supportingEvidenceIds, evidenceId]),
        ];
      }
      // 复测通过：顺延下次复测（间隔翻倍，上限 56 天）
      if (activity.activityType === "retest" && progress.status === "validated") {
        progress.reviewCount += 1;
        const interval = Math.min(progress.reviewIntervalDays * 2, 56);
        progress.reviewIntervalDays = interval;
        progress.nextReviewAt = new Date(Date.now() + interval * 86400000).toISOString();
      }
      // 掌握确认时间由 confirm-mastery 接口写入（reviewEvidence 只迁移状态）
      // 活动完成（评估通过后）
      if (activity.status === "reviewed") {
        activity.status = transitionActivity(activity.status, { type: "complete" });
        activity.nextAdvice = "证据已接受，进入下一步。";
        await this.store.saveActivity(activity);
      }
    }
    await this.store.saveNodeProgress(progress);

    // 调整建议（evidenceEvaluator 结论 → adjustmentAdvisor）
    const completionRate = await this.computeCompletionRate(ownerId);
    const skipped = await this.listSkippedNodeIds(ownerId);
    const prerequisiteGaps = assessment.nextAction === "insert_prerequisite"
      ? getPrerequisiteNodeIds(evidence.nodeId, learningContentPack)
      : [];
    const routeId = (await this.store.getProfile(ownerId))?.activeRouteId ?? "";
    // v0.3-beta：历史失败上下文推导
    // 评审结果已落库（本次 needs_revision 计入 failureCount）；无时间字段时
    // 以 listEvidenceByNode 返回顺序末尾为最近一条历史失败证据。
    const nodeEvidenceHistory = await this.store.listEvidenceByNode(evidence.nodeId);
    const adjustmentInput = {
      nodeId: evidence.nodeId,
      nodeTitle: node.title,
      evidenceVerdict: assessment.verdict,
      activityStatus: activity.status,
      completionRate,
      skippedNodeIds: skipped,
      prerequisiteGaps,
      routeId,
      // Evidence Review → Adjustment 缺口回流：建议文案能指出具体缺失的能力信号
      missingSignals: assessment.signalReviews
        .filter((signal) => signal.status === "missing")
        .map((signal) => signal.label),
      partialSignals: assessment.signalReviews
        .filter((signal) => signal.status === "partial")
        .map((signal) => signal.label),
      reviewRationale: assessment.rationale,
      evidenceNextAction: assessment.nextAction,
      // beta：同一节点历史失败次数（含本次），仅在 needs_revision 场景被 advisor 消费
      failureCount: nodeEvidenceHistory.filter((e) => e.status === "needs_revision").length,
      isRetestFailure: activity.activityType === "retest" && assessment.verdict === "needs_revision",
      lastMissingSignals: lastMissingSignalsFrom(nodeEvidenceHistory, evidence.id),
    };
    const suggestion = this.agents.adjustmentAdvisor.suggestAdjustment(adjustmentInput);
    if (suggestion.severity !== "low") {
      // 保守 supersede：只取代 actionJson targetNodeId === 当前节点 的旧 proposed。
      // 前置缺口建议 target 为前置节点、weekly_light 无 target，均不在本策略内（避免误伤）。
      const proposals = await this.store.listAdjustments(ownerId);
      for (const old of proposals) {
        if (
          old.status === "proposed"
          && old.routeId === routeId
          && parseAdjustmentActions(old.actionJson)
            .some((x) => x.action === "insert_activity" && x.targetNodeId === evidence.nodeId)
        ) {
          old.status = "superseded";
          await this.store.saveAdjustment(old);
        }
      }
      const adjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${evidenceId}:${suggestion.adjustmentType}`),
        ownerId,
        routeId,
        weeklyPlanId: activity.weeklyPlanId,
        adjustmentType: suggestion.adjustmentType,
        reason: suggestion.reason,
        status: "proposed",
        summary: suggestion.summary,
        actionJson: JSON.stringify(suggestion.actions),
      };
      await this.store.saveAdjustment(adjustment);
    }

    return { workspace: await this.getWorkspaceForPlan(ownerId, activity.weeklyPlanId), assessment };
  }

  // ── POST /api/learning/adjustments/:id/confirm ──────
  async confirmAdjustment(ownerId: string, adjustmentId: string): Promise<Workspace> {
    const adjustment = await this.store.getAdjustment(adjustmentId);
    if (!adjustment || adjustment.ownerId !== ownerId) {
      throw new LearningError("调整建议不存在", 404);
    }
    if (adjustment.status !== "proposed") {
      throw new LearningError(`调整建议状态 ${adjustment.status} 不允许确认`, 400);
    }
    adjustment.status = "accepted";
    if (isPortfolioNextStageAdjustment(adjustment)) {
      adjustment.summary = `${adjustment.summary}（已进入作品集包装阶段）`;
    }
    await this.store.saveAdjustment(adjustment);
    await this.executeAdjustmentActions(ownerId, adjustment);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/adjustments/:id/reject ───────
  async rejectAdjustment(ownerId: string, adjustmentId: string): Promise<Workspace> {
    const adjustment = await this.store.getAdjustment(adjustmentId);
    if (!adjustment || adjustment.ownerId !== ownerId) {
      throw new LearningError("调整建议不存在", 404);
    }
    if (adjustment.status !== "proposed") {
      throw new LearningError(`调整建议状态 ${adjustment.status} 不允许忽略`, 400);
    }
    adjustment.status = "rejected";
    await this.store.saveAdjustment(adjustment);
    return this.getWorkspace(ownerId);
  }

  // ── GET /api/learning/resources/inbox ─────────────────
  // 收集箱独立于学习状态（无 profile 也能读），不走 getWorkspace（profile null 会早退）。
  async listInboxResources(ownerId: string): Promise<UserResource[]> {
    return this.store.listUserResources(ownerId);
  }

  // ── POST /api/learning/nodes/:id/confirm-mastery ──────
  // 掌握确认：pending_confirmation 节点 → 确认(validated) / 纠正(growing + 降级 + 补强建议)
  async confirmMastery(
    ownerId: string,
    nodeId: string,
    input: { decision: "confirmed" | "corrected"; note?: string },
  ): Promise<Workspace> {
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);
    if (progress.status !== "pending_confirmation") {
      throw new LearningError(`节点状态 ${progress.status} 不需要掌握确认`, 400);
    }
    const node = learningContentPack.nodes.find((n) => n.id === nodeId);
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);

    if (input.decision === "confirmed") {
      progress.status = transitionNode(progress.status, { type: "confirmMastery" });
      progress.lastValidatedAt = new Date().toISOString();
      progress.confirmedAt = new Date().toISOString();
      const adjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:mastery-confirm:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "mastery_confirm",
        reason: "用户确认掌握",
        status: "accepted",
        summary: `用户确认掌握「${node?.title ?? nodeId}」，节点进入已验证。`,
        actionJson: "[]",
      };
      await this.store.saveAdjustment(adjustment);
      await this.proposeNextStageAfterPortfolioMastery(ownerId, profile, nodeId);
    } else {
      // 纠正：回 growing + 降级 + 补强建议
      progress.status = transitionNode(progress.status, { type: "correctMastery" });
      progress.confidence = Math.max(0, progress.confidence - 1);
      progress.confirmedAt = null;
      const note = input.note?.trim() || "未说明原因";
      const confirmAdjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:mastery-correct:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "mastery_confirm",
        reason: `用户纠正掌握判断：${note}`,
        status: "rejected",
        summary: `用户纠正「${node?.title ?? nodeId}」的掌握判断：${note}；熟练等级降 1，生成补强建议。`,
        actionJson: "[]",
      };
      await this.store.saveAdjustment(confirmAdjustment);
      const boost: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:boost:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "weekly_light",
        reason: "掌握确认被纠正，需要补强",
        status: "proposed",
        summary: `为「${node?.title ?? nodeId}」安排复习/补强活动，重新积累证据后再次验证。`,
        // 补强建议可执行：采纳后由 executeAdjustmentActions 插入 independent_practice 补强活动
        actionJson: JSON.stringify([
          {
            action: "insert_activity",
            targetNodeId: nodeId,
            description: `为「${node?.title ?? nodeId}」安排一次补强活动，重新积累证据。`,
          },
        ]),
      };
      await this.store.saveAdjustment(boost);
    }
    await this.store.saveNodeProgress(progress);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/nodes/:id/retest ──────────────
  // 延迟复测：为到期节点生成 retest 活动（走现有活动闭环）
  async retestNode(ownerId: string, nodeId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);
    if (progress.status !== "validated") {
      throw new LearningError(`节点状态 ${progress.status} 不是已验证，无需复测`, 400);
    }
    const node = learningContentPack.nodes.find((n) => n.id === nodeId);
    if (!node) throw new LearningError("节点不存在", 404);

    const weekKey = currentWeekKey();
    let plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, weekKey);
    if (!plan) {
      // 本周无计划则创建（retest 独立于周计划编排）
      plan = {
        id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
        ownerId,
        routeId: profile.activeRouteId,
        weekKey,
        capacityMinutes: profile.weeklyMinutes,
        status: "confirmed",
        rationale: "为延迟复测创建的本周计划。",
      };
      await this.store.saveWeeklyPlan(plan);
    }
    const draft: ActivityDraft = this.agents.activityComposer.composeActivity({
      nodeId,
      nodeTitle: node.title,
      nodeDescription: node.description,
      activityType: "retest",
      isSkipValidation: false,
      resourceIds: [],
      estimatedMinutes: 45,
    });
    const existing = await this.store.listActivitiesByPlan(plan.id);
    const sequence = existing.length
      ? Math.max(...existing.map((a) => a.sequence)) + 1
      : 0;
    const activity: LearningActivity = {
      id: stableId("activity", `${plan.id}:${sequence}:${nodeId}:retest`),
      ownerId,
      weeklyPlanId: plan.id,
      nodeId,
      title: draft.title,
      activityType: "retest",
      goal: draft.goal,
      estimatedMinutes: draft.estimatedMinutes,
      isCore: false,
      status: "planned",
      isSkipValidation: false,
      inputRefs: await this.resourceRefsForNode(ownerId, nodeId, []),
      steps: draft.steps.join("\n"),
      expectedEvidence: draft.expectedEvidence,
      evaluationCriteria: draft.evaluationCriteria,
      nextAdvice: draft.nextAdvice,
      sequence,
    };
    await this.store.saveActivity(activity);
    return this.getWorkspaceForPlan(ownerId, activity.weeklyPlanId);
  }

  // ── POST /api/learning/week-review ─────────────────
  async generateNextWeekPlan(ownerId: string, weekKey = currentWeekKey()): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能生成下周计划", 400);

    const normalized = normalizeWeekKey(weekKey);
    if (!normalized) throw new LearningError("weekKey 格式应为 YYYY-Www", 400);
    const currentPlan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, normalized);
    if (!currentPlan) throw new LearningError("本周计划不存在", 404);
    const currentActivities = await this.store.listActivitiesByPlan(currentPlan.id);
    const currentEvidence: Evidence[] = [];
    for (const activity of currentActivities) {
      currentEvidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
    }
    const currentAdjustments = await this.store.listAdjustments(ownerId);
    const review = this.buildWeekReview(currentPlan, currentActivities, currentEvidence, currentAdjustments);
    if (!review.nextWeekProposal.canGenerate) {
      throw new LearningError("本周还没有足够的完成或评审记录，先完成一个活动再生成下周计划", 400);
    }
    const archived = await this.archiveWeekReview(ownerId, profile.activeRouteId, review);

    const targetWeekKey = nextWeekKey(currentPlan.weekKey);
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) nodeStatusById[p.nodeId] = p.status;
    const planDraft = this.agents.planner.composeWeeklyPlan({
      ownerId,
      routeId: profile.activeRouteId,
      weekKey: targetWeekKey,
      capacityMinutes: profile.weeklyMinutes,
      nodeStatusById,
      prerequisiteSatisfied: (nodeId) => prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack),
      seed: stableId("week-review", `${ownerId}:${currentPlan.weekKey}:${review.revisionCount}`).length,
    });

    const weeklyPlan: WeeklyPlan = {
      id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${targetWeekKey}`),
      ownerId,
      routeId: profile.activeRouteId,
      weekKey: targetWeekKey,
      capacityMinutes: profile.weeklyMinutes,
      status: "confirmed",
      rationale: `${planDraft.rationale} 来源：${currentPlan.weekKey} 周复盘。${archived.summary} 下一步：${archived.nextBestMove}`,
    };
    await this.store.saveWeeklyPlan(weeklyPlan);
    await this.store.clearOpenActivitiesForPlan(ownerId, weeklyPlan.id);
    await this.createActivitiesFromPlanDraft(ownerId, weeklyPlan, planDraft.activities, 0);

    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${currentPlan.weekKey}:next-week:${Date.now()}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: weeklyPlan.id,
      adjustmentType: "weekly_light",
      reason: `基于 ${currentPlan.weekKey} 周复盘生成下一周计划`,
      status: "accepted",
      summary: `已生成 ${targetWeekKey} 计划：${planDraft.coreActivityCount} 个核心活动、${planDraft.optionalActivityCount} 个可选活动。`,
      actionJson: JSON.stringify([{ action: "continue", description: review.nextBestMove }]),
    };
    await this.store.saveAdjustment(adjustment);

    return this.getWorkspace(ownerId, { weekKey: targetWeekKey });
  }

  async archiveCurrentWeekReview(ownerId: string, weekKey = currentWeekKey()): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const normalized = normalizeWeekKey(weekKey);
    if (!normalized) throw new LearningError("weekKey 格式应为 YYYY-Www", 400);
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, normalized);
    if (!plan) throw new LearningError("周计划不存在", 404);
    const activities = await this.store.listActivitiesByPlan(plan.id);
    const evidence: Evidence[] = [];
    for (const activity of activities) {
      evidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
    }
    const adjustments = await this.store.listAdjustments(ownerId);
    await this.archiveWeekReview(ownerId, profile.activeRouteId, this.buildWeekReview(plan, activities, evidence, adjustments));
    return this.getWorkspace(ownerId, { weekKey: normalized });
  }

  // ── POST /api/learning/artifact ─────────────────────
  // 作品任务：把阶段路径里的作品目标正式沉入活动链，复用 integrated_task
  // 的证据评审与掌握确认机制，不新建一套作品状态机。
  async createPortfolioArtifactActivity(ownerId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能生成作品任务", 400);

    const weekKey = currentWeekKey();
    let plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, weekKey);
    if (!plan) {
      plan = {
        id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
        ownerId,
        routeId: profile.activeRouteId,
        weekKey,
        capacityMinutes: profile.weeklyMinutes,
        status: "confirmed",
        rationale: "为阶段作品任务创建的本周计划。",
      };
      await this.store.saveWeeklyPlan(plan);
    }

    const existing = await this.store.listActivitiesByPlan(plan.id);
    const current = existing.find(isPortfolioArtifactActivity);
    if (current) return this.getWorkspace(ownerId);

    const artifactDecision = this.kernel.artifactTaskDecision(ownerId);
    const node = this.pickPortfolioArtifactNode(profile.activeRouteId);
    const resourceIds = learningContentPack.resourceMappings
      .filter((mapping) => mapping.nodeId === node.id)
      .map((mapping) => mapping.resourceId);
    const draft = this.agents.activityComposer.composeActivity({
      nodeId: node.id,
      nodeTitle: node.title,
      nodeDescription: node.description,
      activityType: "integrated_task",
      isSkipValidation: false,
      resourceIds,
      estimatedMinutes: Math.min(120, Math.max(60, Math.round(profile.weeklyMinutes / 3 / 15) * 15)),
    });
    const sequence = existing.length
      ? Math.max(...existing.map((activity) => activity.sequence)) + 1
      : 0;
    const activity: LearningActivity = {
      id: stableId("activity", `${plan.id}:portfolio-artifact:${node.id}`),
      ownerId,
      weeklyPlanId: plan.id,
      nodeId: node.id,
      title: artifactDecision.output.title,
      activityType: "integrated_task",
      goal: "把本阶段学习转成可评审作品：围绕一个 AI Agent 产品，说明用户问题、能力边界、评测方案和产品取舍。",
      estimatedMinutes: draft.estimatedMinutes,
      isCore: true,
      status: "planned",
      isSkipValidation: false,
      inputRefs: await this.resourceRefsForNode(ownerId, node.id, draft.inputRefs),
      steps: [
        "对齐阶段里程碑：Week 3 确认作品方向，Week 5 提交作品 v1。",
        "选定一个 AI Agent 产品场景，写清用户、场景、痛点和成功标准。",
        "拆出核心 AI 能力清单，定义输入、输出、边界和人工兜底。",
        "设计最小评测方案：样例、指标、失败标准、上线/回滚判断。",
        "写出 PRD v1 或案例拆解报告，并标出主要产品取舍。",
        "提交作品正文或链接，并附一段对照评估标准的自评。",
      ].join("\n"),
      expectedEvidence: `${artifactDecision.output.expectedEvidence} 证据必须可被第三方复核。`,
      evaluationCriteria: "作品说明用户问题、用户场景、成功标准、能力清单、输入输出、能力边界、人工兜底、评测指标、失败标准、上线回滚判断和产品取舍；自评与作品一致。",
      nextAdvice: `对应 StagePath Week 3/5 里程碑。${artifactDecision.output.nextAdvice}`,
      sequence,
    };
    await this.store.saveActivity(activity);
    return this.getWorkspaceForPlan(ownerId, activity.weeklyPlanId);
  }

  // ── POST /api/learning/resources/inbox ───────────────
  async saveUserResource(
    ownerId: string,
    input: { title: string; type: UserResource["type"]; content?: string; sourceUrl?: string; relatedNodeIds?: string[] },
  ): Promise<Workspace> {
    if (!input.title.trim()) throw new LearningError("标题不能为空", 400);
    const resource: UserResource = {
      id: stableId("uresource", `${ownerId}:${Date.now()}`),
      ownerId,
      title: input.title.trim(),
      type: input.type,
      content: input.content?.trim() ?? "",
      sourceUrl: input.sourceUrl?.trim() ?? "",
      relatedNodeIds: (input.relatedNodeIds ?? []).filter((nodeId) =>
        learningContentPack.nodes.some((node) => node.id === nodeId),
      ),
      createdAt: new Date().toISOString(),
    };
    await this.store.saveUserResource(resource);
    await this.attachResourceToCurrentActivities(ownerId, resource);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/reset ─────────────────────────
  // 重新设置：清空该用户全部学习状态，回到未诊断起点（内容层不动）。
  async resetLearner(ownerId: string): Promise<Workspace> {
    await this.store.resetLearner(ownerId);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/adjustments/propose ─────────
  async proposeAdjustment(
    ownerId: string,
    input: { adjustmentType: AdjustmentType; reason: string },
  ): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能调整", 400);

    const reason = input.reason.trim().slice(0, 600);
    if (!reason) throw new LearningError("调整理由不能为空", 400);

    const weeklyPlan = await this.store.getWeeklyPlanByWeek(
      ownerId,
      profile.activeRouteId,
      currentWeekKey(),
    );
    const summaryByType: Record<AdjustmentType, string> = {
      weekly_light: `用户提出本周容量/节奏微调：${reason}`,
      activity_replan: `用户提出重排学习活动：${reason}`,
      route_revision: `用户提出路线或分支调整：${reason}`,
      mastery_confirm: `用户对掌握判断提出纠正：${reason}`,
    };
    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${Date.now()}:${input.adjustmentType}:${reason}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: weeklyPlan?.id ?? null,
      adjustmentType: input.adjustmentType,
      reason,
      status: "proposed",
      summary: summaryByType[input.adjustmentType],
      actionJson: "[]",
    };
    await this.store.saveAdjustment(adjustment);

    return this.getWorkspace(ownerId);
  }

  // ── 跳学 ────────────────────────────────────────────
  async skipNode(ownerId: string, nodeId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);

    // 前置缺口不允许跳学
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) nodeStatusById[p.nodeId] = p.status;
    const hasGap = !prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack);
    const decision = decideSkip(progress.status, hasGap);

    progress.status = decision.nodeStatus;
    await this.store.saveNodeProgress(progress);

    // 生成验证活动
    const node = learningContentPack.nodes.find((n) => n.id === nodeId)!;
    const weeklyPlan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    const planId = weeklyPlan?.id ?? stableId("plan", `${ownerId}:${profile.activeRouteId}:${currentWeekKey()}`);
    const draft = this.agents.activityComposer.composeActivity({
      nodeId,
      nodeTitle: node.title,
      nodeDescription: node.description,
      activityType: "independent_practice",
      isSkipValidation: true,
      resourceIds: learningContentPack.resourceMappings
        .filter((m) => m.nodeId === nodeId)
        .map((m) => m.resourceId),
      estimatedMinutes: 45,
    });
    const activity: LearningActivity = {
      id: stableId("activity", `${planId}:${nodeId}:skip-validation`),
      ownerId,
      weeklyPlanId: planId,
      nodeId,
      title: draft.title,
      activityType: draft.activityType,
      goal: draft.goal,
      estimatedMinutes: draft.estimatedMinutes,
      isCore: false,
      status: "planned",
      isSkipValidation: true,
      inputRefs: await this.resourceRefsForNode(ownerId, nodeId, draft.inputRefs),
      steps: draft.steps.join("\n"),
      expectedEvidence: draft.expectedEvidence,
      evaluationCriteria: draft.evaluationCriteria,
      nextAdvice: draft.nextAdvice,
      sequence: 99,
    };
    await this.store.saveActivity(activity);

    return this.getWorkspace(ownerId);
  }

  // ── Full Chain Phase 2+：analysis pipeline（transient，不落库）────────
  // 完整链路：goalAnalyzer → courseAnalyzer → materialReviewer →
  // capabilityMapper → learningDecisionPolicy → adaptiveRoutePlanner，产物用于 runDiagnostic 响应的可观察预览，以及
  // confirmProposal 的受控 adaptive 激活（Phase 3）。
  // 默认学习流程（legacy planner、profile、nodeProgress、confirmProposal/
  // replan、Evidence Review、Adjustment）默认不读取本产物；generic fallback
  // 的能力 id（cap.generic.*）也绝不进入 activities/nodeProgress/evidence。
  private buildAnalysis(input: {
    goal: string;
    weeklyMinutes: number;
    materialIds: string[];
    selfReport: Record<string, number>;
    preference: "breadth_first" | "build_first";
    plannerMode: PlannerMode;
  }): LearningAnalysis {
    const goalAnalysis = this.agents.goalAnalyzer.analyzeGoal({
      goal: input.goal,
      preference: input.preference,
      selfReport: input.selfReport,
    });
    const courseMaterials = this.agents.courseAnalyzer.analyzeMaterials({
      goalAnalysis,
      materialIds: input.materialIds,
    });
    const materialReviews = this.agents.materialReviewer.reviewMaterials({
      goalAnalysis,
      materials: courseMaterials,
      weeksRemaining: 2,
    });
    const capabilityMap = this.agents.capabilityMapper.mapCapabilities({
      goalAnalysis,
      materials: courseMaterials,
    });
    // 目标能力 id 回填：existing_content 用命中节点；generic 为空 = 覆盖整图
    const targetCapabilityIds = (capabilityMap.matchedContent ?? []).map((item) => item.nodeId);
    const goalAnalysisForPlan = { ...goalAnalysis, targetCapabilityIds };
    const adaptivePlan = this.agents.adaptiveRoutePlanner.plan({
      goalAnalysis: goalAnalysisForPlan,
      capabilityMap,
      weeklyMinutes: input.weeklyMinutes,
      preference: input.preference,
      selfReport: input.selfReport,
      weekKey: currentWeekKey(),
    });
    const learningDecision = this.agents.learningDecisionPolicy.decideNextMove({
      goalText: input.goal,
      goalAnalysis: goalAnalysisForPlan,
      courseMaterials,
      materialReviews,
      capabilityMap,
      hasRoute: capabilityMap.capabilities.length > 0,
      hasActiveActivities: adaptivePlan.weeklyPlan.activities.length > 0,
      weeksRemaining: 2,
      capabilityLevelById: input.selfReport,
    });
    const stagePath = planPortfolioStagePath({
      goal: input.goal,
      situation: learningDecision.situation,
      decision: learningDecision,
      adaptivePlan,
      materialReviews,
    });
    const dynamicSimulation = simulateDynamicSprint({
      stagePath,
      situation: learningDecision.situation,
      decision: learningDecision,
      adaptivePlan,
      materialReviews,
    });
    return {
      // analysis 暴露 planner 实际消费的 goalAnalysis（含回填的目标能力 id）
      goalAnalysis: goalAnalysisForPlan,
      courseMaterials,
      materialReviews,
      capabilityMap,
      learningDecision,
      adaptivePlan,
      stagePath,
      dynamicSimulation,
      plannerMode: input.plannerMode,
      mode: "rule",
    };
  }

  async getLearningQuality(ownerId: string): Promise<LearningQualityMonitor> {
    const workspace = await this.getWorkspace(ownerId);
    const snapshot = await this.store.getDiagnostic(ownerId);
    let materialReviews: MaterialReview[] = [];
    let fallbackMode = false;
    if (snapshot) {
      const answers = parseAnswersJson(snapshot.answersJson);
      const analysis = this.buildAnalysis({
        goal: snapshot.goal,
        weeklyMinutes: snapshot.weeklyMinutes,
        materialIds: parseJsonStringArray(snapshot.materialsJson),
        selfReport: parseJsonNumberRecord(snapshot.selfReportJson),
        preference: answers.preference,
        plannerMode: answers.plannerMode,
      });
      materialReviews = analysis.materialReviews;
      fallbackMode = analysis.capabilityMap.strategy === "generic_fallback";
    }
    return summarizeLearningQuality({
      weeklyPlan: workspace.weeklyPlan,
      activities: workspace.activities,
      evidence: workspace.evidence,
      nodeProgress: workspace.nodeProgress,
      materialReviews,
      fallbackMode,
      nextStagePlanExists: Boolean(workspace.nextStagePlan),
      artifactIteration: workspace.artifactIteration,
    });
  }

  async getLearningMemory(ownerId: string): Promise<LearningMemorySnapshot> {
    const workspace = await this.getWorkspace(ownerId);
    const snapshot = await this.store.getDiagnostic(ownerId);
    let materialReviews: MaterialReview[] = [];
    if (snapshot) {
      const answers = parseAnswersJson(snapshot.answersJson);
      materialReviews = this.buildAnalysis({
        goal: snapshot.goal,
        weeklyMinutes: snapshot.weeklyMinutes,
        materialIds: parseJsonStringArray(snapshot.materialsJson),
        selfReport: parseJsonNumberRecord(snapshot.selfReportJson),
        preference: answers.preference,
        plannerMode: answers.plannerMode,
      }).materialReviews;
    }
    return this.kernel.memory({
      ownerId,
      activities: workspace.activities,
      evidence: workspace.evidence,
      nodeProgress: workspace.nodeProgress,
      adjustments: workspace.adjustments,
      materialReviews,
    });
  }

  // Full Chain Phase 3：adaptive 活动落库。adaptivePlan.weeklyPlan.activities 与
  // adaptivePlan.activities 一一对应（planner 内部按同一顺序生成）；经
  // adaptiveDraftToActivity 适配为 LearningActivity（确定性 id，刷新不重排）。
  // existing_content 模式下 capabilityId = content pack nodeId（证据评审可解析）。
  private async createAdaptiveActivities(
    ownerId: string,
    weeklyPlan: WeeklyPlan,
    adaptivePlan: AdaptivePlan,
  ): Promise<void> {
    const items = adaptivePlan.weeklyPlan.activities;
    const drafts = adaptivePlan.activities;
    let sequence = 0;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      const draft = drafts[i]!;
      const activity = adaptiveDraftToActivity(draft, {
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: item.capabilityId,
        isCore: item.isCore,
        sequence,
        whyNow: item.whyNow,
      });
      await this.store.saveActivity(activity);
      sequence += 1;
    }
  }

  // ── 内部辅助 ────────────────────────────────────────
  private async createActivitiesFromPlanDraft(
    ownerId: string,
    weeklyPlan: WeeklyPlan,
    items: Array<{
      nodeId: string;
      activityType: LearningActivity["activityType"];
      title: string;
      estimatedMinutes: number;
      isCore: boolean;
      whyNow: string;
    }>,
    startSequence: number,
  ): Promise<void> {
    let sequence = startSequence;
    for (const item of items) {
      const node = learningContentPack.nodes.find((n) => n.id === item.nodeId)!;
      const resourceIds = learningContentPack.resourceMappings
        .filter((m) => m.nodeId === item.nodeId)
        .map((m) => m.resourceId);
      const draft: ActivityDraft = this.agents.activityComposer.composeActivity({
        nodeId: item.nodeId,
        nodeTitle: node.title, // 纯节点标题（composer 自行加类型前缀，避免双重前缀）
        nodeDescription: node.description,
        activityType: item.activityType,
        isSkipValidation: false,
        resourceIds,
        estimatedMinutes: item.estimatedMinutes,
      });
      const activity: LearningActivity = {
        id: stableId("activity", `${weeklyPlan.id}:${sequence}:${item.nodeId}:${item.activityType}:${item.title}`),
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: item.nodeId,
        title: draft.title,
        activityType: draft.activityType,
        goal: `${draft.goal} 原因：${item.whyNow}`,
        estimatedMinutes: draft.estimatedMinutes,
        isCore: item.isCore,
        status: "planned",
        isSkipValidation: false,
        inputRefs: await this.resourceRefsForNode(ownerId, item.nodeId, draft.inputRefs),
        steps: draft.steps.join("\n"),
        expectedEvidence: draft.expectedEvidence,
        evaluationCriteria: draft.evaluationCriteria,
        nextAdvice: draft.nextAdvice,
        sequence,
      };
      await this.store.saveActivity(activity);
      sequence += 1;
    }
  }

  private async executeAdjustmentActions(ownerId: string, adjustment: AdjustmentRecord): Promise<void> {
    const actions = parseAdjustmentActions(adjustment.actionJson);
    const hasInsert = actions.some((action) => action.action === "insert_activity" && action.targetNodeId);

    if (isPortfolioNextStageAdjustment(adjustment)) {
      await this.createNextStageActivities(ownerId, adjustment);
      return;
    }

    // weekly_light 无 insert_activity（continue/空动作）：不插活动不删活动，
    // 仅把采纳说明追加到本周计划 rationale，让采纳有可观察、低风险的副作用。
    if (adjustment.adjustmentType === "weekly_light" && !hasInsert) {
      const profile = await this.store.getProfile(ownerId);
      if (!profile) return;
      const weeklyPlan = await this.store.getWeeklyPlanByWeek(
        ownerId,
        profile.activeRouteId,
        currentWeekKey(),
      );
      if (!weeklyPlan) return;
      weeklyPlan.rationale = `${weeklyPlan.rationale} 已采纳节奏微调：${adjustment.summary}`;
      await this.store.saveWeeklyPlan(weeklyPlan);
      return;
    }

    if (!hasInsert) return;

    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const weekKey = currentWeekKey();
    let weeklyPlan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, weekKey);
    if (!weeklyPlan) {
      weeklyPlan = {
        id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
        ownerId,
        routeId: profile.activeRouteId,
        weekKey,
        capacityMinutes: profile.weeklyMinutes,
        status: "confirmed",
        rationale: "为确认调整建议创建的本周计划。",
      };
      await this.store.saveWeeklyPlan(weeklyPlan);
    }

    const existing = await this.store.listActivitiesByPlan(weeklyPlan.id);
    let sequence = existing.length
      ? Math.max(...existing.map((activity) => activity.sequence)) + 1
      : 0;

    for (const action of actions) {
      if (action.action !== "insert_activity" || !action.targetNodeId) continue;
      const node = learningContentPack.nodes.find((item) => item.id === action.targetNodeId);
      if (!node) continue;
      const resourceIds = learningContentPack.resourceMappings
        .filter((mapping) => mapping.nodeId === node.id)
        .map((mapping) => mapping.resourceId);
      const draft = this.agents.activityComposer.composeActivity({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeDescription: node.description,
        activityType: "independent_practice",
        isSkipValidation: false,
        resourceIds,
        estimatedMinutes: 45,
      });
      const activity: LearningActivity = {
        id: stableId("activity", `${weeklyPlan.id}:${sequence}:${node.id}:adjustment:${adjustment.id}`),
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: node.id,
        title: `补强活动：${node.title}`,
        activityType: draft.activityType,
        goal: `${draft.goal} 调整原因：${action.description}`,
        estimatedMinutes: draft.estimatedMinutes,
        isCore: false,
        status: "planned",
        isSkipValidation: false,
        inputRefs: await this.resourceRefsForNode(ownerId, node.id, draft.inputRefs),
        steps: draft.steps.join("\n"),
        expectedEvidence: draft.expectedEvidence,
        evaluationCriteria: draft.evaluationCriteria,
        nextAdvice: "完成补强活动并提交证据后，再回到原活动继续验证。",
        sequence,
      };
      await this.store.saveActivity(activity);
      sequence += 1;
    }
  }

  private async createNextStageActivities(ownerId: string, adjustment: AdjustmentRecord): Promise<void> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const nextStagePlan = buildPortfolioNextStagePlan(adjustment);
    if (!nextStagePlan) return;
    const weekKey = currentWeekKey();
    let weeklyPlan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, weekKey);
    if (!weeklyPlan) {
      weeklyPlan = {
        id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
        ownerId,
        routeId: profile.activeRouteId,
        weekKey,
        capacityMinutes: profile.weeklyMinutes,
        status: "confirmed",
        rationale: "为作品集下一阶段创建的本周计划。",
      };
      await this.store.saveWeeklyPlan(weeklyPlan);
    } else {
      weeklyPlan.rationale = `${weeklyPlan.rationale} 已进入作品集下一阶段：${nextStagePlan.title}。`;
      await this.store.saveWeeklyPlan(weeklyPlan);
    }

    const existing = await this.store.listActivitiesByPlan(weeklyPlan.id);
    const existingIds = new Set(existing.map((activity) => activity.id));
    let sequence = existing.length
      ? Math.max(...existing.map((activity) => activity.sequence)) + 1
      : 0;
    const node = this.pickPortfolioArtifactNode(profile.activeRouteId);
    const activityTypes = ["integrated_task", "integrated_task", "reflection"] as const;

    for (const [index, module] of nextStagePlan.modules.entries()) {
      const id = stableId("activity", `${weeklyPlan.id}:${adjustment.id}:${module.id}:next-stage`);
      if (existingIds.has(id)) continue;
      const activity: LearningActivity = {
        id,
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: node.id,
        title: `下一阶段：${module.title}`,
        activityType: activityTypes[index] ?? "integrated_task",
        goal: module.goal,
        estimatedMinutes: 60,
        isCore: true,
        status: "planned",
        isSkipValidation: false,
        inputRefs: await this.resourceRefsForNode(ownerId, node.id, []),
        steps: [
          `基于已通过评审的 AI Agent 产品 PRD v1，完成「${module.title}」。`,
          ...module.outputs.map((output) => `产出：${output}`),
          ...module.rubric.map((criterion) => `评审标准：${criterion}`),
          "提交作品链接、正文片段或截图说明，并说明它如何继承上一阶段 evidence。",
        ].join("\n"),
        expectedEvidence: `${module.outputs.join(" / ")}，并附与原作品证据的连接说明。必须覆盖：${module.rubric.join("；")}`,
        evaluationCriteria: `第三方评审应能确认：${module.rubric.join("；")} 同时看懂「${module.title}」与原 PRD 作品的关系。`,
        nextAdvice: "提交后继续走 Evidence Review；通过不自动代表掌握，仍按 Trellis 证据规则确认。",
        sequence,
      };
      await this.store.saveActivity(activity);
      sequence += 1;
    }
  }

  private pickPortfolioArtifactNode(routeId: string): LearningNode {
    const preferredIds = [
      "ai-product.capability-design",
      "ai-product.eval-decision",
      "ai-product.problem-def",
      "ai-app-dev.eval-harness",
      "ai-literacy.evaluation",
    ];
    for (const id of preferredIds) {
      const node = learningContentPack.nodes.find((item) => item.id === id);
      if (node) return node;
    }
    const routeNode = learningContentPack.nodes.find((node) =>
      node.routeId === routeId && node.activityTemplates.includes("integrated_task"),
    );
    if (routeNode) return routeNode;
    return learningContentPack.nodes.find((node) => node.activityTemplates.includes("integrated_task"))!;
  }

  private buildContentJudgment(input: {
    routeId: string;
    activities: LearningActivity[];
    resources: Workspace["workbench"]["resources"];
    userResources: UserResource[];
    materialReviews: MaterialReview[];
  }): ContentJudgment[] {
    const activeRefs = new Set(input.activities.flatMap((activity) => activity.inputRefs));
    const routeNodeIds = new Set(
      learningContentPack.nodes
        .filter((node) => node.routeId === input.routeId)
        .map((node) => node.id),
    );
    const reviewById = new Map(input.materialReviews.map((review) => [review.materialId, review]));

    const systemJudgments = input.resources
      .filter((resource) => routeNodeIds.has(resource.nodeId))
      .map((resource): ContentJudgment => {
        const review = reviewById.get(resource.resourceId);
        const entersCurrentWeek = activeRefs.has(resource.resourceId);
        const role = this.contentRole({
          entersCurrentWeek,
          hasMapping: true,
          credibilityLevel: resource.credibilityLevel,
          materialVerdict: review?.verdict,
        });
        return {
          resourceId: resource.resourceId,
          title: resource.title,
          professionalVerdict: this.professionalVerdict(resource.credibilityLevel, review),
          fitVerdict: this.fitVerdict(role),
          role,
          recommendedSegment: entersCurrentWeek
            ? resource.segmentFocus ?? `本周只用和「${nodeFor(resource.nodeId)?.title ?? resource.nodeId}」相关的片段：${resource.usage}`
            : `先留作后续材料；需要推进「${nodeFor(resource.nodeId)?.title ?? resource.nodeId}」时再打开。`,
          skipReason: role === "暂不碰"
            ? resource.skipGuidance ?? "当前可信度、练习密度或阶段适配不足，先不把它放进本周任务。"
            : "",
          useFor: resource.learnerAction ?? resource.usage,
          qualityRationale: resource.qualityRationale ?? "已通过 Trellis 内置内容池的来源可信度与节点适配判断。",
          skipGuidance: resource.skipGuidance ?? "",
          conceptsIntroduced: conceptHintsForNode(resource.nodeId),
          entersCurrentWeek,
          rawContent: "",
        };
      });

    const uniqueUserResources = Array.from(
      new Map(input.userResources.map((resource) => [
        `${resource.title.trim().toLowerCase()}::${resource.content.trim().slice(0, 120)}::${resource.relatedNodeIds.join(",")}`,
        resource,
      ])).values(),
    );

    const userJudgments = uniqueUserResources.map((resource): ContentJudgment => {
      const mappedNodes = resource.relatedNodeIds.filter((nodeId) => routeNodeIds.has(nodeId));
      const entersCurrentWeek = activeRefs.has(resource.id);
      const role = this.contentRole({
        entersCurrentWeek,
        hasMapping: mappedNodes.length > 0,
        credibilityLevel: mappedNodes.length > 0 ? 3 : 1,
      });
      const firstNode = mappedNodes[0] ? nodeFor(mappedNodes[0]) : null;
      return {
        resourceId: resource.id,
        title: resource.title,
        professionalVerdict: mappedNodes.length > 0 ? "基本可用" : "需要谨慎",
        fitVerdict: this.fitVerdict(role),
        role,
        recommendedSegment: firstNode
          ? `只截取能帮助「${firstNode.title}」的一小段；先服务当前行动，不整理整门课。`
          : "暂时不进入本周活动；先补一个明确节点映射。",
        skipReason: mappedNodes.length === 0 ? "还没有映射到当前路线节点，容易变成泛收藏。" : "",
        useFor: firstNode ? `补充「${firstNode.title}」的例子、材料或个人上下文。` : "待处理材料。",
        qualityRationale: mappedNodes.length > 0
          ? "用户材料已映射到当前路线节点，可作为补充上下文；专业性仍低于内置权威材料。"
          : "尚未映射到能力节点，Trellis 暂不把它当作本周学习依据。",
        skipGuidance: mappedNodes.length === 0 ? "先补节点映射，再决定是否进入活动输入。" : "",
        conceptsIntroduced: mappedNodes.flatMap((nodeId) => conceptHintsForNode(nodeId)).slice(0, 2),
        entersCurrentWeek,
        rawContent: resource.content,
      };
    });

    const rank: Record<ContentJudgmentRole, number> = {
      本周主线: 0,
      只作参考: 1,
      后续再用: 2,
      暂不碰: 3,
    };
    return [...systemJudgments, ...userJudgments]
      .sort((a, b) => rank[a.role] - rank[b.role] || a.title.localeCompare(b.title))
      .slice(0, 12);
  }

  private contentRole(input: {
    entersCurrentWeek: boolean;
    hasMapping: boolean;
    credibilityLevel: number;
    materialVerdict?: MaterialReview["verdict"];
  }): ContentJudgmentRole {
    if (input.entersCurrentWeek) return "本周主线";
    if (!input.hasMapping || input.credibilityLevel <= 1 || input.materialVerdict === "not_recommended") return "暂不碰";
    if (input.materialVerdict === "reference") return "只作参考";
    return "后续再用";
  }

  private professionalVerdict(credibilityLevel: number, review?: MaterialReview): ContentJudgment["professionalVerdict"] {
    if (credibilityLevel >= 5 || (review?.qualityScore ?? 0) >= 75) return "专业可信";
    if (credibilityLevel >= 3 || (review?.qualityScore ?? 0) >= 55) return "基本可用";
    return "需要谨慎";
  }

  private fitVerdict(role: ContentJudgmentRole): ContentJudgment["fitVerdict"] {
    if (role === "本周主线") return "适合本周";
    if (role === "后续再用") return "适合稍后";
    if (role === "只作参考") return "仅供参考";
    return "暂不适合";
  }

  private buildCourseSlices(input: {
    activities: LearningActivity[];
    contentJudgment: ContentJudgment[];
  }): CourseSlice[] {
    const activitiesByRef = new Map<string, LearningActivity[]>();
    for (const activity of input.activities) {
      for (const refId of activity.inputRefs) {
        activitiesByRef.set(refId, [...(activitiesByRef.get(refId) ?? []), activity]);
      }
    }
    return input.contentJudgment.flatMap((judgment) => {
      const linkedActivities = activitiesByRef.get(judgment.resourceId) ?? [];
      const nodeIds = linkedActivities.length > 0
        ? [...new Set(linkedActivities.map((activity) => activity.nodeId))]
        : judgment.conceptsIntroduced[0]?.id
          ? []
          : [];
      const fallbackNodeId = linkedActivities[0]?.nodeId
        ?? this.nodeIdFromJudgment(judgment)
        ?? "unmapped";
      const targets = nodeIds.length > 0 ? nodeIds : [fallbackNodeId];
      const outlinedSlices = this.outlineSlicesFromJudgment(judgment, linkedActivities, fallbackNodeId);
      if (outlinedSlices.length > 0) return outlinedSlices;
      return targets.map((nodeId) => {
        const node = nodeFor(nodeId);
        const activityIds = linkedActivities
          .filter((activity) => activity.nodeId === nodeId || nodeId === "unmapped")
          .map((activity) => activity.id);
        return {
          id: stableId("slice", `${judgment.resourceId}:${nodeId}:${judgment.role}`),
          resourceId: judgment.resourceId,
          title: this.sliceTitle(judgment, node?.title),
          resourceTitle: judgment.title,
          nodeId,
          role: judgment.role,
          sourceRange: judgment.recommendedSegment,
          whyThisSlice: judgment.qualityRationale,
          estimatedMinutes: judgment.entersCurrentWeek ? 30 : 15,
          difficulty: this.sliceDifficulty(judgment.recommendedSegment),
          learnerAction: judgment.useFor,
          afterWatchingPrompt: this.afterWatchingPrompt(judgment, node?.title),
          skipReason: judgment.skipReason || judgment.skipGuidance,
          entersCurrentWeek: judgment.entersCurrentWeek,
          activityIds,
        };
      });
    });
  }

  private outlineSlicesFromJudgment(
    judgment: ContentJudgment,
    linkedActivities: LearningActivity[],
    fallbackNodeId: string,
  ): CourseSlice[] {
    const lines = this.extractOutlineLines(judgment.rawContent ?? "");
    if (lines.length < 2) return [];
    const activeNodeIds = new Set(linkedActivities.map((activity) => activity.nodeId));
    return lines.slice(0, 8).map((line, index) => {
      const nodeId = this.nodeIdForOutlineLine(line, activeNodeIds) ?? fallbackNodeId;
      const node = nodeFor(nodeId);
      const role = this.sliceRoleForOutlineLine(line, index, judgment.entersCurrentWeek);
      const activityIds = linkedActivities
        .filter((activity) => activity.nodeId === nodeId || role === "本周主线")
        .map((activity) => activity.id)
        .slice(0, role === "本周主线" ? 2 : 0);
      return {
        id: stableId("slice", `${judgment.resourceId}:outline:${index}:${line}`),
        resourceId: judgment.resourceId,
        title: `${role === "本周主线" ? "本周只看" : role === "暂不碰" ? "先跳过" : role}：${line.title}`,
        resourceTitle: judgment.title,
        nodeId,
        role,
        sourceRange: line.range,
        whyThisSlice: role === "本周主线"
          ? `这段最接近「${node?.title ?? "当前节点"}」，适合先推进一个判断。`
          : role === "暂不碰"
          ? "这段对初学者偏深或偏工具细节，当前先不进入本周行动。"
          : "这段有参考价值，但不是本周启动的最短路径。",
        estimatedMinutes: role === "本周主线" ? 30 : 15,
        difficulty: this.sliceDifficulty(line.title),
        learnerAction: role === "本周主线"
          ? `看完后留下一个关于「${node?.title ?? "当前节点"}」的判断。`
          : "暂不生成正式行动。",
        afterWatchingPrompt: this.afterWatchingPrompt(judgment, node?.title),
        skipReason: role === "暂不碰" ? "先完成本周主线片段，再回来看这段。" : "",
        entersCurrentWeek: role === "本周主线",
        activityIds,
      };
    });
  }

  private extractOutlineLines(content: string): Array<{ title: string; range: string }> {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) =>
        line.length >= 4 &&
        (/^(\d+[\).、]|第[一二三四五六七八九十\d]+[章节课]|[-*]\s+|\d{1,2}:\d{2})/.test(line) || /chapter|lesson|module|week|section/i.test(line)),
      )
      .map((line) => {
        const cleaned = line.replace(/^[-*]\s+/, "").replace(/^\d+[\).、]\s*/, "");
        const time = cleaned.match(/\d{1,2}:\d{2}(?::\d{2})?(?:\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?)?/);
        return {
          title: cleaned.replace(/\s+/g, " ").slice(0, 80),
          range: time ? `视频时间 ${time[0]}：${cleaned}` : `目录片段：${cleaned}`,
        };
      });
  }

  private nodeIdForOutlineLine(line: { title: string }, activeNodeIds: Set<string>): string | null {
    const text = line.title.toLowerCase();
    const matched = learningContentPack.nodes.find((node) =>
      (activeNodeIds.size === 0 || activeNodeIds.has(node.id)) &&
      [node.title, node.description, ...node.signals].some((item) => text.includes(item.toLowerCase().slice(0, 8))),
    );
    if (matched) return matched.id;
    if (/eval|评测|测试|metric|failure|风险/.test(text)) return "ai-literacy.evaluation";
    if (/agent|tool|workflow|能力|边界/.test(text)) return "ai-product.capability-design";
    if (/problem|user|scenario|场景|需求|痛点/.test(text)) return "ai-product.problem-def";
    if (/model|llm|machine learning|generalization|hallucination|模型|幻觉/.test(text)) return "ai-literacy.mechanism";
    return null;
  }

  private sliceRoleForOutlineLine(line: { title: string }, index: number, entersCurrentWeek: boolean): ContentJudgmentRole {
    const text = line.title.toLowerCase();
    if (/advanced|深入|源码|部署|fine[- ]?tuning|微调|数学|证明|benchmark/.test(text)) return "暂不碰";
    if (!entersCurrentWeek) return index < 2 ? "后续再用" : "只作参考";
    return index < 2 ? "本周主线" : index < 5 ? "后续再用" : "只作参考";
  }

  private sliceDifficulty(text: string): CourseSlice["difficulty"] {
    if (/advanced|深入|源码|部署|fine[- ]?tuning|微调|数学|证明|benchmark|架构/.test(text.toLowerCase())) return "偏难";
    if (/practice|案例|project|eval|评测|实战|练习/.test(text.toLowerCase())) return "适中";
    return "入门";
  }

  private nodeIdFromJudgment(judgment: ContentJudgment): string | null {
    const label = judgment.conceptsIntroduced[0]?.label;
    return learningContentPack.nodes.find((node) => node.title === label)?.id ?? null;
  }

  private sliceTitle(judgment: ContentJudgment, nodeTitle?: string): string {
    if (judgment.role === "暂不碰") return `先跳过：${judgment.title}`;
    if (judgment.role === "只作参考") return `参考：${judgment.title}`;
    if (judgment.role === "后续再用") return `稍后：${judgment.title}`;
    return nodeTitle ? `本周只看：${nodeTitle}` : `本周只看：${judgment.title}`;
  }

  private afterWatchingPrompt(judgment: ContentJudgment, nodeTitle?: string): string {
    if (judgment.role === "暂不碰") return "暂不学习；先把本周主线材料推进完。";
    if (judgment.role === "只作参考") return "只摘一个能帮助判断的例子，不把它变成新任务。";
    const topic = nodeTitle ?? "当前节点";
    return `看完后只回答一个问题：这段材料如何帮助你判断「${topic}」的适用场景、边界或下一步？`;
  }

  private buildWeeklyActionPlan(input: {
    weeklyPlan: WeeklyPlan;
    activities: LearningActivity[];
    contentJudgment: ContentJudgment[];
    courseSlices: CourseSlice[];
    evidence: Evidence[];
  }): WeeklyActionCard[] {
    const judgmentByRef = new Map(input.contentJudgment.map((judgment) => [judgment.resourceId, judgment]));
    const slicesByActivity = new Map<string, CourseSlice[]>();
    for (const slice of input.courseSlices) {
      for (const activityId of slice.activityIds) {
        slicesByActivity.set(activityId, [...(slicesByActivity.get(activityId) ?? []), slice]);
      }
    }
    const evidenceByActivity = new Map<string, Evidence[]>();
    for (const item of input.evidence) {
      evidenceByActivity.set(item.activityId, [...(evidenceByActivity.get(item.activityId) ?? []), item]);
    }

    const mainActionIds = this.pickMainActionIds(input.activities, evidenceByActivity, input.weeklyPlan.capacityMinutes);

    return this.orderActivitiesForWeeklyRhythm(input.activities, evidenceByActivity, mainActionIds)
      .map((activity) => {
        const accepted = (evidenceByActivity.get(activity.id) ?? []).some((item) => item.status === "accepted");
        const concepts = conceptHintsForNode(activity.nodeId);
        const resourceSegments = activity.inputRefs
          .map((refId) => judgmentByRef.get(refId)?.recommendedSegment)
          .filter((segment): segment is string => Boolean(segment))
          .slice(0, 2);
        const courseSlices = (slicesByActivity.get(activity.id) ?? []).slice(0, 2);
        const sliceSegments = courseSlices.map((slice) => `${slice.resourceTitle}：${slice.sourceRange}`);
        return {
          id: stableId("action", `${input.weeklyPlan.id}:${activity.id}`),
          activityId: activity.id,
          weekKey: input.weeklyPlan.weekKey,
          title: actionCardTitleOf(activity),
          tier: this.actionTier(activity, accepted, mainActionIds),
          actionType: actionTypeOf(activity),
          whyNow: activity.goal,
          materialSlice: sliceSegments.length > 0
            ? sliceSegments.join("；")
            : resourceSegments.length > 0
            ? resourceSegments.join("；")
            : "使用 Trellis 内置内容池中与当前节点相关的一小段，不需要先补完整门课。",
          courseSliceIds: courseSlices.map((slice) => slice.id),
          estimatedMinutes: normalizeActionMinutes(activity.estimatedMinutes),
          conceptHints: concepts,
          feedbackMode: feedbackModeOf(activity),
          scenarioQuestion: this.scenarioQuestionFor(activity, concepts),
          nextIfClear: accepted
            ? "这一步已经有 accepted 证据，可以继续下一张本周行动卡。"
            : "用一句话留下你的判断或小产出，再让 Trellis 决定是否需要修订。",
          nextIfStuck: "把范围缩到 30 分钟：只看指定片段，只回答当前判断，不补整门课。",
        };
      });
  }

  private pickMainActionIds(
    activities: LearningActivity[],
    evidenceByActivity: Map<string, Evidence[]>,
    capacityMinutes: number,
  ): Set<string> {
    const mainLimit = capacityMinutes <= 240 ? 4 : capacityMinutes <= 480 ? 5 : 6;
    const eligible = [...activities]
      .filter((activity) => {
        const accepted = (evidenceByActivity.get(activity.id) ?? []).some((item) => item.status === "accepted");
        return activity.isCore && activity.status !== "completed" && !accepted;
      })
      .sort((a, b) => this.activityRhythmRank(a) - this.activityRhythmRank(b) || a.sequence - b.sequence);
    const selected = new Set<string>();
    const usedTypes = new Set<string>();
    for (const activity of eligible) {
      if (selected.size >= mainLimit) break;
      if (usedTypes.has(activity.activityType) && selected.size >= 3) continue;
      selected.add(activity.id);
      usedTypes.add(activity.activityType);
    }
    for (const activity of eligible) {
      if (selected.size >= Math.min(3, eligible.length) || selected.size >= mainLimit) break;
      selected.add(activity.id);
    }
    return selected;
  }

  private orderActivitiesForWeeklyRhythm(
    activities: LearningActivity[],
    evidenceByActivity: Map<string, Evidence[]>,
    mainActionIds: Set<string>,
  ): LearningActivity[] {
    return [...activities].sort((a, b) =>
      this.activityUrgencyRank(a, evidenceByActivity, mainActionIds)
      - this.activityUrgencyRank(b, evidenceByActivity, mainActionIds)
      || this.activityRhythmRank(a) - this.activityRhythmRank(b)
      || a.sequence - b.sequence,
    );
  }

  private activityUrgencyRank(
    activity: LearningActivity,
    evidenceByActivity: Map<string, Evidence[]>,
    mainActionIds: Set<string>,
  ): number {
    const evidence = evidenceByActivity.get(activity.id) ?? [];
    if (evidence.some((item) => item.status === "needs_revision")) return 0;
    if (evidence.some((item) => item.status === "submitted")) return 1;
    if (activity.status === "in_progress") return 2;
    if (mainActionIds.has(activity.id)) return 3;
    if (!activity.isCore) return 5;
    if (activity.status === "completed") return 6;
    return 4;
  }

  private activityRhythmRank(activity: LearningActivity): number {
    const rank: Record<LearningActivity["activityType"], number> = {
      follow_demo: 0,
      build_model: 1,
      quiz: 2,
      independent_practice: 3,
      integrated_task: 4,
      reflection: 5,
      retest: 6,
    };
    return rank[activity.activityType] ?? 9;
  }

  private actionTier(activity: LearningActivity, accepted: boolean, mainActionIds: Set<string>): ActionTier {
    if (accepted || activity.status === "completed") return "补充推进";
    if (!activity.isCore) return activity.activityType === "quiz" || activity.activityType === "reflection" ? "低精力备选" : "补充推进";
    return mainActionIds.has(activity.id) ? "主推进" : "补充推进";
  }

  private scenarioQuestionFor(activity: LearningActivity, concepts: ConceptHint[]): ScenarioQuestion | null {
    if (activity.activityType === "reflection") return null;
    const conceptLabel = concepts[0]?.label ?? nodeFor(activity.nodeId)?.title ?? "当前概念";
    const prompt = activity.activityType === "integrated_task"
      ? `完成「${activity.title}」后，哪种判断最能说明你可以继续推进？`
      : `看完这一步后，哪种反应更像你真正理解了「${conceptLabel}」？`;
    return {
      id: stableId("scenario", activity.id),
      prompt,
      options: [
        {
          id: "a",
          label: "继续补课",
          text: `我想先把「${conceptLabel}」相关课程完整看完，包括定义、背景、案例和工具细节。等我感觉知识点都补齐以后，再开始判断它适合什么场景、失败边界在哪里，或者要不要进入产出。`,
        },
        {
          id: "b",
          label: "先做判断",
          text: `我先用当前片段做一个小判断：它适合什么场景，不适合什么场景，失败时会造成什么代价，以及下一步应该看材料、拆案例还是做小模板。即使还没学完整门课，也能留下可复核判断。`,
        },
        {
          id: "c",
          label: "换更难材料",
          text: `这个内容看起来太基础，我想直接跳到更高阶材料，例如系统架构、评测平台或 Agent 工具链。当前基础概念我大概懂，但还没有把它和实际产品场景、能力边界或评测标准连起来。`,
        },
        {
          id: "d",
          label: "只收藏",
          text: `我先把链接、摘要和重点全部存起来，之后再统一整理。现在还不确定它服务哪个节点、哪个任务或哪个判断，只觉得以后可能有用，所以暂时不把它转成具体行动。`,
        },
      ],
      preferredOptionId: "b",
      diagnosisByOption: {
        a: "这通常是启动阻力：你在等待完整输入，而不是推进最小判断。",
        b: "这是 Trellis 想保留的学习信号：材料已经能支持一个具体判断。",
        c: "可能可以跳，但需要先留下一条能解释边界或风险的信号。",
        d: "这会增加材料债；收藏不是本周进展，除非它服务当前行动。",
      },
      nextActionByOption: {
        a: "不要补整门课，回到卡片指定片段，写下一个 3 句话判断。",
        b: "提交这条判断；如果通过，就进入下一张行动卡。",
        c: "先提交一条跳学理由，Trellis 再决定是否进入验证或补前置。",
        d: "先把材料映射到一个节点；未映射材料暂不进入本周任务。",
      },
    };
  }

  private pickNextAction(
    weeklyActionPlan: WeeklyActionCard[],
    activities: LearningActivity[],
    evidence: Evidence[],
  ): WeeklyActionCard | null {
    const activityById = new Map(activities.map((activity) => [activity.id, activity]));
    const needsRevisionIds = new Set(evidence.filter((item) => item.status === "needs_revision").map((item) => item.activityId));
    const submittedIds = new Set(evidence.filter((item) => item.status === "submitted").map((item) => item.activityId));
    return weeklyActionPlan.find((card) => card.activityId && needsRevisionIds.has(card.activityId))
      ?? weeklyActionPlan.find((card) => card.activityId && submittedIds.has(card.activityId))
      ?? weeklyActionPlan.find((card) => card.activityId && activityById.get(card.activityId)?.status === "in_progress")
      ?? weeklyActionPlan.find((card) => card.tier === "主推进" && card.activityId && activityById.get(card.activityId)?.status === "planned")
      ?? weeklyActionPlan.find((card) => card.activityId && activityById.get(card.activityId)?.status !== "completed")
      ?? null;
  }

  private collectConceptHints(
    weeklyActionPlan: WeeklyActionCard[],
    contentJudgment: ContentJudgment[],
  ): ConceptHint[] {
    const seen = new Set<string>();
    const result: ConceptHint[] = [];
    for (const hint of [
      ...weeklyActionPlan.flatMap((action) => action.conceptHints),
      ...contentJudgment.flatMap((judgment) => judgment.conceptsIntroduced),
    ]) {
      if (seen.has(hint.id)) continue;
      seen.add(hint.id);
      result.push(hint);
      if (result.length >= 8) break;
    }
    return result;
  }

  private buildLearningOutputs(
    weeklyPlan: WeeklyPlan,
    activities: LearningActivity[],
    evidence: Evidence[],
  ): LearningOutput[] {
    const activityById = new Map(activities.map((activity) => [activity.id, activity]));
    return evidence
      .filter((item) => item.status === "accepted" || item.status === "needs_revision")
      .map((item): LearningOutput => {
        const activity = activityById.get(item.activityId);
        const kind: LearningOutput["kind"] = item.evidenceType === "artifact"
          ? "作品片段"
          : item.evidenceType === "judgment"
            ? "判断记录"
            : item.status === "accepted"
              ? "学习产出"
              : "进展记录";
        const summary = item.feedback || item.content || "这条记录已经进入本周学习状态。";
        return {
          id: stableId("output", `${weeklyPlan.id}:${item.id}`),
          kind,
          title: activity ? activity.title : "学习记录",
          sourceActionId: activity?.id ?? null,
          weekKey: weeklyPlan.weekKey,
          summary: summary.length > 140 ? `${summary.slice(0, 140)}...` : summary,
        };
      })
      .slice(-8);
  }

  private buildWeekReview(
    weeklyPlan: WeeklyPlan,
    activities: LearningActivity[],
    evidence: Evidence[],
    adjustments: AdjustmentRecord[],
    archived?: WeekReviewRecord | null,
  ): WeekReview {
    if (archived) {
      const parsed = parseWeekReviewJson(archived.reviewJson, archived);
      return {
        ...parsed,
        generatedNextWeek: adjustments.some((adjustment) =>
          adjustment.status === "accepted" &&
          adjustment.reason.includes(`${archived.weekKey} 周复盘生成下一周计划`),
        ),
      };
    }
    const completedCount = activities.filter((activity) => activity.status === "completed").length;
    const acceptedEvidenceCount = evidence.filter((item) => item.status === "accepted").length;
    const revisionCount = evidence.filter((item) => item.status === "needs_revision").length;
    const openActivityCount = activities.filter((activity) =>
      activity.status === "planned" || activity.status === "in_progress" || activity.status === "evidence_submitted",
    ).length;
    const plannedMinutes = activities.filter((activity) => activity.isCore)
      .reduce((sum, activity) => sum + activity.estimatedMinutes, 0);
    const materialMismatchCount = adjustments.filter((adjustment) =>
      /材料|资料|错配|不适合/.test(`${adjustment.reason} ${adjustment.summary}`),
    ).length;
    const completionRate = activities.length ? completedCount / activities.length : 0;
    const nextBestMove = revisionCount > 0
      ? "优先修订未通过证据，补齐能力信号或作品 rubric 缺口。"
      : openActivityCount > 0
        ? "先完成一个开放核心活动，并提交可评审证据。"
        : "可以生成下一周计划，继续沿当前路线推进。";
    const summary = `完成 ${completedCount}/${activities.length} 个活动，接受 ${acceptedEvidenceCount} 条证据，${revisionCount} 条证据需要修订。`;
    return {
      weekKey: weeklyPlan.weekKey,
      completedCount,
      acceptedEvidenceCount,
      openActivityCount,
      revisionCount,
      materialMismatchCount,
      capacityMinutes: weeklyPlan.capacityMinutes,
      plannedMinutes,
      completionRate,
      summary,
      nextBestMove,
      nextWeekProposal: {
        title: `生成 ${nextWeekKey(weeklyPlan.weekKey)} 计划`,
        summary: revisionCount > 0
          ? "下周会保留当前路线，但优先安排补强、修订和继续练习。"
          : "下周会基于已验证证据继续推进可执行活动。",
        actionCount: Math.max(1, Math.min(4, activities.filter((activity) => activity.isCore).length || 2)),
        canGenerate: completedCount > 0 || acceptedEvidenceCount > 0 || revisionCount > 0,
      },
      archivedAt: null,
      generatedNextWeek: adjustments.some((adjustment) =>
        adjustment.status === "accepted" &&
        adjustment.reason.includes(`${weeklyPlan.weekKey} 周复盘生成下一周计划`),
      ),
    };
  }

  private async archiveWeekReview(ownerId: string, routeId: string, review: WeekReview): Promise<WeekReviewRecord> {
    const now = new Date().toISOString();
    const record: WeekReviewRecord = {
      id: stableId("weekreview", `${ownerId}:${routeId}:${review.weekKey}`),
      ownerId,
      routeId,
      weekKey: review.weekKey,
      summary: review.summary,
      completedCount: review.completedCount,
      acceptedEvidenceCount: review.acceptedEvidenceCount,
      revisionCount: review.revisionCount,
      openActivityCount: review.openActivityCount,
      nextBestMove: review.nextBestMove,
      reviewJson: JSON.stringify({ ...review, archivedAt: now }),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveWeekReview(record);
    return record;
  }

  private async attachResourceToCurrentActivities(ownerId: string, resource: UserResource): Promise<void> {
    if (resource.relatedNodeIds.length === 0) return;
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return;
    const plans = await this.store.listWeeklyPlans(ownerId, profile.activeRouteId);
    const related = new Set(resource.relatedNodeIds);
    for (const plan of plans) {
      const activities = await this.store.listActivitiesByPlan(plan.id);
      for (const activity of activities) {
        if (!related.has(activity.nodeId) || activity.inputRefs.includes(resource.id)) continue;
        activity.inputRefs = [...activity.inputRefs, resource.id];
        activity.nextAdvice = `${activity.nextAdvice} 已加入工作台材料「${resource.title}」，可作为本次活动输入。`;
        await this.store.saveActivity(activity);
      }
    }
  }

  private async resourceRefsForNode(ownerId: string, nodeId: string, baseRefs: string[]): Promise<string[]> {
    const userRefs = (await this.store.listUserResources(ownerId))
      .filter((resource) => resource.relatedNodeIds.includes(nodeId))
      .map((resource) => resource.id);
    return [...new Set([...baseRefs, ...userRefs])];
  }

  private async buildWeeklyPlanHistory(ownerId: string, routeId: string): Promise<WeeklyPlanSummary[]> {
    const nowKey = currentWeekKey();
    const plans = await this.store.listWeeklyPlans(ownerId, routeId);
    const result: WeeklyPlanSummary[] = [];
    for (const plan of plans) {
      const activities = await this.store.listActivitiesByPlan(plan.id);
      const evidence: Evidence[] = [];
      for (const activity of activities) {
        evidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
      }
      const review = await this.store.getWeekReview(ownerId, routeId, plan.weekKey);
      result.push({
        weekKey: plan.weekKey,
        status: plan.status,
        capacityMinutes: plan.capacityMinutes,
        activityCount: activities.length,
        coreActivityCount: activities.filter((activity) => activity.isCore).length,
        completedCount: activities.filter((activity) => activity.status === "completed").length,
        acceptedEvidenceCount: evidence.filter((item) => item.status === "accepted").length,
        isCurrentWeek: plan.weekKey === nowKey,
        isFutureWeek: plan.weekKey > nowKey,
        reviewSummary: review?.summary ?? null,
        reviewArchivedAt: review?.updatedAt ?? null,
        generatedFromReview: /周复盘/.test(plan.rationale),
      });
    }
    return result;
  }

  private async proposeNextStageAfterPortfolioMastery(
    ownerId: string,
    profile: LearnerProfile,
    nodeId: string,
  ): Promise<void> {
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    if (!plan) return;
    const activities = await this.store.listActivitiesByPlan(plan.id);
    const artifact = activities.find((activity) =>
      activity.nodeId === nodeId && isPortfolioArtifactActivity(activity),
    );
    if (!artifact) return;
    const evidence = await this.store.listEvidenceByActivity(artifact.id);
    if (!evidence.some((item) => item.status === "accepted")) return;
    const existing = await this.store.listAdjustments(ownerId);
    if (existing.some((item) =>
      item.status === "proposed"
      && item.adjustmentType === "route_revision"
      && item.reason.includes("作品已通过掌握确认"),
    )) {
      return;
    }
    const nextStageDecision = this.kernel.nextStageDecision(ownerId);
    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${artifact.id}:next-stage:${Date.now()}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: plan.id,
      adjustmentType: "route_revision",
      reason: nextStageDecision.output.reason,
      status: "proposed",
      summary: nextStageDecision.output.summary,
      actionJson: JSON.stringify(nextStageDecision.output.actions),
    };
    await this.store.saveAdjustment(adjustment);
  }

  private async getOwnedActivity(ownerId: string, activityId: string): Promise<LearningActivity> {
    const activity = await this.store.getActivity(activityId);
    if (!activity || activity.ownerId !== ownerId) {
      throw new LearningError("活动不存在", 404);
    }
    return activity;
  }

  private async getOrCreateNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress> {
    const existing = await this.store.getNodeProgress(ownerId, nodeId);
    if (existing) return existing;
    const progress: NodeProgress = {
      id: stableId("nprogress", `${ownerId}:${nodeId}`),
      ownerId,
      nodeId,
      status: "unstarted",
      confidence: 0,
      lastValidatedAt: null,
      supportingEvidenceIds: [],
      confirmedAt: null,
      reviewIntervalDays: 14,
      nextReviewAt: null,
      reviewCount: 0,
    };
    await this.store.saveNodeProgress(progress);
    return progress;
  }

  private async computeCompletionRate(ownerId: string): Promise<number> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return 0;
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    if (!plan) return 0;
    const activities = await this.store.listActivitiesByPlan(plan.id);
    if (activities.length === 0) return 0;
    const completed = activities.filter((a) => a.status === "completed").length;
    return completed / activities.length;
  }

  private async listSkippedNodeIds(ownerId: string): Promise<string[]> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return [];
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    if (!plan) return [];
    const activities = await this.store.listActivitiesByPlan(plan.id);
    return activities.filter((a) => a.isSkipValidation).map((a) => a.nodeId);
  }
}

// ── 便捷工厂（测试/开发用内存实现）────────────────────
export function createLearningService(store?: LearningStore): LearningApplicationService {
  return new LearningApplicationService(
    store ?? new InMemoryLearningStore(),
    createRuleAgents(),
  );
}
